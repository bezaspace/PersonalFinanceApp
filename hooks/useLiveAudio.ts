// React hook for managing Gemini Live Audio WebSocket connections
import { useState, useEffect, useRef, useCallback } from 'react';
import { LiveAudioWebSocketService, LiveAudioCallbacks, playAudioFromBase64 } from '../services/LiveAudioWebSocketService';

interface LiveAudioState {
  isConnected: boolean;
  isSessionActive: boolean;
  isConnecting: boolean;
  sessionId: string | null;
  error: string | null;
}

interface UseLiveAudioOptions {
  serverUrl?: string;
  autoConnect?: boolean;
  onAudioReceived?: (audioData: string, mimeType: string) => void;
  onError?: (error: string) => void;
}

interface UseLiveAudioReturn {
  // State
  state: LiveAudioState;
  
  // Actions
  connect: () => Promise<boolean>;
  disconnect: () => void;
  startSession: () => Promise<boolean>;
  stopSession: () => void;
  sendAudio: (audioUri: string) => Promise<boolean>;
  sendAudioBuffer: (audioBuffer: ArrayBuffer, mimeType?: string) => boolean;
  playReceivedAudio: (audioData: string, mimeType?: string) => Promise<void>;
  
  // Service reference
  service: React.MutableRefObject<LiveAudioWebSocketService | null>;
}

const DEFAULT_SERVER_URL = 'ws://localhost:3000/live-audio';

export function useLiveAudio(options: UseLiveAudioOptions = {}): UseLiveAudioReturn {
  const {
    serverUrl = DEFAULT_SERVER_URL,
    autoConnect = false,
    onAudioReceived,
    onError
  } = options;

  const [state, setState] = useState<LiveAudioState>({
    isConnected: false,
    isSessionActive: false,
    isConnecting: false,
    sessionId: null,
    error: null
  });

  const serviceRef = useRef<LiveAudioWebSocketService | null>(null);
  const receivedAudioQueue = useRef<Array<{ data: string; mimeType: string }>>([]);
  const isPlayingAudio = useRef(false);

  // Initialize service and callbacks
  useEffect(() => {
    const callbacks: LiveAudioCallbacks = {
      onConnectionEstablished: (sessionId: string) => {
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          sessionId,
          error: null
        }));
      },

      onSessionStarted: () => {
        setState(prev => ({
          ...prev,
          isSessionActive: true,
          error: null
        }));
      },

      onSessionStopped: () => {
        setState(prev => ({
          ...prev,
          isSessionActive: false
        }));
      },

      onAudioReceived: (audioData: string, mimeType: string) => {
        // Queue audio for playback
        receivedAudioQueue.current.push({ data: audioData, mimeType });
        
        // Play audio if not already playing
        if (!isPlayingAudio.current) {
          playNextAudio();
        }

        // Call external callback if provided
        onAudioReceived?.(audioData, mimeType);
      },

      onError: (error: string) => {
        setState(prev => ({
          ...prev,
          error,
          isConnecting: false
        }));
        onError?.(error);
      },

      onConnectionClosed: () => {
        setState(prev => ({
          ...prev,
          isConnected: false,
          isSessionActive: false,
          isConnecting: false,
          sessionId: null
        }));
      }
    };

    serviceRef.current = new LiveAudioWebSocketService(serverUrl, callbacks);

    return () => {
      if (serviceRef.current) {
        serviceRef.current.disconnect();
      }
    };
  }, [serverUrl, onAudioReceived, onError]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && serviceRef.current && !state.isConnected && !state.isConnecting) {
      connect();
    }
  }, [autoConnect]);

  // Play queued audio sequentially
  const playNextAudio = useCallback(async () => {
    if (receivedAudioQueue.current.length === 0) {
      isPlayingAudio.current = false;
      return;
    }

    isPlayingAudio.current = true;
    const { data, mimeType } = receivedAudioQueue.current.shift()!;

    try {
      await playAudioFromBase64(data, mimeType);
    } catch (error) {
      console.error('Failed to play received audio:', error);
    }

    // Play next audio in queue
    setTimeout(() => playNextAudio(), 100); // Small delay between audio clips
  }, []);

  // Actions
  const connect = useCallback(async (): Promise<boolean> => {
    if (!serviceRef.current || state.isConnected || state.isConnecting) {
      return false;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const success = await serviceRef.current.connect();
      if (!success) {
        setState(prev => ({ ...prev, isConnecting: false }));
      }
      return success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }));
      return false;
    }
  }, [state.isConnected, state.isConnecting]);

  const disconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
    }
    // Clear audio queue
    receivedAudioQueue.current = [];
    isPlayingAudio.current = false;
  }, []);

  const startSession = useCallback(async (): Promise<boolean> => {
    if (!serviceRef.current || !state.isConnected) {
      return false;
    }

    try {
      return await serviceRef.current.startLiveSession();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start session'
      }));
      return false;
    }
  }, [state.isConnected]);

  const stopSession = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.stopLiveSession();
    }
  }, []);

  const sendAudio = useCallback(async (audioUri: string): Promise<boolean> => {
    if (!serviceRef.current || !state.isSessionActive) {
      return false;
    }

    try {
      return await serviceRef.current.sendAudio(audioUri);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to send audio'
      }));
      return false;
    }
  }, [state.isSessionActive]);

  const sendAudioBuffer = useCallback((audioBuffer: ArrayBuffer, mimeType: string = 'audio/wav'): boolean => {
    if (!serviceRef.current || !state.isSessionActive) {
      return false;
    }

    try {
      return serviceRef.current.sendAudioBuffer(audioBuffer, mimeType);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to send audio buffer'
      }));
      return false;
    }
  }, [state.isSessionActive]);

  const playReceivedAudio = useCallback(async (audioData: string, mimeType: string = 'audio/wav'): Promise<void> => {
    try {
      await playAudioFromBase64(audioData, mimeType);
    } catch (error) {
      throw new Error(`Failed to play audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  return {
    state,
    connect,
    disconnect,
    startSession,
    stopSession,
    sendAudio,
    sendAudioBuffer,
    playReceivedAudio,
    service: serviceRef
  };
}

// Helper hook for recording audio and sending it via live audio
export function useLiveAudioRecording(liveAudio: UseLiveAudioReturn) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const recordingRef = useRef<any>(null);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const { Audio } = require('expo-av');
      
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('Audio recording permission denied');
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      return true;

    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    try {
      if (!recordingRef.current) {
        return null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingUri(uri);

      return uri;

    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      return null;
    }
  }, []);

  const sendRecording = useCallback(async (): Promise<boolean> => {
    if (!recordingUri) {
      return false;
    }

    return await liveAudio.sendAudio(recordingUri);
  }, [recordingUri, liveAudio]);

  const recordAndSend = useCallback(async (): Promise<boolean> => {
    const uri = await stopRecording();
    if (uri) {
      return await liveAudio.sendAudio(uri);
    }
    return false;
  }, [stopRecording, liveAudio]);

  return {
    isRecording,
    recordingUri,
    startRecording,
    stopRecording,
    sendRecording,
    recordAndSend
  };
}
