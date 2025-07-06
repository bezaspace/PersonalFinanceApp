import { Platform } from 'react-native';
import { Audio as ExpoAudio } from 'expo-av';

const WS_URL = 'ws://192.168.1.36:3000/live-voice';

export interface VoiceMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  hasAudio?: boolean;
}

export interface LiveVoiceCallbacks {
  onMessage: (message: VoiceMessage) => void;
  onConnectionChange: (connected: boolean) => void;
  onError: (error: string) => void;
  onRecordingChange: (isRecording: boolean) => void;
  onAiSpeaking: (isAiSpeaking: boolean) => void;
}

class LiveVoiceService {
  private ws: WebSocket | null = null;
  private sound: ExpoAudio.Sound | null = null;
  private callbacks: LiveVoiceCallbacks | null = null;
  private isSessionActive = false;
  private isRecording = false;
  private isAiSpeaking = false;
  private audioQueue: string[] = [];
  private isProcessingAudio = false;

  // Web-specific resources
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private currentAudio: HTMLAudioElement | null = null;

  private setRecordingStatus(isRecording: boolean) {
    this.isRecording = isRecording;
    this.callbacks?.onRecordingChange(isRecording);
  }

  private setAiSpeakingStatus(isAiSpeaking: boolean) {
    this.isAiSpeaking = isAiSpeaking;
    this.callbacks?.onAiSpeaking(isAiSpeaking);
  }

  // Add page visibility change handler for web
  private handleVisibilityChange = () => {
    if (Platform.OS === 'web' && document.hidden && this.currentAudio) {
      this.currentAudio.pause();
      this.setAiSpeakingStatus(false);
    }
  };

  async startSession(callbacks: LiveVoiceCallbacks) {
    if (this.isSessionActive) return;
    this.isSessionActive = true;
    this.callbacks = callbacks;

    try {
      if (Platform.OS !== 'web') {
        await ExpoAudio.requestPermissionsAsync();
        await ExpoAudio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      } else {
        // Add visibility change listener for web
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
      }

      this.ws = new WebSocket(WS_URL);
      this.ws.onopen = () => this.callbacks?.onConnectionChange(true);
      this.ws.onclose = () => {
        this.callbacks?.onConnectionChange(false);
        this.endSession();
      };
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.callbacks?.onError('WebSocket connection error.');
      };
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'transcript' || data.type === 'transcription') {
          const message: VoiceMessage = {
            id: data.id || Date.now().toString(),
            text: data.text,
            isUser: data.isUser,
            timestamp: new Date(),
          };
          this.callbacks?.onMessage(message);
        } else if (data.type === 'audio') {
          this.playAudio(data.audio);
        }
      };
    } catch (error) {
      console.error('Failed to start voice session:', error);
      this.callbacks?.onError('Failed to initialize audio system.');
      this.endSession();
    }
  }

  async endSession() {
    if (!this.isSessionActive) return;
    this.isSessionActive = false;
    
    if (this.isRecording) {
      await this.stopRecording();
    }
    
    // Clean up WebSocket
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    
    // Clean up audio based on platform
    if (Platform.OS === 'web') {
      // Remove visibility change listener
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      
      // Clean up web audio
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.removeEventListener('ended', this.onAudioEnded);
        this.currentAudio.removeEventListener('error', this.onAudioError);
        this.currentAudio.src = '';
        this.currentAudio = null;
      }
    } else {
      // Clean up Expo audio
      if (this.sound) {
        try {
          this.sound.setOnPlaybackStatusUpdate(null);
          await this.sound.stopAsync();
          await this.sound.unloadAsync();
        } catch (error) {
          console.error('Error cleaning up sound:', error);
        }
        this.sound = null;
      }
    }

    // Reset status
    this.setAiSpeakingStatus(false);
    this.setRecordingStatus(false);
    
    this.callbacks = null;
  }

  async startRecording() {
    if (this.isRecording || !this.ws) return;
    this.setRecordingStatus(true);
    this.audioChunks = [];

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.mediaStream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        try {
          if (this.audioChunks.length === 0) return;
          
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          
          reader.onload = () => {
            try {
              if (this.ws?.readyState !== WebSocket.OPEN) return;
              const base64Audio = (reader.result as string).split(',')[1];
              this.ws.send(JSON.stringify({
                type: 'audio_chunk',
                data: base64Audio,
                mimeType: 'audio/webm'
              }));
              // Immediately send end_turn after the audio
              this.ws.send(JSON.stringify({ type: 'end_turn' }));
            } catch (error) {
              console.error('Error sending audio data:', error);
            }
          };
          
          reader.onerror = (error) => {
            console.error('Error reading audio file:', error);
          };
          
          reader.readAsDataURL(audioBlob);
        } catch (error) {
          console.error('Error processing recorded audio:', error);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        this.callbacks?.onError('Recording error occurred.');
        this.setRecordingStatus(false);
      };

      this.mediaRecorder.start();
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.callbacks?.onError('Failed to start recording. Please check microphone permissions.');
      this.setRecordingStatus(false);
    }
  }

  async stopRecording() {
    if (!this.isRecording) return;
    this.setRecordingStatus(false);

    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  }

  private async playAudio(audioData: string) {
    if (this.isAiSpeaking) {
      // If AI is already speaking, stop the current sound before playing the new one.
      if (Platform.OS === 'web') {
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio.removeEventListener('ended', this.onAudioEnded);
          this.currentAudio.removeEventListener('error', this.onAudioError);
          this.currentAudio.src = '';
          this.currentAudio = null;
        }
      } else {
        if (this.sound) {
          try {
            await this.sound.stopAsync();
            await this.sound.unloadAsync();
          } catch (error) {
            console.error('Error stopping current sound:', error);
          }
          this.sound = null;
        }
      }
    }

    this.setAiSpeakingStatus(true);

    try {
      if (Platform.OS === 'web') {
        // Use HTML5 Audio for web to avoid Expo Audio issues
        this.playAudioWeb(audioData);
      } else {
        // Use Expo Audio for native platforms
        const { sound } = await ExpoAudio.Sound.createAsync(
          { uri: `data:audio/wav;base64,${audioData}` },
          { shouldPlay: true }
        );
        this.sound = sound;
        
        // Set up status update handler with proper error handling
        const statusUpdateHandler = async (status: any) => {
          try {
            if (status.isLoaded && status.didJustFinish) {
              this.setAiSpeakingStatus(false);
              // Remove the status update handler before unloading
              if (this.sound) {
                this.sound.setOnPlaybackStatusUpdate(null);
                await this.sound.unloadAsync();
                this.sound = null;
              }
            }
          } catch (error) {
            console.error('Error in playback status update:', error);
            this.setAiSpeakingStatus(false);
            this.sound = null;
          }
        };
        
        sound.setOnPlaybackStatusUpdate(statusUpdateHandler);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      this.setAiSpeakingStatus(false);
    }
  }

  private playAudioWeb(audioData: string) {
    // Stop current audio if playing
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.removeEventListener('ended', this.onAudioEnded);
      this.currentAudio.removeEventListener('error', this.onAudioError);
      this.currentAudio.src = '';
      this.currentAudio = null;
    }

    try {
      // Use the global Audio constructor for HTML5 audio
      this.currentAudio = new (window as any).Audio(`data:audio/wav;base64,${audioData}`);
      if (this.currentAudio) {
        this.currentAudio.addEventListener('ended', this.onAudioEnded);
        this.currentAudio.addEventListener('error', this.onAudioError);
        this.currentAudio.play().catch((error: any) => {
          console.error('Error playing audio:', error);
          this.setAiSpeakingStatus(false);
        });
      }
    } catch (error) {
      console.error('Error playing web audio:', error);
      this.setAiSpeakingStatus(false);
    }
  }

  private onAudioEnded = () => {
    this.setAiSpeakingStatus(false);
    if (this.currentAudio) {
      this.currentAudio.removeEventListener('ended', this.onAudioEnded);
      this.currentAudio.removeEventListener('error', this.onAudioError);
      this.currentAudio = null;
    }
  };

  private onAudioError = (error: any) => {
    console.error('Web audio error:', error);
    this.setAiSpeakingStatus(false);
    if (this.currentAudio) {
      this.currentAudio.removeEventListener('ended', this.onAudioEnded);
      this.currentAudio.removeEventListener('error', this.onAudioError);
      this.currentAudio = null;
    }
  };
}

export const liveVoiceService = new LiveVoiceService();