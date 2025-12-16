const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); // For file uploads
const fs = require('fs');
const db = require('./database'); // Imports our new Proxy Object

const app = express();
const upload = multer({ dest: 'uploads/' }); // Temp upload folder

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// --- 1. DATABASE MANAGEMENT ROUTES ---

// Export Database
app.get('/api/export-db', (req, res) => {
    const file = db.getDbPath();
    res.download(file, `pharmacy_backup_${new Date().toISOString().split('T')[0]}.db`);
});

// Import Database
app.post('/api/import-db', upload.single('database'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const tempPath = req.file.path;
    const targetPath = db.getDbPath();

    // 1. Close existing connection to release file lock
    db.close((err) => {
        if (err) {
            console.error("Error closing DB:", err);
            return res.status(500).json({ error: "Failed to close database for import." });
        }

        // 2. Overwrite the database file
        fs.copyFile(tempPath, targetPath, (err) => {
            // Always try to reconnect, even if copy failed, to keep app alive
            db.reconnect();

            // Delete temp file
            fs.unlink(tempPath, () => { });

            if (err) {
                console.error("Error overwriting DB:", err);
                return res.status(500).json({ error: "Failed to replace database file." });
            }

            res.json({ message: "Database Imported Successfully!" });
        });
    });
});

// --- 2. INVENTORY ROUTES ---
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products ORDER BY expiry_date ASC", [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.post('/api/products', (req, res) => {
    const { barcode, name, price, category, qty, expiry_date, company_name } = req.body;

    // 1. Get or Generate Product Code
    db.get("SELECT product_code FROM products WHERE barcode = ?", [barcode], (err, existingCodeRow) => {
        if (err) return res.status(500).json({ error: err.message });

        let finalProductCode;

        const proceedToSave = (pCode) => {
            db.get("SELECT id, qty FROM products WHERE barcode = ? AND expiry_date = ?", [barcode, expiry_date], (err, row) => {
                if (row) {
                    // Update
                    db.run("UPDATE products SET qty = qty + ?, company_name = ? WHERE id = ?",
                        [qty, company_name, row.id],
                        function (err) {
                            if (err) return res.status(400).json({ error: err.message });
                            res.json({ message: "Stock Updated", id: row.id, product_code: pCode });
                        }
                    );
                } else {
                    // Insert
                    const sql = `INSERT INTO products (barcode, name, price, category, qty, expiry_date, company_name, product_code) 
                                 VALUES (?,?,?,?,?,?,?,?)`;
                    db.run(sql, [barcode, name, price, category, qty, expiry_date, company_name, pCode], function (err) {
                        if (err) return res.status(400).json({ error: err.message });
                        res.json({ message: "New Batch Added", id: this.lastID, product_code: pCode });
                    });
                }
            });
        };

        if (existingCodeRow && existingCodeRow.product_code) {
            finalProductCode = existingCodeRow.product_code;
            proceedToSave(finalProductCode);
        } else {
            db.get("SELECT MAX(product_code) as maxVal FROM products", (err, maxRow) => {
                finalProductCode = (maxRow && maxRow.maxVal) ? maxRow.maxVal + 1 : 1001;
                proceedToSave(finalProductCode);
            });
        }
    });
});

// UPDATE Product Details (General Info)
app.put('/api/products/:code', (req, res) => {
    const { name, company_name, price, category } = req.body;
    const code = req.params.code;
    db.run(
        "UPDATE products SET name = ?, company_name = ?, price = ?, category = ? WHERE product_code = ?",
        [name, company_name, price, category, code],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Product updated", changes: this.changes });
        }
    );
});

// Delete Product (All batches with this ID)
app.delete('/api/products/:code', (req, res) => {
    const code = req.params.code;
    db.run("DELETE FROM products WHERE product_code = ?", [code], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Product deleted", changes: this.changes });
    });
});

// --- NEW: BATCH MANAGEMENT ROUTES ---

// Update specific batch
app.put('/api/batch/:id', (req, res) => {
    const { qty, expiry_date } = req.body;
    const id = req.params.id;
    db.run(
        "UPDATE products SET qty = ?, expiry_date = ? WHERE id = ?",
        [qty, expiry_date, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Batch updated", changes: this.changes });
        }
    );
});

// Delete specific batch
app.delete('/api/batch/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM products WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Batch deleted", changes: this.changes });
    });
});


// --- 3. SALES ROUTES ---
app.post('/api/sale', (req, res) => {
    const { items, total, method } = req.body;

    // Get SYSTEM Local Date Time
    // This creates a string like '2025-12-16 14:30:45' based on the computer's timezone
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localDateStr = new Date(now - offset).toISOString().slice(0, 19).replace('T', ' ');

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        let errorOccurred = false;

        const processItem = (index) => {
            if (index >= items.length) {
                if (!errorOccurred) {
                    // UPDATED: Insert 'localDateStr' into the date field
                    db.run('INSERT INTO sales (total_amount, payment_method, date) VALUES (?,?,?)', [total, method, localDateStr], function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: err.message });
                        }

                        const saleId = this.lastID;
                        const itemStmt = db.prepare("INSERT INTO sale_items (sale_id, product_name, qty, price) VALUES (?,?,?,?)");
                        items.forEach(item => {
                            itemStmt.run(saleId, item.name, item.buyQty, item.price);
                        });
                        itemStmt.finalize();

                        db.run('COMMIT');
                        res.json({ message: "Sale Complete", saleId: saleId });
                    });
                }
                return;
            }

            const item = items[index];
            let qtyNeeded = item.buyQty;

            db.all("SELECT id, qty FROM products WHERE barcode = ? AND qty > 0 ORDER BY expiry_date ASC", [item.barcode], (err, batches) => {
                if (err || !batches || batches.length === 0) {
                    errorOccurred = true;
                    db.run('ROLLBACK');
                    return res.status(400).json({ error: `Out of stock for ${item.name}` });
                }

                const updates = [];
                for (let batch of batches) {
                    if (qtyNeeded <= 0) break;
                    let deduct = Math.min(qtyNeeded, batch.qty);
                    updates.push({ id: batch.id, newQty: batch.qty - deduct });
                    qtyNeeded -= deduct;
                }

                if (qtyNeeded > 0) {
                    errorOccurred = true;
                    db.run('ROLLBACK');
                    return res.status(400).json({ error: `Not enough stock for ${item.name}` });
                }

                const runUpdates = (uIndex) => {
                    if (uIndex >= updates.length) {
                        processItem(index + 1);
                        return;
                    }
                    db.run("UPDATE products SET qty = ? WHERE id = ?", [updates[uIndex].newQty, updates[uIndex].id], (err) => {
                        if (err) {
                            errorOccurred = true;
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: err.message });
                        }
                        runUpdates(uIndex + 1);
                    });
                };
                runUpdates(0);
            });
        };

        processItem(0);
    });
});

app.get('/api/sales', (req, res) => {
    const sql = `
        SELECT s.*, GROUP_CONCAT(si.product_name || ' (' || si.qty || ')', ', ') as items_list
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        GROUP BY s.id
        ORDER BY s.date DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});

// --- 4. PURCHASE ROUTES ---
app.get('/api/purchases', (req, res) => {
    db.all("SELECT * FROM invoices ORDER BY due_date ASC", [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.post('/api/purchases', (req, res) => {
    const { supplier_name, company_name, invoice_number, amount, due_date, status } = req.body;
    const sql = `INSERT INTO invoices (supplier_name, company_name, invoice_number, amount, due_date, status) 
                 VALUES (?,?,?,?,?,?)`;
    db.run(sql, [supplier_name, company_name, invoice_number, amount, due_date, status], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Invoice Added", id: this.lastID });
    });
});

app.put('/api/purchases/:id/pay', (req, res) => {
    db.run("UPDATE invoices SET status = 'Paid' WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Marked as Paid" });
    });
});

// --- 5. DASHBOARD STATS ---
app.get('/api/dashboard-stats', (req, res) => {
    const stats = {};
    
    // Get parameters from query or use defaults
    const lowStockThreshold = parseInt(req.query.minStock) || 10;
    const expiryDays = parseInt(req.query.minExpiryDays) || 90;
    const pendingDays = parseInt(req.query.pendingDays) || 30; // Default 30 days

    db.get("SELECT SUM(total_amount) as total FROM sales WHERE date >= date('now', 'start of day')", (err, row) => {
        stats.todaySales = row ? row.total : 0;

        db.get("SELECT SUM(total_amount) as total FROM sales WHERE date >= date('now', 'start of month')", (err, row) => {
            stats.monthlySales = row ? row.total : 0;

            // UPDATED: Filter by Pending Scope
            // Sums all pending invoices where due date is <= Today + X days (Covers Overdue + Near Future)
            db.get("SELECT SUM(amount) as total FROM invoices WHERE status = 'Pending' AND due_date <= date('now', '+' || ? || ' days')", [pendingDays], (err, row) => {
                stats.pendingPayments = row ? row.total : 0;

                db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
                    stats.totalProducts = row ? row.count : 0;

                    // Dynamic Alert Query based on settings
                    const alertSql = `SELECT * FROM products WHERE qty < ? OR expiry_date < date('now', '+' || ? || ' days')`;
                    
                    db.all(alertSql, [lowStockThreshold, expiryDays], (err, alerts) => {
                        stats.alerts = alerts;

                        db.all("SELECT date, total_amount FROM sales ORDER BY date DESC LIMIT 7", (err, chartData) => {
                            stats.chartData = chartData;
                            res.json(stats);
                        });
                    });
                });
            });
        });
    });
});

module.exports = app;

if (require.main === module) {
    app.listen(3000, () => {
        console.log('Server running on port 3000');
    });
}