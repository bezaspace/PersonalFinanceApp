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
  ActivityIndicator,
} from 'react-native';
import { Send, Bot, User, Zap } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { globalStyles } from '@/constants/styles';
import { apiService } from '@/services/api';

// --- Type Definitions ---
interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  metadata?: any; // For function calls or other data
}

interface HistoryItem {
  role: 'user' | 'model';
  parts: { text: string }[];
}

// --- Main Component ---
export default function AIChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your AI financial advisor. I can now access your transaction data. How can I help you?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
      // 1. Build the history for the API call
      const history: HistoryItem[] = messages.map(msg => ({
        role: msg.isUser ? 'user' : 'model',
        parts: [{ text: msg.text }],
      }));

      // 2. Call the new chat endpoint
      const response = await apiService.postToChat(history, userMessage.text);
      const aiResponse = response.data;

      // 3. Process the response (text or function call)
      let aiMessageText = 'I seem to be having trouble thinking right now.';
      if (aiResponse.candidates && aiResponse.candidates.length > 0) {
        const candidate = aiResponse.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          aiMessageText = candidate.content.parts[0].text;
        }
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiMessageText,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I'm having trouble connecting. Please try again.",
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

  // --- UI Rendering ---

  const renderMessage = (message: Message) => (
    <View key={message.id} style={[
      styles.messageContainer,
      message.isUser ? styles.userMessage : styles.aiMessage
    ]}>
      <View style={[styles.messageIcon, message.isUser ? styles.userIcon : styles.aiIcon]}>
        {message.isUser ? (
          <User size={16} color={colors.neutral[100]} />
        ) : (
          <Bot size={16} color={colors.neutral[100]} />
        )}
      </View>
      <View style={[styles.messageBubble, message.isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.messageText, message.isUser ? styles.userText : styles.aiText]}>
          {message.text}
        </Text>
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
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.botIcon}>
              <Zap size={24} color={colors.accent[600]} />
            </View>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>AI Financial Advisor</Text>
              <Text style={styles.subtitle}>Powered by Gemini Function Calling</Text>
            </View>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map(renderMessage)}
          {isLoading && (
            <View style={[styles.messageContainer, styles.aiMessage]}>
              <View style={[styles.messageIcon, styles.aiIcon]}>
                <Bot size={16} color={colors.neutral[100]} />
              </View>
              <View style={[styles.messageBubble, styles.aiBubble]}>
                <ActivityIndicator size="small" color={colors.neutral[400]} />
                <Text style={[styles.messageText, styles.aiText, { marginLeft: 8 }]}>
                  Thinking...
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask about transactions or add a new one..."
              placeholderTextColor={colors.neutral[500]}
              multiline
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isLoading}
            >
              <Send size={20} color={colors.neutral[100]} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- Styles ---
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
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
    color: colors.neutral[200],
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
    color: colors.neutral[500],
    alignSelf: 'flex-end',
    marginLeft: 8,
  },
  inputContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[700],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[800],
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: colors.neutral[100],
    maxHeight: 100,
    paddingVertical: 4,
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
});
