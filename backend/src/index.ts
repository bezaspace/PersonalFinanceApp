
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import db from './database';
import { processWavFile, GeminiLiveWebSocketHandler, initializeGoogleGenAI } from './liveAudioService';
import multer from 'multer';

dotenv.config();

// Initialize GoogleGenAI after dotenv is loaded
initializeGoogleGenAI();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Create HTTP server
const server = createServer(app);

// Create WebSocket server for live audio
const wss = new WebSocket.Server({ 
  server,
  path: '/live-audio'
});

// Store active WebSocket handlers
const activeHandlers = new Map<string, GeminiLiveWebSocketHandler>();

// Handle WebSocket connections for live audio
wss.on('connection', (ws: WebSocket, req) => {
  const sessionId = uuidv4();
  console.log(`[WEBSOCKET] New WebSocket connection established: ${sessionId}`);
  console.log(`[WEBSOCKET] Client IP: ${req.socket.remoteAddress}`);
  console.log(`[WEBSOCKET] Headers:`, req.headers);
  
  // Create handler for this WebSocket connection
  try {
    const handler = new GeminiLiveWebSocketHandler(ws, sessionId);
    activeHandlers.set(sessionId, handler);
    console.log(`[WEBSOCKET] Handler created successfully for session: ${sessionId}`);
    
    // Send initial connection message
    const connectionMessage = {
      type: 'connection_established',
      sessionId: sessionId,
      message: 'Connected to Gemini Live Audio service'
    };
    ws.send(JSON.stringify(connectionMessage));
    console.log(`[WEBSOCKET] Connection established message sent:`, connectionMessage);
  } catch (error) {
    console.error(`[WEBSOCKET] Error creating handler for session ${sessionId}:`, error);
  }
  
  ws.on('close', (code, reason) => {
    console.log(`[WEBSOCKET] WebSocket connection closed: ${sessionId}, Code: ${code}, Reason: ${reason}`);
    activeHandlers.delete(sessionId);
  });
  
  ws.on('error', (error) => {
    console.error(`[WEBSOCKET] WebSocket error for session ${sessionId}:`, error);
    activeHandlers.delete(sessionId);
  });
  
  ws.on('message', (data) => {
    console.log(`[WEBSOCKET] Raw message received for session ${sessionId}.`);
  });
});


interface Transaction {
    id: number;
    description: string;
    amount: number;
    category: string;
    date: string;
    type: string;
}

interface Budget {
    id: number;
    category: string;
    limit_amount: number;
    spent_amount: number;
    period: string;
}

interface Goal {
    id: number;
    title: string;
    target_amount: number;
    current_amount: number;
    deadline: string;
    category: string;
}

app.get('/', (req, res) => {
  res.send('AI Finance Assistant Backend is running!');
});

// Transactions Endpoints
app.get('/transactions', (req, res) => {
    db.all("SELECT * FROM transactions ORDER BY date DESC", [], (err, rows: Transaction[]) => {
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({
            "message":"success",
            "data":rows
        })
    });
});

app.post("/transactions", (req, res) => {
    const { id, description, amount, category, date, type } = req.body;
    const sql = 'INSERT INTO transactions (id, description, amount, category, date, type) VALUES (?,?,?,?,?,?)';
    const params = [id, description, amount, category, date, type];
    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({
            "message": "success",
            "data": req.body,
            "id" : this.lastID
        })
    });
});

// Budgets Endpoints
app.get('/budgets', (req, res) => {
    db.all("SELECT * FROM budgets", [], (err, rows: Budget[]) => {
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        const budgets = rows.map(row => ({
            id: row.id,
            category: row.category,
            limit: row.limit_amount,
            spent: row.spent_amount,
            period: row.period
        }));
        res.json({
            "message":"success",
            "data":budgets
        })
    });
});

app.post("/budgets", (req, res) => {
    const { id, category, limit, spent, period } = req.body;
    const sql = 'INSERT INTO budgets (id, category, limit_amount, spent_amount, period) VALUES (?,?,?,?,?)';
    const params = [id, category, limit, spent, period];
    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({
            "message": "success",
            "data": req.body,
            "id" : this.lastID
        })
    });
});

// Goals Endpoints
app.get('/goals', (req, res) => {
    db.all("SELECT * FROM goals", [], (err, rows: Goal[]) => {
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        const goals = rows.map(row => ({
            id: row.id,
            title: row.title,
            targetAmount: row.target_amount,
            currentAmount: row.current_amount,
            deadline: row.deadline,
            category: row.category
        }));
        res.json({
            "message":"success",
            "data":goals
        })
    });
});

app.post("/goals", (req, res) => {
    const { id, title, targetAmount, currentAmount, deadline, category } = req.body;
    const sql = 'INSERT INTO goals (id, title, target_amount, current_amount, deadline, category) VALUES (?,?,?,?,?,?)';
    const params = [id, title, targetAmount, currentAmount, deadline, category];
    db.run(sql, params, function (err) {
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({
            "message": "success",
            "data": req.body,
            "id" : this.lastID
        })
    });
});

import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// ... (existing code)

// Live Audio HTTP endpoint (reference Gemini implementation)
const upload = multer();

app.post('/api/live-audio', upload.single('audio'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No audio file uploaded' });
    return;
  }
  const inputBuffer = req.file.buffer;
  processWavFile(inputBuffer)
    .then((outputBuffer) => {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Disposition', 'attachment; filename="response.wav"');
      res.send(outputBuffer);
    })
    .catch((error) => {
      console.error('Live audio processing error:', error);
      res.status(500).json({ error: 'Failed to process live audio' });
    });
});

// Gemini AI Endpoints (using text-based model for non-live features)
app.post("/api/gemini/financial-advice", async (req, res) => {
    const { prompt } = req.body;
    try {
        const chat = genAI.chats.create({ model: "gemini-1.5-flash" });
        const result = await chat.sendMessage({ message: prompt });
        res.json({ message: result.text || 'No response generated' });
    } catch (error) {
        console.error('Gemini API error:', error);
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
        res.json({ insights: result.text || 'No insights generated' });
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
        res.json({ advice: result.text || 'No advice generated' });
    } catch (error) {
        console.error('Goal advice error:', error);
        res.status(500).json({ error: 'Failed to generate goal advice' });
    }
});

server.listen(Number(port), '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
  console.log(`WebSocket server is running on ws://0.0.0.0:${port}/live-audio`);
  console.log(`Access from your device: http://192.168.1.36:${port}`);
});
