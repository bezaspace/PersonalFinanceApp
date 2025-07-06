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
import { Send, Bot, User, Mic, MicOff, MessageSquare, Volume2, Zap } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { globalStyles } from '@/constants/styles';
import { apiService } from '@/services/api';
import { liveVoiceService, VoiceMessage, LiveVoiceCallbacks } from '@/services/liveVoice';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  hasAudio?: boolean;
}

export default function AIChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your AI financial advisor. Press the Voice button, then the mic to start recording.",
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

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
        text: response.data.advice,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    if (isVoiceMode) {
      const voiceCallbacks: LiveVoiceCallbacks = {
        onMessage: (voiceMessage: VoiceMessage) => {
          const message: Message = {
            id: voiceMessage.id,
            text: voiceMessage.text,
            isUser: voiceMessage.isUser,
            timestamp: voiceMessage.timestamp,
            hasAudio: voiceMessage.hasAudio
          };
          setMessages(prev => [...prev, message]);
        },
        onConnectionChange: (connected: boolean) => {
          setIsVoiceConnected(connected);
          if (!connected) {
            setIsVoiceMode(false);
            setIsRecording(false);
            setIsAiSpeaking(false);
          }
        },
        onError: (error: string) => {
          console.error('Voice service error:', error);
          Alert.alert('Voice Chat Error', error);
          setIsVoiceMode(false);
          setIsRecording(false);
          setIsAiSpeaking(false);
        },
        onRecordingChange: (recording: boolean) => {
          setIsRecording(recording);
        },
        onAiSpeaking: (speaking: boolean) => {
          setIsAiSpeaking(speaking);
        }
      };
      liveVoiceService.startSession(voiceCallbacks);
    } else {
      liveVoiceService.endSession();
      setIsVoiceConnected(false);
      setIsRecording(false);
      setIsAiSpeaking(false);
    }

    return () => {
      // Cleanup on unmount or mode change
      liveVoiceService.endSession();
      setIsVoiceConnected(false);
      setIsRecording(false);
      setIsAiSpeaking(false);
    };
  }, [isVoiceMode]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Force cleanup when component unmounts
      liveVoiceService.endSession();
    };
  }, []);

  const handleMicPress = async () => {
    if (!isVoiceConnected) {
      Alert.alert('Voice Chat', 'Please connect to voice chat first');
      return;
    }

    try {
      if (isRecording) {
        await liveVoiceService.stopRecording();
      } else {
        await liveVoiceService.startRecording();
      }
    } catch (error) {
      console.error('Error handling mic press:', error);
      Alert.alert('Recording Error', 'Failed to control microphone');
    }
  };

  const renderMessage = (message: Message) => (
    <View key={message.id} style={[
      styles.messageContainer,
      message.isUser ? styles.userMessage : styles.aiMessage
    ]}>
      <View style={[
        styles.messageIcon,
        message.isUser ? styles.userIcon : styles.aiIcon
      ]}>
        {message.isUser ? (
          <User size={16} color={colors.neutral[100]} />
        ) : (
          <Bot size={16} color={colors.neutral[100]} />
        )}
      </View>
      <View style={[
        styles.messageBubble,
        message.isUser ? styles.userBubble : styles.aiBubble
      ]}>
        <View style={styles.messageContent}>
          <Text style={[
            styles.messageText,
            message.isUser ? styles.userText : styles.aiText
          ]}>
            {message.text}
          </Text>
          {message.hasAudio && (
            <TouchableOpacity onPress={() => { /* Add play audio functionality here */ }}>
              <View style={styles.audioIndicator}>
                <Volume2 size={16} color={colors.primary[400]} />
              </View>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.timestamp}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.botIcon}>
              <Zap size={24} color={colors.accent[600]} />
            </View>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>AI Financial Advisor</Text>
              <Text style={styles.subtitle}>Get personalized financial advice</Text>
            </View>
          </View>
        </View>

        {/* Messages */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map(renderMessage)}
          {isLoading && !isVoiceMode && (
            <View style={[styles.messageContainer, styles.aiMessage]}>
              <View style={[styles.messageIcon, styles.aiIcon]}>
                <Bot size={16} color={colors.neutral[100]} />
              </View>
              <View style={[styles.messageBubble, styles.aiBubble]}>
                <Text style={[styles.messageText, styles.aiText]}>
                  Thinking...
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Mode Toggle */}
        <View style={styles.modeToggleContainer}>
          <TouchableOpacity 
            style={[
              styles.modeToggle,
              !isVoiceMode && styles.modeToggleActive
            ]}
            onPress={() => setIsVoiceMode(false)}
            disabled={isLoading}
          >
            <MessageSquare size={16} color={!isVoiceMode ? colors.primary[400] : colors.neutral[500]} />
            <Text style={[
              styles.modeToggleText,
              !isVoiceMode && styles.modeToggleTextActive
            ]}>Text</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.modeToggle,
              isVoiceMode && styles.modeToggleActive
            ]}
            onPress={() => setIsVoiceMode(true)}
            disabled={isLoading}
          >
            <Mic size={16} color={isVoiceMode ? colors.primary[400] : colors.neutral[500]} />
            <Text style={[
              styles.modeToggleText,
              isVoiceMode && styles.modeToggleTextActive
            ]}>Voice</Text>
          </TouchableOpacity>
        </View>

        {/* Input - Text Mode */}
        {!isVoiceMode && (
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask me about your finances..."
                placeholderTextColor={colors.neutral[500]}
                multiline
                maxLength={500}
                onSubmitEditing={sendMessage}
                blurOnSubmit={false}
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
            </View>
          </View>
        )}

        {/* Voice Controls - Voice Mode */}
        {isVoiceMode && (
          <View style={styles.voiceContainer}>
            <View style={styles.voiceStatus}>
              <View style={[
                styles.statusIndicator,
                isVoiceConnected ? styles.statusConnected : styles.statusDisconnected
              ]} />
              <Text style={styles.voiceStatusText}>
                {isVoiceConnected ? (isAiSpeaking ? 'AI is speaking...' : (isRecording ? 'Recording...' : 'Ready to record')) : 'Connecting...'}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={[
                styles.micButton,
                isRecording && styles.micButtonActive,
                (!isVoiceConnected || isAiSpeaking) && styles.micButtonDisabled
              ]}
              onPress={handleMicPress}
              disabled={!isVoiceConnected || isAiSpeaking}
            >
              {isRecording ? (
                <MicOff size={32} color={colors.neutral[100]} />
              ) : (
                <Mic size={32} color={colors.neutral[100]} />
              )}
            </TouchableOpacity>
            
            <Text style={styles.voiceInstructions}>
              {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
            </Text>
          </View>
        )}
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
  titleContainer: {
    flex: 1,
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
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  aiMessage: {
    justifyContent: 'flex-start',
  },
  messageIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  userIcon: {
    backgroundColor: colors.primary[600],
    marginLeft: 8,
  },
  aiIcon: {
    backgroundColor: colors.accent[600],
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
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
    lineHeight: 22,
  },
  userText: {
    color: colors.neutral[100],
  },
  aiText: {
    color: colors.neutral[200],
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.neutral[400],
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[700],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.neutral[800],
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.neutral[100],
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: colors.neutral[600],
  },
  messageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioIndicator: {
    padding: 4,
    backgroundColor: colors.neutral[700],
    borderRadius: 16,
    marginLeft: 8,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[800],
    borderRadius: 25,
    padding: 4,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  modeToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  modeToggleActive: {
    backgroundColor: colors.neutral[700],
  },
  modeToggleText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.neutral[500],
  },
  modeToggleTextActive: {
    color: colors.primary[400],
  },
  voiceContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: colors.neutral[800],
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
  },
  voiceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusConnected: {
    backgroundColor: colors.success[500],
  },
  statusDisconnected: {
    backgroundColor: colors.error[500],
  },
  voiceStatusText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.neutral[300],
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  micButtonActive: {
    backgroundColor: colors.error[600],
  },
  micButtonDisabled: {
    backgroundColor: colors.neutral[600],
    opacity: 0.5,
  },
  voiceInstructions: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: colors.neutral[400],
    textAlign: 'center',
  },
});
