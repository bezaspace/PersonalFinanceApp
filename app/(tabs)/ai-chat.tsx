import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  SafeAreaView, 
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { Send, Bot, User, Lightbulb, Mic, StopCircle } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { colors } from '@/constants/colors';
import { globalStyles } from '@/constants/styles';
import { apiService } from '@/services/api';
import { LiveAudioWebSocketService, playAudioFromBase64 } from '@/services/LiveAudioWebSocketService';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function AIChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your AI financial advisor. I can help you with budgeting, saving strategies, investment advice, and answer any questions about your finances. What would you like to know?",
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const wsServiceRef = useRef<LiveAudioWebSocketService | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<number | null>(null);

  const audioChunks = useRef<string[]>([]);

  // Initialize WebSocket service
  const initializeWebSocketService = () => {
    if (!wsServiceRef.current) {
      const serverUrl = 'ws://192.168.1.36:3000/live-audio';
      wsServiceRef.current = new LiveAudioWebSocketService(serverUrl, {
        onConnectionEstablished: (sessionId) => {
          console.log('Connection established with session ID:', sessionId);
          setSessionId(sessionId);
          setIsConnected(true);
          setError(null);
        },
        onSessionStarted: () => {
          console.log('Live session started');
          setIsSessionActive(true);
        },
        onSessionStopped: () => {
          console.log('Live session stopped');
          setIsSessionActive(false);
        },
        onAudioReceived: async (audioData, mimeType) => {
          audioChunks.current.push(audioData);
        },
        onTurnComplete: async () => {
          const combinedAudio = audioChunks.current.join('');
          audioChunks.current = [];
          try {
            setIsPlaying(true);
            await playAudioFromBase64(combinedAudio, 'audio/pcm');
            setIsPlaying(false);
          } catch (error) {
            console.error('Failed to play audio:', error);
            setError('Failed to play audio response');
            setIsPlaying(false);
          }
        },
        onError: (error) => {
          console.error('WebSocket service error:', error);
          setError(error);
        },
        onConnectionClosed: () => {
          console.log('Connection closed');
          setIsConnected(false);
          setIsSessionActive(false);
          setSessionId(null);
        }
      });
    }
  };

  // Connect to WebSocket
  const connectWebSocket = async () => {
    initializeWebSocketService();
    if (wsServiceRef.current) {
      try {
        await wsServiceRef.current.connect();
      } catch (error) {
        console.error('Failed to connect:', error);
        setError('Failed to connect to live audio service');
      }
    }
  };

  // Microphone permission
  const getMicrophonePermission = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Microphone permission required', 'Please enable microphone access in settings.');
      return false;
    }
    return true;
  };

  // Start/stop recording and streaming
  const startRecording = async () => {
    console.log('[FRONTEND-VOICE] Starting recording process');
    const hasPermission = await getMicrophonePermission();
    if (!hasPermission) {
      console.log('[FRONTEND-VOICE] Microphone permission denied');
      return;
    }
    console.log('[FRONTEND-VOICE] Microphone permission granted');
    
    // Ensure we're connected and start the session
    if (!isConnected) {
      console.log('[FRONTEND-VOICE] Not connected, attempting WebSocket connection');
      await connectWebSocket();
    }
    
    if (wsServiceRef.current && !isSessionActive) {
      console.log('[FRONTEND-VOICE] Starting live session');
      await wsServiceRef.current.startLiveSession();
    }
    
    setIsRecording(true);
    console.log('[FRONTEND-VOICE] Recording state set to true');

    try {
      console.log('[FRONTEND-VOICE] Setting audio mode');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('[FRONTEND-VOICE] Creating recording instance');
      const recording = new Audio.Recording();
      const recordingOptions = {
          android: {
            extension: '.wav',
            outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
            audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_PCM,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 256000,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM,
            audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 256000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
        };
      await recording.prepareToRecordAsync(recordingOptions);
      console.log('[FRONTEND-VOICE] Recording prepared, starting recording');
      await recording.startAsync();
      recordingRef.current = recording;
      console.log('[FRONTEND-VOICE] ✅ Recording started successfully');

      // Send complete recording when finished (not streaming chunks)
      // For real-time streaming, we'd need to implement chunk recording
      
    } catch (err) {
      console.error('[FRONTEND-VOICE] ❌ Failed to start recording:', err);
      setError('Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        
        // Get the recording URI and send it to the WebSocket service
        const uri = recordingRef.current.getURI();
        if (uri && wsServiceRef.current && isSessionActive) {
          await wsServiceRef.current.sendAudio(uri);
        }
      } catch (error) {
        console.error('Failed to stop recording:', error);
        setError('Failed to process recording');
      }
      recordingRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
      if (wsServiceRef.current) {
        wsServiceRef.current.disconnect();
      }
    };
  }, []);

  const quickPrompts = [
    "How can I save more money?",
    "What's a good budget plan?",
    "Should I invest in stocks?",
    "How to build an emergency fund?",
  ];

  const handleQuickPrompt = (prompt: string) => {
    setInputText(prompt);
  };

  // Send text message to backend (existing logic)
  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await apiService.getFinancialAdvice(inputText.trim());
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.data.message,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I apologize, but I'm having trouble connecting right now. Please check your internet connection and try again.",
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.botIcon}>
              <Bot size={24} color={colors.accent[500]} />
            </View>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>AI Financial Advisor</Text>
              <View style={styles.statusContainer}>
                <Text style={styles.subtitle}>Get personalized financial advice</Text>
                {error && (
                  <Text style={styles.errorText}>⚠️ {error}</Text>
                )}
                {isConnected && !isSessionActive && (
                  <Text style={styles.connectedText}>✅ Live Audio Ready</Text>
                )}
                {isSessionActive && !isRecording && (
                  <Text style={styles.sessionActiveText}>🟢 Session Active</Text>
                )}
                {isRecording && (
                  <Text style={styles.recordingText}>🎤 Recording...</Text>
                )}
                {isPlaying && (
                  <Text style={styles.playingText}>🔊 Playing</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageContainer,
                message.isUser ? styles.userMessage : styles.aiMessage
              ]}
            >
              <View style={styles.messageHeader}>
                <View style={[
                  styles.messageIcon,
                  { backgroundColor: message.isUser ? colors.primary[600] : colors.accent[600] }
                ]}>
                  {message.isUser ? 
                    <User size={16} color={colors.neutral[100]} /> : 
                    <Bot size={16} color={colors.neutral[100]} />
                  }
                </View>
                <Text style={styles.messageTime}>
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </Text>
              </View>
              <View style={[
                styles.messageBubble,
                message.isUser ? styles.userBubble : styles.aiBubble
              ]}>
                <Text style={[
                  styles.messageText,
                  message.isUser ? styles.userMessageText : styles.aiMessageText
                ]}>
                  {message.text}
                </Text>
              </View>
            </View>
          ))}

          {isLoading && (
            <View style={[styles.messageContainer, styles.aiMessage]}>
              <View style={styles.messageHeader}>
                <View style={[styles.messageIcon, { backgroundColor: colors.accent[600] }]}>
                  <Bot size={16} color={colors.neutral[100]} />
                </View>
                <Text style={styles.messageTime}>Now</Text>
              </View>
              <View style={[styles.messageBubble, styles.aiBubble]}>
                <Text style={styles.aiMessageText}>Thinking...</Text>
              </View>
            </View>
          )}

          {/* Quick Prompts */}
          {messages.length === 1 && (
            <View style={styles.quickPromptsContainer}>
              <Text style={styles.quickPromptsTitle}>Quick questions to get started:</Text>
              {quickPrompts.map((prompt, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickPrompt}
                  onPress={() => handleQuickPrompt(prompt)}
                >
                  <Lightbulb size={16} color={colors.accent[400]} />
                  <Text style={styles.quickPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Ask me anything about your finances..."
              placeholderTextColor={colors.neutral[400]}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isLoading) && styles.sendButtonDisabled
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isLoading}
            >
              <Send size={20} color={colors.neutral[100]} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.micButton,
                isRecording && styles.micButtonActive,
                !isConnected && styles.micButtonDisabled
              ]}
              onPress={() => {
                if (!isConnected) {
                  connectWebSocket();
                } else if (isRecording) {
                  stopRecording();
                } else {
                  startRecording();
                }
              }}
            >
              {isRecording ? (
                <StopCircle size={24} color={colors.error[500]} />
              ) : isConnected ? (
                <Mic size={24} color={colors.neutral[100]} />
              ) : (
                <Mic size={24} color={colors.neutral[400]} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[900],
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[700],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  botIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent[600] + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: colors.neutral[100],
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.neutral[400],
    marginTop: 2,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageContainer: {
    marginVertical: 8,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  aiMessage: {
    alignItems: 'flex-start',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.neutral[500],
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userBubble: {
    backgroundColor: colors.primary[600],
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: colors.neutral[800],
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    lineHeight: 24,
  },
  userMessageText: {
    color: colors.neutral[100],
  },
  aiMessageText: {
    color: colors.neutral[200],
  },
  quickPromptsContainer: {
    marginTop: 20,
    paddingHorizontal: 8,
  },
  quickPromptsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: colors.neutral[300],
    marginBottom: 12,
  },
  quickPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[800],
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  quickPromptText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.neutral[300],
    marginLeft: 8,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[700],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.neutral[800],
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.neutral[100],
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: colors.primary[600],
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.neutral[600],
  },
  micButton: {
    marginLeft: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent[600],
  },
  micButtonActive: {
    backgroundColor: colors.error[600],
  },
  micButtonDisabled: {
    backgroundColor: colors.neutral[600],
    opacity: 0.6,
  },
  titleContainer: {
    flex: 1,
  },
  statusContainer: {
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.error[400],
    marginTop: 2,
  },
  connectingText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.warning[400],
    marginTop: 2,
  },
  connectedText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.success[400],
    marginTop: 2,
  },
  sessionActiveText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.accent[400],
    marginTop: 2,
  },
  recordingText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.error[400],
    marginTop: 2,
  },
  playingText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.accent[400],
    marginTop: 2,
  },
});
