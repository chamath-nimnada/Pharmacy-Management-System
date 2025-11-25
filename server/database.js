const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database File Path
const dbPath = path.resolve(__dirname, '../db/pharmacy.db');

// The active database instance
let db;

// Function to (Re)Connect
function connect() {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error(err.message);
        else console.log('Connected to SQLite database.');
    });
    createTables();
}

// Initialize Tables & Migrations
function createTables() {
    db.serialize(() => {
        // Products Table
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barcode TEXT, 
            name TEXT,
            price REAL,
            category TEXT,
            qty INTEGER,
            expiry_date DATE,
            company_name TEXT,
            product_code INTEGER
        )`);

        // Sales Table
        db.run(`CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_amount REAL,
            payment_method TEXT
        )`);

        // Sale Items Table
        db.run(`CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER,
            product_name TEXT,
            qty INTEGER,
            price REAL,
            FOREIGN KEY(sale_id) REFERENCES sales(id)
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

        // --- SAFE MIGRATIONS (Ignore errors if columns exist) ---
        db.run("ALTER TABLE products ADD COLUMN company_name TEXT", () => { });
        db.run("ALTER TABLE products ADD COLUMN product_code INTEGER", () => { });
    });
}

// Initial Connection
connect();

// Export a Proxy Object + Management Methods
module.exports = {
    // Proxy these standard methods to the current 'db' instance
    run: (...args) => db.run(...args),
    get: (...args) => db.get(...args),
    all: (...args) => db.all(...args),
    prepare: (...args) => db.prepare(...args),
    serialize: (cb) => db.serialize(cb),

    // Management methods for Import/Export
    close: (cb) => db.close(cb),
    reconnect: () => connect(),
    getDbPath: () => dbPath
};