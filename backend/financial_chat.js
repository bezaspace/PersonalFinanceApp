const { GoogleGenAI, Type } = require('@google/genai');
const readline = require('readline');
const axios = require('axios');
const path = require('path');

// Simple UUID generator as fallback
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Load environment variables with explicit path
require('dotenv').config({ path: path.join(__dirname, '.env') });

class FinancialChatAdvisor {
    constructor() {
        this.genAI = null;
        this.rl = null;
        this.apiUrl = 'http://192.168.1.36:3000';
        this.conversationHistory = [];
        this.functionDeclarations = this.initializeFunctionDeclarations();
    }

    initializeFunctionDeclarations() {
        return [
            {
                name: 'get_recent_transactions',
                description: 'Retrieves the most recent 10 transactions with detailed information including amount, description, category, date, and type.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {},
                    required: [],
                },
            },
            {
                name: 'add_transaction',
                description: 'Adds a new transaction to the financial records. Use this when the user mentions spending money, making a purchase, or any financial transaction in natural language.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        description: {
                            type: Type.STRING,
                            description: 'A brief description of the transaction (e.g., "lunch", "gas", "grocery shopping")',
                        },
                        amount: {
                            type: Type.NUMBER,
                            description: 'The transaction amount as a positive number (e.g., 25.50 for $25.50)',
                        },
                        category: {
                            type: Type.STRING,
                            description: 'The category of the transaction. Must be one of: Food & Dining, Shopping, Transportation, Bills & Utilities, Entertainment, Healthcare, Travel, Education, Income, Other',
                        },
                        type: {
                            type: Type.STRING,
                            description: 'The type of transaction: "expense" for money spent or "income" for money received',
                        },
                    },
                    required: ['description', 'amount', 'category', 'type'],
                },
            },
        ];
    }

    async executeFunction(functionCall) {
        const { name, args } = functionCall;
        
        try {
            switch (name) {
                case 'get_recent_transactions':
                    return await this.getRecentTransactions();
                
                case 'add_transaction':
                    return await this.addTransaction(args);
                
                default:
                    return { error: `Unknown function: ${name}` };
            }
        } catch (error) {
            console.error(`Error executing function ${name}:`, error);
            return { error: `Failed to execute ${name}: ${error.message}` };
        }
    }

    async getRecentTransactions() {
        try {
            console.log('📊 Fetching your recent transactions...');
            const response = await axios.get(`${this.apiUrl}/transactions`);
            const transactions = response.data.data.slice(0, 10);
            
            return {
                success: true,
                data: transactions,
                message: `Retrieved ${transactions.length} recent transactions`
            };
        } catch (error) {
            return {
                success: false,
                error: 'Could not fetch transactions. Make sure the backend server is running.',
                data: []
            };
        }
    }

    async addTransaction(args) {
        try {
            const { description, amount, category, type } = args;
            
            // Validate category
            const validCategories = ['Food & Dining', 'Shopping', 'Transportation', 'Bills & Utilities', 'Entertainment', 'Healthcare', 'Travel', 'Education', 'Income', 'Other'];
            const finalCategory = validCategories.includes(category) ? category : 'Other';
            
            const transactionData = {
                id: uuidv4(),
                description: description,
                amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
                category: finalCategory,
                date: new Date().toISOString().split('T')[0],
                type: type
            };

            console.log('💰 Adding new transaction...');
            const response = await axios.post(`${this.apiUrl}/transactions`, transactionData);
            
            return {
                success: true,
                data: transactionData,
                message: `Successfully added ${type}: ${description} for $${Math.abs(amount)}`
            };
        } catch (error) {
            return {
                success: false,
                error: 'Could not add transaction. Make sure the backend server is running.',
                data: null
            };
        }
    }

    async initialize() {
        console.log('💰 Personal Financial Advisor Chat (Official API)');
        console.log('================================================\n');
        
        // Debug environment variables
        console.log('🔍 Debug Info:');
        console.log('   Working directory:', process.cwd());
        console.log('   Script directory:', __dirname);
        console.log('   API Key loaded:', !!process.env.GEMINI_API_KEY);
        console.log('   API Key length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0);
        console.log('');
        
        if (!process.env.GEMINI_API_KEY) {
            console.error('❌ GEMINI_API_KEY not found in environment variables');
            console.log('💡 Please add your Gemini API key to the .env file');
            console.log('💡 Make sure the .env file is in the same directory as this script');
            return false;
        }

        try {
            // Use the official API pattern
            this.genAI = new GoogleGenAI({
                apiKey: process.env.GEMINI_API_KEY,
            });

            this.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            console.log('✅ Financial Advisor initialized successfully!\n');
            console.log('🤖 Hello! I\'m your personal financial advisor. I can help you with:');
            console.log('   • Budgeting and expense tracking');
            console.log('   • Saving and investment strategies');
            console.log('   • Debt management advice');
            console.log('   • Financial goal planning');
            console.log('   • Analyzing your spending patterns');
            console.log('   • Adding transactions when you mention purchases');
            console.log('   • Viewing your recent transaction history\n');
            console.log('💡 I can also access your financial data and automatically log transactions when you mention spending money!\n');
            console.log('📝 Type "help" for more commands, or "quit" to exit.\n');

            return true;
        } catch (error) {
            console.error('❌ Error initializing Gemini AI:', error.message);
            console.log('💡 Please check your API key and try again.');
            return false;
        }
    }

    async fetchFinancialData(type) {
        try {
            console.log(`📊 Fetching your ${type}...`);
            const response = await axios.get(`${this.apiUrl}/${type}`);
            return response.data.data;
        } catch (error) {
            console.log(`⚠️  Could not fetch ${type}. Make sure the backend server is running.`);
            return null;
        }
    }

    async analyzeFinancialData(userMessage) {
        let contextData = '';
        
        // Check if user is asking about specific financial data
        if (userMessage.toLowerCase().includes('transaction') || userMessage.toLowerCase().includes('spending')) {
            const transactions = await this.fetchFinancialData('transactions');
            if (transactions) {
                contextData += `\n\nCurrent Transactions Data:\n${JSON.stringify(transactions.slice(0, 10), null, 2)}`;
            }
        }
        
        if (userMessage.toLowerCase().includes('budget')) {
            const budgets = await this.fetchFinancialData('budgets');
            if (budgets) {
                contextData += `\n\nCurrent Budget Data:\n${JSON.stringify(budgets, null, 2)}`;
            }
        }
        
        if (userMessage.toLowerCase().includes('goal')) {
            const goals = await this.fetchFinancialData('goals');
            if (goals) {
                contextData += `\n\nCurrent Goals Data:\n${JSON.stringify(goals, null, 2)}`;
            }
        }

        return contextData;
    }

    async getFinancialAdvice(userMessage, contextData = '') {
        try {
            // Create the system prompt for financial advisor context
            const systemPrompt = `You are a knowledgeable and friendly personal financial advisor with access to financial tools. Your role is to:

1. Provide practical, actionable financial advice
2. Help users understand budgeting, saving, investing, and debt management
3. Analyze spending patterns and suggest improvements
4. Offer guidance on financial goals and planning
5. Explain financial concepts in simple, easy-to-understand terms
6. Always prioritize the user's financial well-being and security
7. Use available tools to help users manage their transactions and view their financial data

Available tools:
- get_recent_transactions: Use this when users ask about their recent transactions, spending history, or want to see their latest financial activity
- add_transaction: Use this when users mention making a purchase, spending money, or any financial transaction (e.g., "I spent $20 on lunch", "I bought groceries for $150")

Keep your responses conversational, helpful, and focused on personal finance best practices. 
When appropriate, ask follow-up questions to better understand the user's financial situation.`;

            // Prepare the enhanced message with context
            const enhancedMessage = `${systemPrompt}\n\nUser Question: ${userMessage}${contextData}`;

            // Use the official API method with function calling
            const response = await this.genAI.models.generateContent({
                model: "gemini-2.5-flash",
                contents: enhancedMessage,
                config: {
                    tools: [{
                        functionDeclarations: this.functionDeclarations
                    }],
                },
            });

            // Check for function calls in the response
            if (response.functionCalls && response.functionCalls.length > 0) {
                let functionResults = [];
                
                // Execute all function calls
                for (const functionCall of response.functionCalls) {
                    console.log(`🔧 Executing function: ${functionCall.name}`);
                    const result = await this.executeFunction(functionCall);
                    functionResults.push({
                        functionCall,
                        result
                    });
                }

                // Generate a follow-up response with function results
                const functionResultsText = functionResults.map(fr => {
                    if (fr.result.success) {
                        if (fr.functionCall.name === 'get_recent_transactions') {
                            return `Recent transactions data: ${JSON.stringify(fr.result.data, null, 2)}`;
                        } else if (fr.functionCall.name === 'add_transaction') {
                            return `Transaction added successfully: ${fr.result.message}`;
                        }
                    } else {
                        return `Error: ${fr.result.error}`;
                    }
                }).join('\n\n');

                const followUpPrompt = `${systemPrompt}

User Question: ${userMessage}
Function Results: ${functionResultsText}

Based on the function results above, provide a helpful response to the user. If transactions were retrieved, analyze them and provide insights. If a transaction was added, confirm it and provide relevant advice.`;

                const followUpResponse = await this.genAI.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: followUpPrompt,
                });

                return followUpResponse.text || 'I executed the requested action but could not generate a response. Please try again.';
            } else {
                return response.text || 'I apologize, but I could not generate a response. Please try rephrasing your question.';
            }
        } catch (error) {
            throw error;
        }
    }

    async startChat() {
        const initialized = await this.initialize();
        if (!initialized) {
            return;
        }

        this.promptUser();
    }

    promptUser() {
        this.rl.question('💬 You: ', async (input) => {
            const userMessage = input.trim();

            if (userMessage.toLowerCase() === 'quit' || userMessage.toLowerCase() === 'exit') {
                console.log('\n👋 Goodbye! Take care of your finances!');
                this.cleanup();
                return;
            }

            if (userMessage.toLowerCase() === 'help') {
                this.showHelp();
                this.promptUser();
                return;
            }

            if (userMessage.toLowerCase() === 'clear') {
                console.clear();
                console.log('💰 Personal Financial Advisor Chat (Official API)');
                console.log('================================================\n');
                this.promptUser();
                return;
            }

            if (userMessage === '') {
                this.promptUser();
                return;
            }

            try {
                console.log('\n🤔 Thinking...');

                // Get relevant financial data if needed
                const contextData = await this.analyzeFinancialData(userMessage);
                
                // Get advice using official API
                const response = await this.getFinancialAdvice(userMessage, contextData);

                // Store conversation history
                this.conversationHistory.push({
                    user: userMessage,
                    advisor: response,
                    timestamp: new Date().toISOString()
                });

                console.log(`\n🤖 Financial Advisor: ${response}\n`);

            } catch (error) {
                console.error('\n❌ Error getting advice:', error);
                console.log('💡 Please try again or rephrase your question.\n');
            }

            this.promptUser();
        });
    }

    showHelp() {
        console.log('\n📚 Available Commands:');
        console.log('   help     - Show this help message');
        console.log('   clear    - Clear the screen');
        console.log('   quit     - Exit the chat');
        console.log('\n💡 Example questions you can ask:');
        console.log('   • "How can I create a budget?"');
        console.log('   • "What are some good saving strategies?"');
        console.log('   • "How should I prioritize paying off debt?"');
        console.log('   • "Show me my recent transactions"');
        console.log('   • "I spent $25 on lunch today"');
        console.log('   • "I bought groceries for $150"');
        console.log('   • "Help me set up an emergency fund"');
        console.log('   • "What investment options should I consider?"');
        console.log('   • "Check my budget progress"');
        console.log('   • "Review my financial goals"\n');
    }

    cleanup() {
        if (this.rl) {
            this.rl.close();
        }
        process.exit(0);
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n\n👋 Goodbye! Take care of your finances!');
    process.exit(0);
});

// Start the financial chat advisor
const advisor = new FinancialChatAdvisor();
advisor.startChat();