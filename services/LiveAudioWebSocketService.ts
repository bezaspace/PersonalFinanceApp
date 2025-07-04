// Live Audio WebSocket Service for React Native
// Handles real-time audio communication with Gemini Live API via WebSocket

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface LiveAudioMessage {
  type: 'audio' | 'control' | 'audio_response' | 'control_response' | 'connection_established' | 'error';
  sessionId?: string;
  audioData?: string; // base64 encoded audio
  action?: 'start' | 'stop' | 'pause' | 'session_started' | 'session_stopped' | 'session_ended' | 'turn_complete';
  mimeType?: string;
  error?: string;
  message?: string;
}

export interface LiveAudioCallbacks {
  onConnectionEstablished?: (sessionId: string) => void;
  onSessionStarted?: () => void;
  onSessionStopped?: () => void;
  onAudioReceived?: (audioData: string, mimeType: string) => void;
  onTurnComplete?: () => void;
  onError?: (error: string) => void;
  onConnectionClosed?: () => void;
}

export class LiveAudioWebSocketService {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private sessionId: string | null = null;
  private callbacks: LiveAudioCallbacks;
  private isConnected = false;
  private isSessionActive = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000; // 1 second

  constructor(serverUrl: string, callbacks: LiveAudioCallbacks = {}) {
    this.serverUrl = serverUrl;
    this.callbacks = callbacks;
  }

  async connect(): Promise<boolean> {
    // ... (connection logic remains the same)
  }

  disconnect(): void {
    // ... (disconnect logic remains the same)
  }

  async startLiveSession(): Promise<boolean> {
    // ... (startLiveSession logic remains the same)
  }

  stopLiveSession(): void {
    // ... (stopLiveSession logic remains the same)
  }

  async sendAudio(audioUri: string): Promise<boolean> {
    // ... (sendAudio logic remains the same)
  }

  sendAudioBuffer(audioBuffer: ArrayBuffer, mimeType: string = 'audio/wav'): boolean {
    // ... (sendAudioBuffer logic remains the same)
  }

  getConnectionStatus(): { isConnected: boolean; isSessionActive: boolean; sessionId: string | null } {
    return {
      isConnected: this.isConnected,
      isSessionActive: this.isSessionActive,
      sessionId: this.sessionId
    };
  }

  private handleMessage(data: string): void {
    try {
      const message: LiveAudioMessage = JSON.parse(data);
      
      switch (message.type) {
        case 'connection_established':
          this.sessionId = message.sessionId || null;
          this.callbacks.onConnectionEstablished?.(this.sessionId!);
          break;

        case 'control_response':
          this.handleControlResponse(message);
          break;

        case 'audio_response':
          if (message.audioData && message.mimeType) {
            this.callbacks.onAudioReceived?.(message.audioData, message.mimeType);
          }
          break;

        case 'error':
          this.callbacks.onError?.(message.error || 'Unknown error');
          break;

        default:
          console.log('Received unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.callbacks.onError?.('Invalid message received');
    }
  }

  private handleControlResponse(message: LiveAudioMessage): void {
    switch (message.action) {
      case 'session_started':
        this.isSessionActive = true;
        this.callbacks.onSessionStarted?.();
        break;

      case 'session_stopped':
      case 'session_ended':
        this.isSessionActive = false;
        this.callbacks.onSessionStopped?.();
        break;

      case 'turn_complete':
        this.callbacks.onTurnComplete?.();
        break;
    }
  }

  private sendMessage(message: LiveAudioMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  private attemptReconnect(): void {
    // ... (reconnect logic remains the same)
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    // ... (arrayBufferToBase64 logic remains the same)
  }
}

export async function playAudioFromBase64(base64Audio: string, mimeType: string = 'audio/wav'): Promise<void> {
  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: `data:${mimeType};base64,${base64Audio}` },
      { shouldPlay: true }
    );

    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (status.isLoaded && status.didJustFinish) {
        await sound.unloadAsync();
      }
    });
  } catch (error) {
    console.error('Failed to play audio:', error);
    throw error;
  }
}
