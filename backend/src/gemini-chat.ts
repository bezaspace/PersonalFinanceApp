import { GoogleGenAI, Type, Content, FunctionDeclaration } from '@google/genai';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

// --- Type Definitions for our functions ---
type TransactionArgs = { description: string; amount: number; category: string; type: 'expense' | 'income'; };

// --- Function Implementations ---

async function getRecentTransactions() {
  try {
    console.log('📊 Fetching recent transactions via API...');
    const response = await axios.get(`${API_URL}/transactions`);
    const transactions = response.data.data.slice(0, 10);
    return {
      success: true,
      data: transactions,
      message: `Retrieved ${transactions.length} recent transactions.`,
    };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return {
      success: false,
      error: 'Could not fetch transactions. Make sure the API server is running.',
      data: [],
    };
  }
}

async function addTransaction(args: TransactionArgs) {
  try {
    console.log('💰 Adding new transaction via API...');
    const { description, amount, category, type } = args;
    
    const transactionData = {
      description,
      amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
      category,
      date: new Date().toISOString().split('T')[0],
      type,
    };

    const response = await axios.post(`${API_URL}/transactions`, transactionData);
    
    return {
      success: true,
      data: response.data,
      message: `Successfully added ${type}: ${description} for $${Math.abs(amount)}`,
    };
  } catch (error) {
    console.error('Error adding transaction:', error);
    return {
      success: false,
      error: 'Could not add transaction. Make sure the API server is running.',
      data: null,
    };
  }
}

// --- Tool Definitions ---

const tools = {
  get_recent_transactions: getRecentTransactions,
  add_transaction: addTransaction,
};

const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'get_recent_transactions',
    description: 'Retrieves the most recent 10 transactions with detailed information.',
  },
  {
    name: 'add_transaction',
    description: 'Adds a new transaction to the financial records.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING, description: 'e.g., "lunch", "gas"' },
        amount: { type: Type.NUMBER, description: 'e.g., 25.50' },
        category: { type: Type.STRING, description: 'e.g., Food & Dining, Shopping' },
        type: { type: Type.STRING, description: 'must be "expense" or "income"' },
      },
      required: ['description', 'amount', 'category', 'type'],
    },
  },
];

// --- Main Chat Logic Handler ---

export class GeminiChat {
  private genAI: GoogleGenAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenAI({ apiKey });
  }

  async handleChat(history: Content[], userMessage: string) {
    const contents: Content[] = [...history, { role: 'user', parts: [{ text: userMessage }] }];

    const result = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: { tools: [{ functionDeclarations }] },
    });

    if (result.functionCalls && result.functionCalls.length > 0) {
      // Add the model's function call response to history
      const modelResponse = result.candidates?.[0]?.content;
      if (modelResponse) {
        contents.push(modelResponse);
      }

      // Execute functions and add results to history
      for (const call of result.functionCalls) {
        const functionName = call.name as keyof typeof tools;
        let toolResponse;

        if (functionName === 'add_transaction') {
          if (call.args) {
            toolResponse = await tools.add_transaction(call.args as TransactionArgs);
          } else {
            toolResponse = { success: false, error: 'Missing arguments for add_transaction' };
          }
        } else if (functionName === 'get_recent_transactions') {
          toolResponse = await tools.get_recent_transactions();
        }

        if (toolResponse) {
          contents.push({
            role: 'user',
            parts: [{
              functionResponse: {
                name: functionName,
                response: toolResponse,
              }
            }]
          });
        }
      }

      // Send updated history back to the model for a final response
      const secondResult = await this.genAI.models.generateContent({
          model: "gemini-2.5-flash",
          contents: contents,
      });

      return secondResult;
    } else {
      return result;
    }
  }
}