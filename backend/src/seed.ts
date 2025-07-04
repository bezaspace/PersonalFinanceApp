
import db from './database';

const transactions = [
    {
        id: '1',
        description: 'Grocery shopping at Whole Foods',
        amount: -125.50,
        category: 'Food & Dining',
        date: new Date(Date.now() - 86400000 * 1).toISOString(),
        type: 'expense',
    },
    {
        id: '2',
        description: 'Salary deposit',
        amount: 3500.00,
        category: 'Income',
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
        type: 'income',
    },
    {
        id: '3',
        description: 'Netflix subscription',
        amount: -15.99,
        category: 'Entertainment',
        date: new Date(Date.now() - 86400000 * 3).toISOString(),
        type: 'expense',
    },
    {
        id: '4',
        description: 'Uber ride to airport',
        amount: -45.20,
        category: 'Transportation',
        date: new Date(Date.now() - 86400000 * 4).toISOString(),
        type: 'expense',
    },
    {
        id: '5',
        description: 'Coffee shop',
        amount: -8.75,
        category: 'Food & Dining',
        date: new Date(Date.now() - 86400000 * 5).toISOString(),
        type: 'expense',
    },
];

const budgets = [
    {
        id: '1',
        category: 'Food & Dining',
        limit_amount: 400,
        spent_amount: 134.25,
        period: 'monthly',
    },
    {
        id: '2',
        category: 'Transportation',
        limit_amount: 200,
        spent_amount: 45.20,
        period: 'monthly',
    },
    {
        id: '3',
        category: 'Entertainment',
        limit_amount: 100,
        spent_amount: 15.99,
        period: 'monthly',
    },
    {
        id: '4',
        category: 'Shopping',
        limit_amount: 300,
        spent_amount: 0,
        period: 'monthly',
    },
];

const goals = [
    {
        id: '1',
        title: 'Emergency Fund',
        target_amount: 10000,
        current_amount: 2500,
        deadline: new Date(Date.now() + 86400000 * 365).toISOString(),
        category: 'Savings',
    },
    {
        id: '2',
        title: 'Vacation to Japan',
        target_amount: 5000,
        current_amount: 1200,
        deadline: new Date(Date.now() + 86400000 * 180).toISOString(),
        category: 'Travel',
    },
    {
        id: '3',
        title: 'New MacBook',
        target_amount: 2500,
        current_amount: 800,
        deadline: new Date(Date.now() + 86400000 * 90).toISOString(),
        category: 'Technology',
    },
];

const seed = () => {
    db.serialize(() => {
        // Clear existing data
        db.run(`DELETE FROM transactions`);
        db.run(`DELETE FROM budgets`);
        db.run(`DELETE FROM goals`);

        // Seed transactions
        const stmtTransactions = db.prepare("INSERT INTO transactions (id, description, amount, category, date, type) VALUES (?, ?, ?, ?, ?, ?)");
        transactions.forEach(tx => {
            stmtTransactions.run(tx.id, tx.description, tx.amount, tx.category, tx.date, tx.type);
        });
        stmtTransactions.finalize();
        console.log('Transactions seeded.');

        // Seed budgets
        const stmtBudgets = db.prepare("INSERT INTO budgets (id, category, limit_amount, spent_amount, period) VALUES (?, ?, ?, ?, ?)");
        budgets.forEach(b => {
            stmtBudgets.run(b.id, b.category, b.limit_amount, b.spent_amount, b.period);
        });
        stmtBudgets.finalize();
        console.log('Budgets seeded.');

        // Seed goals
        const stmtGoals = db.prepare("INSERT INTO goals (id, title, target_amount, current_amount, deadline, category) VALUES (?, ?, ?, ?, ?, ?)");
        goals.forEach(g => {
            stmtGoals.run(g.id, g.title, g.target_amount, g.current_amount, g.deadline, g.category);
        });
        stmtGoals.finalize();
        console.log('Goals seeded.');
    });

    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Closed the database connection.');
    });
};

seed();
