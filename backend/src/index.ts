import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './database';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Google Generative AI
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// Transactions endpoints
app.get("/transactions", (req, res) => {
    const sql = "SELECT * FROM transactions ORDER BY date DESC";
    db.all(sql, [], (err: any, rows: any) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

app.post("/transactions", (req, res) => {
    const { id, description, amount, category, date, type } = req.body;
    const sql = 'INSERT INTO transactions (id, description, amount, category, date, type) VALUES (?,?,?,?,?,?)';
    const params = [id, description, amount, category, date, type];
    
    db.run(sql, params, function(this: any, err: any) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": { id, description, amount, category, date, type },
            "id": this.lastID
        });
    });
});

// Budgets endpoints
app.get("/budgets", (req, res) => {
    const sql = "SELECT * FROM budgets";
    db.all(sql, [], (err: any, rows: any) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

app.post("/budgets", (req, res) => {
    const { id, category, limitAmount, spentAmount, period } = req.body;
    const sql = 'INSERT INTO budgets (id, category, limit_amount, spent_amount, period) VALUES (?,?,?,?,?)';
    const params = [id, category, limitAmount, spentAmount, period];
    
    db.run(sql, params, function(this: any, err: any) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": { id, category, limitAmount, spentAmount, period },
            "id": this.lastID
        });
    });
});

// Goals endpoints
app.get("/goals", (req, res) => {
    const sql = "SELECT * FROM goals";
    db.all(sql, [], (err: any, rows: any) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": rows.map((row: any) => ({
                id: row.id,
                title: row.title,
                targetAmount: row.target_amount,
                currentAmount: row.current_amount,
                deadline: row.deadline,
                category: row.category
            }))
        });
    });
});

app.post("/goals", (req, res) => {
    const { id, title, targetAmount, currentAmount, deadline, category } = req.body;
    const sql = 'INSERT INTO goals (id, title, target_amount, current_amount, deadline, category) VALUES (?,?,?,?,?,?)';
    const params = [id, title, targetAmount, currentAmount, deadline, category];
    
    db.run(sql, params, function(this: any, err: any) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": { id, title, targetAmount, currentAmount, deadline, category },
            "id": this.lastID
        });
    });
});

// Gemini AI endpoints
app.post("/api/gemini/financial-advice", async (req, res) => {
    const { prompt } = req.body;
    try {
        const chat = genAI.chats.create({ model: "gemini-1.5-flash" });
        const enhancedPrompt = `You are a helpful financial advisor. Please provide practical, actionable financial advice for this question: ${prompt}. Keep your response conversational, helpful, and focused on personal finance best practices.`;
        
        const result = await chat.sendMessage({ message: enhancedPrompt });
        const advice = result.text || 'I apologize, but I could not generate advice for that question. Please try rephrasing your question.';
        
        res.json({ advice });
    } catch (error) {
        console.error('Financial advice error:', error);
        res.status(500).json({ error: 'Failed to generate financial advice' });
    }
});

app.post("/api/gemini/categorize-transaction", async (req, res) => {
    const { description, amount } = req.body;
    try {
        const chat = genAI.chats.create({ model: "gemini-1.5-flash" });
        const prompt = `Categorize this financial transaction into one of these categories: Food & Dining, Shopping, Transportation, Bills & Utilities, Entertainment, Healthcare, Travel, Education, Income, Other. Transaction: ${description}, Amount: ${Math.abs(amount)}. Respond with only the category name.`;
        
        const result = await chat.sendMessage({ message: prompt });
        const category = (result.text || 'Other').trim();
        
        const validCategories = ['Food & Dining', 'Shopping', 'Transportation', 'Bills & Utilities', 'Entertainment', 'Healthcare', 'Travel', 'Education', 'Income', 'Other'];
        res.json({ category: validCategories.includes(category) ? category : 'Other' });
    } catch (error) {
        console.error('Transaction categorization error:', error);
        res.status(500).json({ error: 'Failed to categorize transaction' });
    }
});

app.post("/api/gemini/budget-insights", async (req, res) => {
    const { transactions } = req.body;
    try {
        const chat = genAI.chats.create({ model: "gemini-1.5-flash" });
        const prompt = `Analyze these spending patterns and provide budget insights: ${JSON.stringify(transactions)}. Provide 2-3 key insights and actionable recommendations. Keep it concise and helpful.`;
        
        const result = await chat.sendMessage({ message: prompt });
        const insights = result.text || 'No insights generated';
        
        res.json({ insights });
    } catch (error) {
        console.error('Budget insights error:', error);
        res.status(500).json({ error: 'Failed to generate budget insights' });
    }
});

app.post("/api/gemini/goal-advice", async (req, res) => {
    const { goal } = req.body;
    try {
        const chat = genAI.chats.create({ model: "gemini-1.5-flash" });
        const prompt = `Provide advice for this financial goal: ${JSON.stringify(goal)}. Give practical advice on how to reach this goal.`;
        
        const result = await chat.sendMessage({ message: prompt });
        const advice = result.text || 'No advice generated';
        
        res.json({ advice });
    } catch (error) {
        console.error('Goal advice error:', error);
        res.status(500).json({ error: 'Failed to generate goal advice' });
    }
});

app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${port}`);
    console.log(`Access from your device: http://192.168.1.36:${port}`);
});