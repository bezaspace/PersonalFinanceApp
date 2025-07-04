// Gemini Live Audio Service - WebSocket Implementation

import { GoogleGenAI, Modality } from '@google/genai';
import WebSocket from 'ws';

// GoogleGenAI instance will be initialized after dotenv is loaded
let ai: GoogleGenAI;

// Native audio output model for live conversations (correct model name)
const model = "gemini-live-2.5-flash-preview";

const config = {
  responseModalities: [Modality.AUDIO],
  systemInstruction: "You are a helpful financial assistant. Provide concise, friendly advice about budgeting, spending, saving, and financial planning. Keep responses conversational and practical."
};

// Initialize GoogleGenAI with API key (called after dotenv.config())
export function initializeGoogleGenAI() {
  console.log('[GEMINI-INIT] Initializing GoogleGenAI...');
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  console.log('[GEMINI-INIT] GoogleGenAI initialized successfully');
}

// Store active Gemini Live sessions
const activeSessions = new Map<string, any>();

interface LiveAudioMessage {
  type: 'audio' | 'control';
  sessionId?: string;
  audioData?: string; // base64 encoded audio
  action?: 'start' | 'stop' | 'pause';
  mimeType?: string;
}

/**
 * Handles WebSocket connection for live audio streaming with Gemini
 */
export class GeminiLiveWebSocketHandler {
  private ws: WebSocket;
  private sessionId: string;
  private geminiSession: any;
  private isSessionActive = false;

  constructor(ws: WebSocket, sessionId: string) {
    this.ws = ws;
    this.sessionId = sessionId;
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers() {
    console.log(`[GEMINI-WS-${this.sessionId}] Setting up WebSocket handlers`);
    
    this.ws.on('message', async (data: Buffer) => {
      try {
        const message: LiveAudioMessage = JSON.parse(data.toString());
        await this.handleMessage(message);
      } catch (error) {
        console.error(`[GEMINI-WS-${this.sessionId}] Error processing WebSocket message:`, error);
        this.sendError('Invalid message format');
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[GEMINI-WS-${this.sessionId}] WebSocket closed - Code: ${code}, Reason: ${reason}`);
      this.cleanup();
    });

    this.ws.on('error', (error) => {
      console.error(`[GEMINI-WS-${this.sessionId}] WebSocket error:`, error);
      this.cleanup();
    });
  }

  private async handleMessage(message: LiveAudioMessage) {
    switch (message.type) {
      case 'control':
        await this.handleControlMessage(message);
        break;
      case 'audio':
        await this.handleAudioMessage(message);
        break;
      default:
        this.sendError('Unknown message type');
    }
  }

  private async handleControlMessage(message: LiveAudioMessage) {
    switch (message.action) {
      case 'start':
        await this.startGeminiSession();
        break;
      case 'stop':
        await this.stopGeminiSession();
        break;
    }
  }

  private async handleAudioMessage(message: LiveAudioMessage) {
    if (!this.isSessionActive || !this.geminiSession || !message.audioData) {
      console.log(`[GEMINI-WS-${this.sessionId}] Skipping audio message - session not ready.`);
      return;
    }

    try {
      // Directly send the base64 audio data from the client
      this.geminiSession.sendRealtimeInput({
        audio: {
          data: message.audioData,
          mimeType: "audio/pcm;rate=16000" // Client must send in this format
        }
      });
    } catch (error) {
      console.error(`[GEMINI-WS-${this.sessionId}] ❌ Error processing audio:`, error);
      this.sendError('Failed to process audio');
    }
  }

  private async startGeminiSession() {
    try {
      this.geminiSession = await ai.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            console.log(`[GEMINI-WS-${this.sessionId}] ✅ Gemini Live session opened`);
            this.isSessionActive = true;
            this.sendControl('session_started');
          },
          onmessage: (message: any) => {
            if (message.serverContent && message.serverContent.audioChunk) {
              const audioData = message.serverContent.audioChunk.data;
              this.sendAudioResponse(audioData);
            }
            if (message.serverContent && message.serverContent.turnComplete) {
              this.sendControl('turn_complete');
            }
          },
          onerror: (error: any) => {
            console.error(`[GEMINI-WS-${this.sessionId}] Gemini onerror:`, error);
            this.sendError('Gemini session error');
          },
          onclose: () => {
            console.log(`[GEMINI-WS-${this.sessionId}] ❌ Gemini Live session closed`);
            this.isSessionActive = false;
            this.sendControl('session_ended');
          },
        },
        config: config,
      });

      activeSessions.set(this.sessionId, this.geminiSession);

    } catch (error) {
      console.error(`[GEMINI-WS-${this.sessionId}] ❌ Failed to start Gemini session:`, error);
      this.sendError('Failed to start live session');
    }
  }

  private async stopGeminiSession() {
    if (this.geminiSession) {
      this.geminiSession.close();
      this.geminiSession = null;
      this.isSessionActive = false;
      activeSessions.delete(this.sessionId);
      this.sendControl('session_stopped');
    }
  }

  private sendAudioResponse(audioData: string) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'audio_response',
        audioData: audioData, // This is a chunk, not a full WAV
        mimeType: 'audio/pcm'
      }));
    }
  }

  private sendControl(action: string) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'control_response',
        action: action,
        sessionId: this.sessionId
      }));
    }
  }

  private sendError(error: string) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'error',
        error: error
      }));
    }
  }

  private cleanup() {
    if (this.geminiSession) {
      this.geminiSession.close();
    }
    activeSessions.delete(this.sessionId);
    this.isSessionActive = false;
  }
}
