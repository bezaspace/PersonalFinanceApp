import dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { GoogleGenAI, Modality } from '@google/genai';
import { WaveFile } from 'wavefile';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface LiveSession {
  id: string;
  geminiSession: any;
  clientWs: WebSocket;
  isActive: boolean;
  responseQueue: any[];
  audioResponseBuffer: Buffer[];
  sessionState: 'connecting' | 'connected' | 'error' | 'closing' | 'closed';
  createdAt: Date;
  lastActivity: Date;
}

class LiveVoiceServer {
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, LiveSession> = new Map();
  private genAI: GoogleGenAI;
  private sessionTimeoutInterval: NodeJS.Timeout | null = null;
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.genAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
    });
  }

  public initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/live-voice'
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Live voice client connected');
      this.handleConnection(ws);
    });

    console.log('Live Voice WebSocket server initialized on /live-voice');
    
    // Start session timeout monitoring
    this.startSessionTimeoutMonitoring();
  }

  private async handleConnection(ws: WebSocket): Promise<void> {
    const sessionId = this.generateSessionId();
    
    try {
      // Create Gemini Live session
      const geminiSession = await this.genAI.live.connect({
        model: "gemini-live-2.5-flash-preview",
        callbacks: {
          onopen: () => {
            console.log(`Gemini session opened for ${sessionId}`);
            // Update session state to connected
            const session = this.sessions.get(sessionId);
            if (session) {
              session.sessionState = 'connected';
              session.lastActivity = new Date();
            }
            this.sendToClient(ws, {
              type: 'session_started',
              sessionId: sessionId
            });
          },
          onmessage: (message: any) => {
            this.handleGeminiMessage(sessionId, message);
          },
          onerror: (error: any) => {
            console.error('Gemini session error:', error);
            // Update session state to error
            const session = this.sessions.get(sessionId);
            if (session) {
              session.sessionState = 'error';
              session.lastActivity = new Date();
            }
            this.sendToClient(ws, {
              type: 'error',
              message: 'Gemini connection error'
            });
          },
          onclose: (event: any) => {
            console.log('Gemini session closed:', event.reason);
            // Update session state to closed
            const session = this.sessions.get(sessionId);
            if (session) {
              session.sessionState = 'closed';
              session.lastActivity = new Date();
            }
            this.cleanupSession(sessionId);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are a helpful AI financial advisor. Respond naturally in a conversational tone as if speaking to a friend. Keep responses concise but informative. Focus on practical financial advice, budgeting tips, investment guidance, and money management strategies."
        },
      });

      // Create session with enhanced state management
      const session: LiveSession = {
        id: sessionId,
        geminiSession,
        clientWs: ws,
        isActive: true,
        responseQueue: [],
        audioResponseBuffer: [],
        sessionState: 'connecting',
        createdAt: new Date(),
        lastActivity: new Date()
      };

      this.sessions.set(sessionId, session);

      // Handle client messages
      ws.on('message', (data: Buffer) => {
        console.log(`[DEBUG] WebSocket message received for session ${sessionId}, size: ${data.length} bytes`);
        this.handleClientMessage(sessionId, data);
      });

      ws.on('close', () => {
        console.log(`Client disconnected: ${sessionId}`);
        this.cleanupSession(sessionId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${sessionId}:`, error);
        this.cleanupSession(sessionId);
      });

    } catch (error) {
      console.error('Failed to create Gemini session:', error);
      this.sendToClient(ws, {
        type: 'error',
        message: 'Failed to initialize voice session'
      });
      ws.close();
    }
  }

  private handleClientMessage(sessionId: string, data: Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      console.log(`[DEBUG] Session check failed: session=${!!session}, isActive=${session?.isActive}, state=${session?.sessionState}`);
      return;
    }
    
    // Allow processing for both connecting and connected states
    if (session.sessionState !== 'connected' && session.sessionState !== 'connecting') {
      console.log(`[DEBUG] Session state check failed: ${session.sessionState}`);
      return;
    }
    
    // Update last activity timestamp
    session.lastActivity = new Date();

    const dataString = data.toString();
    console.log(`[DEBUG] Received raw message: ${dataString.substring(0, 100)}...`);
    
    // Handles cases where multiple JSON objects are sent in one packet
    const messages = dataString.replace(/}\s*{/g, '}}\n{').split('\n');

    for (const msg of messages) {
      if (msg.trim() === '') continue;

      try {
        if (msg.trim().startsWith('{')) {
          const message = JSON.parse(msg);
          
          switch (message.type) {
            case 'audio_chunk':
              console.log(`[AUDIO] Received audio chunk, mimeType: ${message.mimeType}, data length: ${message.data?.length || 0}`);
              this.handleAudioChunk(session, message.data, message.mimeType);
              break;
            case 'end_turn':
              console.log('Received end_turn message from client.');
              this.handleEndTurn(session);
              break;
            case 'ping':
              this.sendToClient(session.clientWs, { type: 'pong' });
              break;
            case 'session_info':
              // Send session information back to client
              const sessionInfo = this.getSessionInfo(sessionId);
              this.sendToClient(session.clientWs, {
                type: 'session_info_response',
                sessionInfo: sessionInfo
              });
              break;
            default:
              console.warn(`Unknown message type: ${message.type}`);
          }
        } else {
          console.warn('Received non-JSON data, ignoring');
        }
      } catch (error) {
        console.error('Error parsing client message:', error, 'Original message part:', msg);
      }
    }
  }

  private async handleAudioChunk(session: LiveSession, audioData: Buffer | string, mimeType?: string): Promise<void> {
    try {
      console.log('[AUDIO] Processing audio chunk...');
      // Convert client audio to required format (16-bit PCM, 16kHz, mono)
      const processedAudio = await this.processAudioForGemini(audioData, mimeType);
      console.log('[AUDIO] Audio conversion completed, sending to Gemini...');
      
      // Send to Gemini using sendRealtimeInput for audio (as recommended in docs)
      session.geminiSession.sendRealtimeInput({
        media: {
          data: processedAudio,
          mimeType: "audio/pcm;rate=16000"
        }
      });
      console.log('[AUDIO] Audio sent to Gemini successfully');
    } catch (error) {
      console.error('Error processing audio chunk:', error);
      this.sendToClient(session.clientWs, {
        type: 'error',
        message: 'Audio processing error'
      });
    }
  }

  private handleEndTurn(session: LiveSession): void {
    // Signal end of user input to Gemini - just stop sending audio, don't signal session end
    try {
      console.log('End of user turn detected - stopping audio input...');
      // Instead of sending turnComplete (which closes the session), 
      // we just stop sending audio and let Gemini naturally detect the end of speech
      // The Gemini Live API will automatically detect when audio input stops
      console.log('User turn ended - waiting for Gemini response...');
    } catch (error) {
      console.error('Error ending turn:', error);
    }
  }

  private handleGeminiMessage(sessionId: string, message: any): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return;

    try {
      console.log('[GEMINI] Received message from Gemini:', Object.keys(message));
      
      if (message.data) {
        console.log('[GEMINI] Received audio data from Gemini:', message.data.length, 'chars');
        session.audioResponseBuffer.push(Buffer.from(message.data, 'base64'));
      }

      if (message.serverContent) {
        if (message.serverContent.modelTurn) {
          const parts = message.serverContent.modelTurn.parts;
          for (const part of parts) {
            if (part.text) {
              this.sendToClient(session.clientWs, {
                type: 'transcript',
                text: part.text,
                isUser: false
              });
            }
          }
        }

        if (message.serverContent.turnComplete) {
          console.log('[GEMINI] Turn complete received, processing audio response...');
          if (session.audioResponseBuffer.length > 0) {
            const fullAudio = Buffer.concat(session.audioResponseBuffer);
            console.log(`[GEMINI] Sending ${fullAudio.length} bytes of audio to client`);
            const wavHeader = this.createWavHeader(fullAudio.length, 24000);
            const wavFile = Buffer.concat([wavHeader, fullAudio]);

            this.sendToClient(session.clientWs, {
              type: 'audio',
              audio: wavFile.toString('base64')
            });
            session.audioResponseBuffer = []; // Clear the buffer
            console.log('[GEMINI] Audio response sent to client');
          } else {
            console.log('[GEMINI] No audio response buffer to send');
          }
        }
      }

      if (message.clientContent) {
        if (message.clientContent.turns) {
          for (const turn of message.clientContent.turns) {
            if (turn.parts) {
              for (const part of turn.parts) {
                if (part.text) {
                  this.sendToClient(session.clientWs, {
                    type: 'transcription',
                    text: part.text,
                    isUser: true
                  });
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling Gemini message:', error);
    }
  }

  private async processAudioForGemini(audioData: Buffer | string, mimeType?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log(`Converting audio format: ${mimeType || 'unknown'} -> WAV PCM`);
      let buffer: Buffer;
      
      if (Buffer.isBuffer(audioData)) {
        buffer = audioData;
      } else {
        buffer = Buffer.from(audioData, 'base64');
      }
      
      if (mimeType && mimeType.includes('webm')) {
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        const inputFile = path.join(tempDir, `input_${Date.now()}.webm`);
        const outputFile = path.join(tempDir, `output_${Date.now()}.wav`);

        fs.writeFileSync(inputFile, buffer);

        const ffmpegPath = 'C:\\ffmpeg\\ffmpeg-7.1.1-essentials_build\\bin\\ffmpeg.exe'; // Make sure this path is correct
        const ffmpeg = spawn(ffmpegPath, [
          '-i', inputFile,
          '-ar', '16000',
          '-ac', '1',
          outputFile
        ]);

        ffmpeg.on('close', (code) => {
          fs.unlinkSync(inputFile); // Clean up input file
          if (code === 0) {
            const wavBuffer = fs.readFileSync(outputFile);
            fs.unlinkSync(outputFile); // Clean up output file
            resolve(wavBuffer.toString('base64'));
          } else {
            reject(`ffmpeg exited with code ${code}`);
          }
        });

        ffmpeg.stderr.on('data', (data) => {
          console.error(`ffmpeg stderr: ${data}`);
        });

      } else if (mimeType && mimeType.includes('pcm')) {
        // Already in the correct PCM format, just return as base64
        resolve(buffer.toString('base64'));
      } else {
        const wav = new WaveFile();
        wav.fromBuffer(buffer);
        wav.toSampleRate(16000);
        wav.toBitDepth("16");
        resolve(wav.toBase64());
      }
    });
  }

  private sendToClient(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private createWavHeader(dataLength: number, sampleRate: number): Buffer {
    const header = Buffer.alloc(44);
    
    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write('WAVE', 8);
    
    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // chunk size
    header.writeUInt16LE(1, 20);  // PCM format
    header.writeUInt16LE(1, 22);  // mono
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28); // byte rate
    header.writeUInt16LE(2, 32);  // block align
    header.writeUInt16LE(16, 34); // bits per sample
    
    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);
    
    return header;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`Cleaning up session ${sessionId} (state: ${session.sessionState})`);
      
      // Update session state to closing
      session.sessionState = 'closing';
      session.isActive = false;
      session.lastActivity = new Date();
      
      // Close Gemini session using proper close() method from docs
      if (session.geminiSession) {
        try {
          console.log(`Calling session.close() for Gemini session ${sessionId}`);
          session.geminiSession.close(); // Explicit close as per documentation
          console.log(`Gemini session closed successfully for ${sessionId}`);
        } catch (error) {
          console.error(`Error closing Gemini session ${sessionId}:`, error);
        }
      }
      
      // Close client WebSocket
      if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
        try {
          session.clientWs.close(1000, 'Session cleanup');
        } catch (error) {
          console.error(`Error closing WebSocket for session ${sessionId}:`, error);
        }
      }
      
      // Final state update
      session.sessionState = 'closed';
      
      this.sessions.delete(sessionId);
      console.log(`Session cleaned up successfully: ${sessionId}`);
    }
  }

  public getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  private startSessionTimeoutMonitoring(): void {
    // Check for inactive sessions every 5 minutes
    this.sessionTimeoutInterval = setInterval(() => {
      const now = new Date();
      const sessionsToCleanup: string[] = [];
      
      for (const [sessionId, session] of this.sessions) {
        const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
        
        if (timeSinceLastActivity > this.SESSION_TIMEOUT_MS) {
          console.log(`Session ${sessionId} timed out (inactive for ${Math.round(timeSinceLastActivity / 1000 / 60)} minutes)`);
          sessionsToCleanup.push(sessionId);
        }
      }
      
      // Cleanup timed out sessions
      for (const sessionId of sessionsToCleanup) {
        this.cleanupSession(sessionId);
      }
      
      if (sessionsToCleanup.length > 0) {
        console.log(`Cleaned up ${sessionsToCleanup.length} timed out sessions`);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    console.log('Session timeout monitoring started (30 minute timeout)');
  }

  private stopSessionTimeoutMonitoring(): void {
    if (this.sessionTimeoutInterval) {
      clearInterval(this.sessionTimeoutInterval);
      this.sessionTimeoutInterval = null;
      console.log('Session timeout monitoring stopped');
    }
  }

  public getSessionInfo(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    return {
      id: session.id,
      state: session.sessionState,
      isActive: session.isActive,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      uptime: new Date().getTime() - session.createdAt.getTime()
    };
  }

  public getAllSessionsInfo(): any[] {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      state: session.sessionState,
      isActive: session.isActive,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      uptime: new Date().getTime() - session.createdAt.getTime()
    }));
  }

  public cleanup(): void {
    console.log('Starting LiveVoiceServer cleanup...');
    
    // Stop session monitoring
    this.stopSessionTimeoutMonitoring();
    
    // Cleanup all sessions
    for (const [sessionId] of this.sessions) {
      this.cleanupSession(sessionId);
    }
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }
    
    console.log('LiveVoiceServer cleanup completed');
  }
}

// Export singleton instance
export const liveVoiceServer = new LiveVoiceServer();

// Export initialization function
export function initializeLiveVoiceServer(server: Server): void {
  liveVoiceServer.initialize(server);
}