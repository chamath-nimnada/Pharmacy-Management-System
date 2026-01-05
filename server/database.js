const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// --- DETERMINE DATABASE PATH ---
let dbPath;

if (app && app.isPackaged) {
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
        if (err) {
            console.error("DB Connection Error:", err.message);
        } else {
            console.log('Connected to SQLite database.');

            // --- CRITICAL PERFORMANCE FIXES ---
            // 1. Enable WAL mode: Allows simultaneous Read/Write (Fixes "Network Error" on sale)
            db.run("PRAGMA journal_mode = WAL;", (err) => {
                if (err) console.error("Failed to enable WAL:", err);
            });
            // 2. Synchronous Normal: Faster writes while staying safe
            db.run("PRAGMA synchronous = NORMAL;");

            createTables();
        }
    });
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

        db.run("CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)");
        db.run("CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code)");
        db.run("CREATE INDEX IF NOT EXISTS idx_products_expiry ON products(expiry_date)");

        // Sales
        db.run(`CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_amount REAL,
            payment_method TEXT,
            patient_name TEXT
        )`);

        // Index for sorting history quickly
        db.run("CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date)");

        // Sale Items
        db.run(`CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER,
            product_name TEXT,
            qty INTEGER,
            price REAL,
            category TEXT,
            FOREIGN KEY(sale_id) REFERENCES sales(id)
        )`);

        // CRITICAL INDEX for History JOIN
        db.run("CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)");

        // Invoices
        db.run(`CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_name TEXT,
            company_name TEXT,
            invoice_number TEXT,
            amount REAL,
            purchase_date DATE,
            due_days INTEGER,
            due_date DATE,
            status TEXT DEFAULT 'Pending'
        )`);

        // --- SAFE MIGRATIONS ---
        db.run("ALTER TABLE products ADD COLUMN company_name TEXT", (err) => { });
        db.run("ALTER TABLE products ADD COLUMN product_code INTEGER", (err) => { });
        db.run("ALTER TABLE products ADD COLUMN generic_name TEXT", (err) => { });
        db.run("ALTER TABLE products ADD COLUMN trade_name TEXT", (err) => {
            if (!err) {
                db.run("UPDATE products SET trade_name = name WHERE trade_name IS NULL AND name IS NOT NULL");
                db.run("UPDATE products SET generic_name = 'Generic' WHERE generic_name IS NULL");
            }
        });

        db.run("ALTER TABLE invoices ADD COLUMN purchase_date DATE", (err) => { });
        db.run("ALTER TABLE invoices ADD COLUMN due_days INTEGER", (err) => { });
        db.run("ALTER TABLE sales ADD COLUMN patient_name TEXT", (err) => { });
        db.run("ALTER TABLE sale_items ADD COLUMN category TEXT", (err) => { });
    });
}

connect();

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