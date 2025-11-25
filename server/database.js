const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to DB
const dbPath = path.resolve(__dirname, '../db/pharmacy.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error(err.message);
    else console.log('Connected to SQLite database.');
});

// Create Tables
db.serialize(() => {
    // Products Table
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT, 
        name TEXT,
        price REAL,
        category TEXT,
        qty INTEGER,
        expiry_date DATE
    )`);

    // Sales Table
    db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_amount REAL,
        payment_method TEXT
    )`);

    // Purchase Invoices
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_name TEXT,
        company_name TEXT,
        invoice_number TEXT,
        amount REAL,
        due_date DATE,
        status TEXT DEFAULT 'Pending'
    )`);
});

module.exports = db;