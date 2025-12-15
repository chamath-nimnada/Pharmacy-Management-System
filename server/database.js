const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron'); // Import Electron to get system paths

// --- DETERMINE DATABASE PATH ---
let dbPath;

if (app.isPackaged) {
    // PRODUCTION: Use User Data folder (Writable)
    // Windows: C:\Users\Name\AppData\Roaming\PharmaPOS\pharmacy.db
    const userDataPath = app.getPath('userData');

    // Create folder if it doesn't exist
    if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
    }
    dbPath = path.join(userDataPath, 'pharmacy.db');
} else {
    // DEVELOPMENT: Use local project folder
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
            name TEXT,
            price REAL,
            category TEXT,
            qty INTEGER,
            expiry_date DATE,
            company_name TEXT,
            product_code INTEGER
        )`);

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

        // Safe Migrations
        db.run("ALTER TABLE products ADD COLUMN company_name TEXT", () => { });
        db.run("ALTER TABLE products ADD COLUMN product_code INTEGER", () => { });
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