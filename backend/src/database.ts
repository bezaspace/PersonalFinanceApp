
import sqlite3 from 'sqlite3';

const DBSOURCE = "database.db";

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
      console.error(err.message);
      throw err;
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            description TEXT,
            amount REAL,
            category TEXT,
            date TEXT,
            type TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS budgets (
            id TEXT PRIMARY KEY,
            category TEXT,
            limit_amount REAL,
            spent_amount REAL,
            period TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS goals (
            id TEXT PRIMARY KEY,
            title TEXT,
            target_amount REAL,
            current_amount REAL,
            deadline TEXT,
            category TEXT
        )`);
    }
});

export default db;
