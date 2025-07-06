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
}

class LiveVoiceServer {
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, LiveSession> = new Map();
  private genAI: GoogleGenAI;

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
            this.sendToClient(ws, {
              type: 'error',
              message: 'Gemini connection error'
            });
          },
          onclose: (event: any) => {
            console.log('Gemini session closed:', event.reason);
            this.cleanupSession(sessionId);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are a helpful AI financial advisor. Respond naturally in a conversational tone as if speaking to a friend. Keep responses concise but informative. Focus on practical financial advice, budgeting tips, investment guidance, and money management strategies."
        },
      });

      // Create session
      const session: LiveSession = {
        id: sessionId,
        geminiSession,
        clientWs: ws,
        isActive: true,
        responseQueue: [],
        audioResponseBuffer: []
      };

      this.sessions.set(sessionId, session);

      // Handle client messages
      ws.on('message', (data: Buffer) => {
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
    if (!session || !session.isActive) return;

    const dataString = data.toString();
    // Handles cases where multiple JSON objects are sent in one packet
    const messages = dataString.replace(/}\s*{/g, '}}\n{').split('\n');

    for (const msg of messages) {
      if (msg.trim() === '') continue;

      try {
        if (msg.trim().startsWith('{')) {
          const message = JSON.parse(msg);
          
          switch (message.type) {
            case 'audio_chunk':
              console.log(`Received audio chunk, mimeType: ${message.mimeType}, data length: ${message.data?.length || 0}`);
              this.handleAudioChunk(session, message.data, message.mimeType);
              break;
            case 'end_turn':
              console.log('Received end_turn message from client.');
              this.handleEndTurn(session);
              break;
            case 'ping':
              this.sendToClient(session.clientWs, { type: 'pong' });
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
      console.log('Processing audio chunk...');
      // Convert client audio to required format (16-bit PCM, 16kHz, mono)
      const processedAudio = await this.processAudioForGemini(audioData, mimeType);
      console.log('Audio conversion completed, sending to Gemini...');
      
      // Send to Gemini
      session.geminiSession.sendRealtimeInput({
        audio: {
          data: processedAudio,
          mimeType: "audio/pcm;rate=16000"
        }
      });
      console.log('Audio sent to Gemini successfully');
    } catch (error) {
      console.error('Error processing audio chunk:', error);
      this.sendToClient(session.clientWs, {
        type: 'error',
        message: 'Audio processing error'
      });
    }
  }

  private handleEndTurn(session: LiveSession): void {
    // Signal end of user input to Gemini
    try {
      console.log('Signaling turn completion to Gemini...');
      session.geminiSession.sendRealtimeInput({
        turnComplete: true
      });
      console.log('Successfully signaled turn completion.');
    } catch (error) {
      console.error('Error ending turn:', error);
    }
  }

  private handleGeminiMessage(sessionId: string, message: any): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return;

    try {
      if (message.data) {
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
          if (session.audioResponseBuffer.length > 0) {
            const fullAudio = Buffer.concat(session.audioResponseBuffer);
            const wavHeader = this.createWavHeader(fullAudio.length, 24000);
            const wavFile = Buffer.concat([wavHeader, fullAudio]);

            this.sendToClient(session.clientWs, {
              type: 'audio',
              audio: wavFile.toString('base64')
            });
            session.audioResponseBuffer = []; // Clear the buffer
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
      session.isActive = false;
      
      // Close Gemini session
      if (session.geminiSession) {
        try {
          session.geminiSession.close();
        } catch (error) {
          console.error('Error closing Gemini session:', error);
        }
      }
      
      // Close client WebSocket
      if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
        session.clientWs.close();
      }
      
      this.sessions.delete(sessionId);
      console.log(`Session cleaned up: ${sessionId}`);
    }
  }

  public getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  public cleanup(): void {
    // Cleanup all sessions
    for (const [sessionId] of this.sessions) {
      this.cleanupSession(sessionId);
    }
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }
  }
}

// Export singleton instance
export const liveVoiceServer = new LiveVoiceServer();

// Export initialization function
export function initializeLiveVoiceServer(server: Server): void {
  liveVoiceServer.initialize(server);
}