const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// --- 1. INVENTORY ROUTES ---
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products ORDER BY expiry_date ASC", [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.post('/api/products', (req, res) => {
    const { barcode, name, price, category, qty, expiry_date } = req.body;

    // Check if a batch with SAME barcode AND SAME expiry exists
    db.get("SELECT id, qty FROM products WHERE barcode = ? AND expiry_date = ?", [barcode, expiry_date], (err, row) => {
        if (row) {
            // Update existing batch quantity
            // FIXED TYPO: Changed SETZF to SET
            db.run("UPDATE products SET qty = qty + ? WHERE id = ?", [qty, row.id], function (err) {
                if (err) return res.status(400).json({ error: err.message });
                res.json({ message: "Stock Updated", id: row.id });
            });
        } else {
            // Create New Batch
            const sql = 'INSERT INTO products (barcode, name, price, category, qty, expiry_date) VALUES (?,?,?,?,?,?)';
            db.run(sql, [barcode, name, price, category, qty, expiry_date], function (err) {
                if (err) return res.status(400).json({ error: err.message });
                res.json({ message: "New Batch Added", id: this.lastID });
            });
        }
    });
});

// --- 2. SALES ROUTES (FIFO LOGIC) ---
app.post('/api/sale', (req, res) => {
    const { items, total, method } = req.body;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        let errorOccurred = false;

        const processItem = (index) => {
            if (index >= items.length) {
                if (!errorOccurred) {
                    db.run('INSERT INTO sales (total_amount, payment_method) VALUES (?,?)', [total, method], function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: err.message });
                        }
                        db.run('COMMIT');
                        res.json({ message: "Sale Complete", saleId: this.lastID });
                    });
                }
                return;
            }

            const item = items[index];
            let qtyNeeded = item.buyQty;

            // FIFO: Find batches ordered by oldest expiry first
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
    db.all("SELECT * FROM sales ORDER BY date DESC", [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});

// --- 3. PURCHASE ROUTES ---
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

// --- 4. DASHBOARD STATS ---
app.get('/api/dashboard-stats', (req, res) => {
    const stats = {};

    // FIXED TYPO: Added space between SELECT and SUM
    db.get("SELECT SUM(total_amount) as total FROM sales WHERE date >= date('now', 'start of day')", (err, row) => {
        stats.todaySales = row ? row.total : 0;

        db.get("SELECT SUM(total_amount) as total FROM sales WHERE date >= date('now', 'start of month')", (err, row) => {
            stats.monthlySales = row ? row.total : 0;

            db.get("SELECT SUM(amount) as total FROM invoices WHERE status = 'Pending'", (err, row) => {
                stats.pendingPayments = row ? row.total : 0;

                db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
                    stats.totalProducts = row ? row.count : 0;

                    db.all("SELECT * FROM products WHERE qty < 10 OR expiry_date < date('now', '+3 months')", (err, alerts) => {
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