const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

let mainWindow;
const dbPath = path.join(app.getPath('userData'), 'pharmacy_v4.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('DB Error:', err);
    else console.log('Connected to Database v4');
});

// --- DATABASE SCHEMA ---
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        barcode TEXT UNIQUE,
        category TEXT, 
        price REAL,
        reorder_level INTEGER DEFAULT 10
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        batch_code TEXT, 
        expiry_date TEXT,
        quantity INTEGER,
        FOREIGN KEY(product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_date TEXT,
        total_amount REAL,
        payment_method TEXT,
        details JSON
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier TEXT,
        invoice_no TEXT,
        total_amount REAL,
        due_date TEXT,
        is_paid INTEGER DEFAULT 0
    )`);
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 768,
        minWidth: 1200,
        backgroundColor: '#f3f4f6',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

// --- IPC HANDLERS ---

// 1. ADD STOCK (Removed Reorder Level from input, defaulted to 10)
ipcMain.handle('add-stock', async (event, data) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            db.get("SELECT id FROM products WHERE barcode = ?", [data.barcode], (err, row) => {
                if (err) { db.run("ROLLBACK"); return reject(err); }

                let productId = row ? row.id : null;

                const finalize = (pid) => {
                    const autoBatchCode = 'B_' + Date.now(); // Auto-generated batch
                    db.run(`INSERT INTO batches (product_id, batch_code, expiry_date, quantity) VALUES (?, ?, ?, ?)`,
                        [pid, autoBatchCode, data.expiry, data.qty],
                        (err) => {
                            if (err) { db.run("ROLLBACK"); reject(err); }
                            else { db.run("COMMIT"); resolve("Stock Added"); }
                        });
                };

                if (!productId) {
                    // Default reorder_level set to 10
                    db.run(`INSERT INTO products (name, barcode, category, price, reorder_level) VALUES (?, ?, ?, ?, 10)`,
                        [data.name, data.barcode, data.category, data.price],
                        function (err) {
                            if (err) { db.run("ROLLBACK"); reject(err); }
                            else finalize(this.lastID);
                        });
                } else {
                    // Update price/category if changed
                    db.run(`UPDATE products SET name=?, category=?, price=? WHERE id=?`,
                        [data.name, data.category, data.price, productId]);
                    finalize(productId);
                }
            });
        });
    });
});

// 2. PROCESS SALE (Returns Receipt Data)
ipcMain.handle('process-sale', async (event, saleData) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            const promises = saleData.items.map(item => {
                return new Promise((resItem, rejItem) => {
                    let qtyNeeded = item.qty;
                    db.all(`SELECT * FROM batches WHERE product_id = ? AND quantity > 0 ORDER BY expiry_date ASC`,
                        [item.id], (err, batches) => {
                            if (err) return rejItem(err);

                            let batchUpdates = [];
                            let allocated = 0;
                            for (let batch of batches) {
                                if (qtyNeeded <= 0) break;
                                let take = Math.min(batch.quantity, qtyNeeded);
                                qtyNeeded -= take;
                                allocated += take;
                                batchUpdates.push(new Promise((resUp) => {
                                    db.run(`UPDATE batches SET quantity = quantity - ? WHERE id = ?`, [take, batch.id], resUp);
                                }));
                            }
                            if (qtyNeeded > 0) rejItem(new Error(`Insufficient stock for ${item.name}`));
                            else Promise.all(batchUpdates).then(resItem);
                        });
                });
            });

            Promise.all(promises)
                .then(() => {
                    const date = new Date().toISOString();
                    db.run(`INSERT INTO sales (sale_date, total_amount, payment_method, details) VALUES (?, ?, ?, ?)`,
                        [date, saleData.total, saleData.paymentMethod, JSON.stringify(saleData.items)],
                        function (err) {
                            if (err) { db.run("ROLLBACK"); reject(err); }
                            else {
                                db.run("COMMIT");
                                // Return sale ID and Date for receipt
                                resolve({ saleId: this.lastID, date: date });
                            }
                        });
                })
                .catch(err => {
                    db.run("ROLLBACK");
                    reject(err.message);
                });
        });
    });
});

// --- STANDARD HANDLERS (No changes) ---
ipcMain.handle('get-inventory', (event, categoryFilter) => {
    return new Promise((resolve, reject) => {
        let sql = `SELECT p.*, SUM(b.quantity) as total_stock, MIN(b.expiry_date) as next_expiry FROM products p LEFT JOIN batches b ON p.id = b.product_id`;
        let params = [];
        if (categoryFilter && categoryFilter !== 'All') { sql += ` WHERE p.category = ? `; params.push(categoryFilter); }
        sql += ` GROUP BY p.id ORDER BY p.name ASC`;
        db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
    });
});
ipcMain.handle('search-product', (event, query) => {
    return new Promise((resolve, reject) => {
        const sql = `SELECT p.*, SUM(b.quantity) as total_stock FROM products p LEFT JOIN batches b ON p.id = b.product_id WHERE p.barcode = ? OR p.name LIKE ? GROUP BY p.id`;
        db.get(sql, [query, `%${query}%`], (err, row) => { if (err) reject(err); else resolve(row); });
    });
});
ipcMain.handle('get-dashboard-data', () => {
    return new Promise(async (resolve) => {
        const data = {};
        db.get("SELECT SUM(total_amount) as total, COUNT(*) as count FROM sales WHERE date(sale_date) = date('now')", (e, r) => { data.todayTotal = r.total || 0; data.todayCount = r.count || 0; });
        db.all(`SELECT p.name, SUM(b.quantity) as stock FROM products p JOIN batches b ON p.id = b.product_id GROUP BY p.id HAVING stock <= p.reorder_level`, (e, r) => data.lowStock = r || []);
        db.all(`SELECT p.name, b.expiry_date FROM batches b JOIN products p ON b.product_id = p.id WHERE b.expiry_date <= date('now', '+30 days') AND b.quantity > 0 ORDER BY b.expiry_date ASC`, (e, r) => data.expiring = r || []);
        db.all(`SELECT * FROM purchases WHERE is_paid = 0 AND due_date <= date('now', '+7 days') ORDER BY due_date ASC`, (e, r) => data.dueInvoices = r || []);
        setTimeout(() => resolve(data), 300);
    });
});
ipcMain.handle('add-purchase', (event, data) => {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO purchases (supplier, invoice_no, total_amount, due_date) VALUES (?,?,?,?)`, [data.supplier, data.invoice, data.total, data.due], (err) => (err ? reject(err) : resolve("Saved")));
    });
});