const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// --- DETERMINE DATABASE PATH ---
let dbPath;

if (app.isPackaged) {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
    }
    dbPath = path.join(userDataPath, 'pharmacy.db');
} else {
    dbPath = path.resolve(__dirname, '../db/pharmacy.db');
}

console.log("Database Path:", dbPath);

// --- CONNECT ---
let db;

function connect() {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error("DB Connection Error:", err.message);
        else console.log('Connected to SQLite database.');
    });
    createTables();
}

// --- INITIALIZE TABLES ---
function createTables() {
    db.serialize(() => {
        // Products
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barcode TEXT, 
            generic_name TEXT,
            trade_name TEXT,
            price REAL,
            category TEXT,
            qty INTEGER,
            expiry_date DATE,
            company_name TEXT,
            product_code INTEGER
        )`);

        // --- PERFORMANCE INDEXES (CRITICAL FIX) ---
        db.run("CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)");
        db.run("CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code)");
        db.run("CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiry_date)");

        // Sales
        db.run(`CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_amount REAL,
            payment_method TEXT
        )`);

        // Sale Items
        db.run(`CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER,
            product_name TEXT,
            qty INTEGER,
            price REAL,
            FOREIGN KEY(sale_id) REFERENCES sales(id)
        )`);

        // Invoices
        db.run(`CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_name TEXT,
            company_name TEXT,
            invoice_number TEXT,
            amount REAL,
            due_date DATE,
            status TEXT DEFAULT 'Pending'
        )`);

        // --- SAFE MIGRATIONS ---
        db.run("ALTER TABLE products ADD COLUMN company_name TEXT", (err) => { });
        db.run("ALTER TABLE products ADD COLUMN product_code INTEGER", (err) => { });
        db.run("ALTER TABLE products ADD COLUMN generic_name TEXT", (err) => { });
        db.run("ALTER TABLE products ADD COLUMN trade_name TEXT", (err) => { 
            if(!err) {
                db.run("UPDATE products SET trade_name = name WHERE trade_name IS NULL AND name IS NOT NULL");
                db.run("UPDATE products SET generic_name = 'Generic' WHERE generic_name IS NULL");
            }
        });
    });
}

connect();

// Export Proxy
module.exports = {
    run: (...args) => db.run(...args),
    get: (...args) => db.get(...args),
    all: (...args) => db.all(...args),
    prepare: (...args) => db.prepare(...args),
    serialize: (cb) => db.serialize(cb),
    close: (cb) => db.close(cb),
    reconnect: () => connect(),
    getDbPath: () => dbPath
};