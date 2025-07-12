import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './database';
import { GeminiChat } from './gemini-chat';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Gemini Chat
const geminiChat = new GeminiChat(process.env.GEMINI_API_KEY || '');

// --- API Endpoints ---

// Transactions
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
    const { description, amount, category, date, type } = req.body;
    // A simple ID generator for now
    const id = `txn_${Date.now()}`; 
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

// Budgets
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

// Goals
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

// New Gemini Chat Endpoint
app.post("/api/gemini/chat", async (req, res) => {
    const { history, message } = req.body;
    try {
        const response = await geminiChat.handleChat(history, message);
        res.json(response);
    } catch (error) {
        console.error('Gemini chat error:', error);
        res.status(500).json({ error: 'Failed to get response from Gemini' });
    }
});


const server = app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${port}`);
    // Find the local IP address and log it for easy access
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const results = Object.create(null); 
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }
    console.log('Access from your local network:');
    Object.keys(results).forEach(name => {
        results[name].forEach((address: string) => {
            console.log(`   ${name}: http://${address}:${port}`);
        });
    });
});
