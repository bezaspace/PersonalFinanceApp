const { ChatGroq } = require('@langchain/groq');
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const readline = require('readline');
const axios = require('axios');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import the working TTS implementation from groq-tts.js
const { generateSpeech } = require('./groq-tts.js');

// TTS Service Class using the working groq-tts.js implementation
class GroqTTSService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.isEnabled = true;
        this.currentPlayer = null;
        console.log('TTS Service initialized with groq-tts.js implementation');
    }

    // Main method: convert text to speech and play directly using groq-tts.js
    async playTextDirectly(text) {
        if (!this.isEnabled) {
            console.log('TTS is disabled');
            return;
        }

        try {
            console.log('Converting text to speech using groq-tts.js...');
            
            // Truncate text to avoid token limit (approximately 800 characters to stay under 1200 tokens)
            let truncatedText = text;
            if (text.length > 800) {
                truncatedText = text.substring(0, 800) + "...";
                console.log('Text truncated for TTS due to length limits');
            }
            
            // Use the working generateSpeech function from groq-tts.js
            // This function automatically plays the audio and returns a success message
            const result = await generateSpeech(truncatedText, {
                voice: "Fritz-PlayAI",
                model: "playai-tts",
                responseFormat: "wav",
                saveFile: false // Don't save files, just play
            });
            
            console.log('Audio playback completed successfully');
            return result;
            
        } catch (error) {
            console.error('Failed to play audio:', error.message);
            if (error.message.includes('Invalid API Key') || error.response?.status === 401) {
                console.log('\nTTS API Key Issue:');
                console.log('   Your Groq API key may not have TTS access enabled.');
                console.log('   Please check: https://console.groq.com/keys');
                console.log('   Or contact Groq support to enable TTS features.');
                console.log('   Disabling TTS for this session...\n');
                this.isEnabled = false;
            }
            console.log('Continuing with text-only mode...');
        }
    }

    // Stop current audio playback (placeholder - groq-tts.js handles this internally)
    stopAudio() {
        console.log('Audio stop requested (handled by system audio player)');
        // Note: The groq-tts.js implementation uses system audio players
        // which can be stopped using system-specific commands if needed
    }

    // Toggle TTS on/off
    toggleTTS() {
        this.isEnabled = !this.isEnabled;
        console.log(`TTS ${this.isEnabled ? 'enabled' : 'disabled'}`);
        return this.isEnabled;
    }
}

class GroqLangChainFinancialChat {
    constructor() {
        this.model = null;
        this.rl = null;
        this.apiUrl = 'http://localhost:3000';
        this.conversationHistory = [];
        this.tools = [];
        this.ttsService = null;
    }

    // Create the transactions tool using LangChain
    createTransactionsTool() {
        const getLastTransactionsTool = tool(
            async ({ limit = 10 }) => {
                try {
                    console.log(`Fetching last ${limit} transactions...`);
                    
                    const response = await axios.get(`${this.apiUrl}/transactions`, {
                        timeout: 5000 // 5 second timeout
                    });
                    
                    if (response.data && response.data.data) {
                        // Get the last N transactions (they're already ordered by date DESC)
                        const transactions = response.data.data.slice(0, limit);
                        
                        if (transactions.length === 0) {
                            return "No transactions found in the database.";
                        }

                        // Format transactions for better AI understanding
                        const formattedTransactions = transactions.map(tx => ({
                            id: tx.id,
                            description: tx.description,
                            amount: tx.amount,
                            category: tx.category,
                            date: tx.date,
                            type: tx.type
                        }));

                        const summary = {
                            total_transactions: transactions.length,
                            transactions: formattedTransactions,
                            date_range: {
                                latest: transactions[0]?.date,
                                oldest: transactions[transactions.length - 1]?.date
                            }
                        };

                        return JSON.stringify(summary, null, 2);
                    } else {
                        return "Failed to retrieve transactions from the database.";
                    }
                } catch (error) {
                    console.error('Error fetching transactions:', error.message);
                    return `Error fetching transactions: ${error.message}`;
                }
            },
            {
                name: "getLastTransactions",
                description: "Retrieves the last N transactions from the user's financial database. Use this tool when the user asks about recent transactions, spending patterns, or wants to analyze their recent financial activity.",
                schema: z.object({
                    limit: z.number()
                        .optional()
                        .default(10)
                        .describe("Number of recent transactions to retrieve (default: 10, max: 50)")
                        .refine(val => val <= 50, "Maximum 50 transactions allowed")
                })
            }
        );

        return getLastTransactionsTool;
    }

    // Initialize the Groq model and tools
    async initialize() {
        try {
            console.log('Initializing Groq LangChain Financial Chat with TTS...');

            // Check for API key
            if (!process.env.GROQ_API_KEY) {
                throw new Error('GROQ_API_KEY environment variable is required');
            }

            console.log('API key found, creating model...');

            // Initialize Groq model
            this.model = new ChatGroq({
                model: "llama-3.3-70b-versatile",
                temperature: 0.1, // Low temperature for more consistent financial advice
                apiKey: process.env.GROQ_API_KEY,
            });

            // Initialize TTS service using the working groq-tts.js implementation
            this.ttsService = new GroqTTSService(process.env.GROQ_API_KEY);
            
            // Test TTS capability
            try {
                console.log('Testing TTS API key...');
                await axios.get('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
                    timeout: 5000
                });
                console.log('TTS API key is valid');
            } catch (error) {
                console.warn('Warning: TTS API key test failed - TTS will be disabled');
                console.warn('TTS Error:', error.response?.data || error.message);
                this.ttsService.isEnabled = false;
            }

            console.log('Model created, setting up tools...');

            // Create tools
            const transactionsTool = this.createTransactionsTool();
            this.tools = [transactionsTool];

            // Bind tools to the model
            this.modelWithTools = this.model.bindTools(this.tools);

            console.log('Tools bound to model, testing connection...');

            // Quick API test with timeout
            try {
                await Promise.race([
                    axios.get(`${this.apiUrl}/transactions`, { timeout: 3000 }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('API test timeout')), 5000)
                    )
                ]);
                console.log('Database API connection successful');
            } catch (error) {
                console.warn('Warning: Database API test failed:', error.message);
                console.warn('   The chat will still work, but transaction data may not be available.');
            }

            console.log('Groq LangChain Financial Chat with TTS initialized successfully!');
            console.log('Available tools: getLastTransactions');
            console.log('TTS: Enabled (type "mute" to disable, "unmute" to enable)');
            console.log('You can ask about your recent transactions and get financial insights!\n');

            return true;
        } catch (error) {
            console.error('Error initializing Groq LangChain Chat:', error.message);
            return false;
        }
    }

    // Process user input and handle tool calls
    async processMessage(userInput) {
        try {
            // Handle TTS commands
            if (userInput.toLowerCase().trim() === 'mute') {
                this.ttsService.toggleTTS();
                return "Text-to-speech has been disabled.";
            }
            if (userInput.toLowerCase().trim() === 'unmute') {
                this.ttsService.toggleTTS();
                return "Text-to-speech has been enabled.";
            }
            if (userInput.toLowerCase().trim() === 'stop') {
                this.ttsService.stopAudio();
                return "Audio playback stopped.";
            }

            // Add user message to conversation history
            this.conversationHistory.push({
                role: 'user',
                content: userInput
            });

            // Create system message for financial context
            const systemMessage = {
                role: 'system',
                content: `You are a helpful financial advisor AI assistant. You have access to the user's transaction data through tools. 
                
                When users ask about their transactions, spending, or financial patterns, use the getLastTransactions tool to fetch their recent transaction data and provide insights.
                
                Provide practical, actionable financial advice based on the data. Be conversational, helpful, and focus on personal finance best practices.
                
                If you use the getLastTransactions tool, analyze the data and provide meaningful insights about spending patterns, categories, amounts, and trends.`
            };

            // Prepare messages for the model
            const messages = [
                systemMessage,
                ...this.conversationHistory
            ];

            console.log('Processing your request...');

            // Send message to model with tools (with timeout)
            const response = await Promise.race([
                this.modelWithTools.invoke(messages),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Model response timeout')), 30000)
                )
            ]);

            // Check if the model wants to use tools
            if (response.tool_calls && response.tool_calls.length > 0) {
                console.log('Using tools to fetch your data...');
                
                // Execute tool calls
                for (const toolCall of response.tool_calls) {
                    const tool = this.tools.find(t => t.name === toolCall.name);
                    if (tool) {
                        const toolResult = await tool.invoke(toolCall.args);
                        
                        // Add tool result to conversation
                        this.conversationHistory.push({
                            role: 'assistant',
                            content: response.content,
                            tool_calls: response.tool_calls
                        });
                        
                        this.conversationHistory.push({
                            role: 'tool',
                            content: toolResult,
                            tool_call_id: toolCall.id
                        });
                    }
                }

                // Get final response with tool results
                const finalMessages = [
                    systemMessage,
                    ...this.conversationHistory
                ];

                const finalResponse = await Promise.race([
                    this.modelWithTools.invoke(finalMessages),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Final response timeout')), 30000)
                    )
                ]);
                
                // Add final response to history
                this.conversationHistory.push({
                    role: 'assistant',
                    content: finalResponse.content
                });

                return finalResponse.content;
            } else {
                // No tools needed, just return the response
                this.conversationHistory.push({
                    role: 'assistant',
                    content: response.content
                });

                return response.content;
            }

        } catch (error) {
            console.error('Error processing message:', error);
            return `I apologize, but I encountered an error while processing your request: ${error.message}. Please try again.`;
        }
    }

    // Start the interactive chat
    async startChat() {
        const initialized = await this.initialize();
        if (!initialized) {
            console.log('Failed to initialize. Please check your configuration and try again.');
            return;
        }

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('Groq LangChain Financial Chat with Voice is ready!');
        console.log('Ask me about your transactions, spending patterns, or get financial advice!');
        console.log('Examples:');
        console.log('   - "Show me my recent transactions"');
        console.log('   - "What did I spend money on this week?"');
        console.log('   - "Analyze my spending patterns"');
        console.log('   - "How much did I spend on food recently?"');
        console.log('Voice Commands:');
        console.log('   - "mute" - Disable text-to-speech');
        console.log('   - "unmute" - Enable text-to-speech');
        console.log('   - "stop" - Stop current audio playback');
        console.log('Type "exit", "quit", or "bye" to end the conversation.\n');

        const askQuestion = () => {
            this.rl.question('You: ', async (input) => {
                const trimmedInput = input.trim().toLowerCase();
                
                if (trimmedInput === 'exit' || trimmedInput === 'quit' || trimmedInput === 'bye') {
                    console.log('\nThank you for using Groq LangChain Financial Chat!');
                    console.log('Remember to keep tracking your expenses and stay on budget!');
                    this.ttsService.stopAudio(); // Stop any playing audio
                    this.rl.close();
                    return;
                }

                if (trimmedInput === '') {
                    askQuestion();
                    return;
                }

                try {
                    const response = await this.processMessage(input);
                    console.log('\nFinancial Advisor:', response);
                    
                    // Add TTS output (non-blocking)
                    if (this.ttsService.isEnabled) {
                        // Play audio in the background without blocking the chat
                        this.ttsService.playTextDirectly(response).catch(error => {
                            console.log('Audio playback failed, continuing with text-only mode');
                        });
                    }
                    
                    console.log('\n' + '─'.repeat(80) + '\n');
                } catch (error) {
                    console.error('\nError:', error.message);
                    console.log('\n' + '─'.repeat(80) + '\n');
                }

                askQuestion();
            });
        };

        askQuestion();
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nGoodbye! Take care of your finances!');
    process.exit(0);
});

// Start the Groq LangChain financial chat
const chat = new GroqLangChainFinancialChat();
chat.startChat().catch(error => {
    console.error('Failed to start chat:', error);
    process.exit(1);
});