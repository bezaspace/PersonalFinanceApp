
import axios from 'axios';

const API_URL = 'http://192.168.1.36:3000';

export const apiService = {
  // Transactions
  getTransactions: () => axios.get(`${API_URL}/transactions`),
  addTransaction: (transaction: any) => axios.post(`${API_URL}/transactions`, transaction),

  // Budgets
  getBudgets: () => axios.get(`${API_URL}/budgets`),
  addBudget: (budget: any) => axios.post(`${API_URL}/budgets`, budget),

  // Goals
  getGoals: () => axios.get(`${API_URL}/goals`),
  addGoal: (goal: any) => axios.post(`${API_URL}/goals`, goal),

  // Gemini AI
  getFinancialAdvice: (prompt: string) => axios.post(`${API_URL}/api/gemini/financial-advice`, { prompt }),
  categorizeTransaction: (description: string, amount: number) => axios.post(`${API_URL}/api/gemini/categorize-transaction`, { description, amount }),
  getBudgetInsights: (transactions: any[]) => axios.post(`${API_URL}/api/gemini/budget-insights`, { transactions }),
  getGoalAdvice: (goal: any) => axios.post(`${API_URL}/api/gemini/goal-advice`, { goal }),

  // Live Voice Chat
  getLiveVoiceWebSocketUrl: () => `ws://192.168.1.36:3000/live-voice`,
  checkLiveVoiceHealth: () => axios.get(`${API_URL}/health`),
};
