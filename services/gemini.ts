import { apiService } from './api';

export class GeminiService {
  async generateFinancialAdvice(prompt: string): Promise<string> {
    const response = await apiService.getFinancialAdvice(prompt);
    return response.data.message;
  }

  async categorizeTransaction(description: string, amount: number): Promise<string> {
    const response = await apiService.categorizeTransaction(description, amount);
    return response.data.category;
  }

  async generateBudgetInsights(transactions: any[]): Promise<string> {
    const response = await apiService.getBudgetInsights(transactions);
    return response.data.insights;
  }

  async generateGoalAdvice(goal: any): Promise<string> {
    const response = await apiService.getGoalAdvice(goal);
    return response.data.advice;
  }
}

export const geminiService = new GeminiService();