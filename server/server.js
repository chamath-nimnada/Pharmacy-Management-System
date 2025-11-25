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
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.post('/api/products', (req, res) => {
    const { barcode, name, price, category, qty, expiry_date } = req.body;
    // Check if barcode exists first
    db.get("SELECT id FROM products WHERE barcode = ?", [barcode], (err, row) => {
        if (row) return res.status(400).json({ error: "Barcode already exists" });

        const sql = 'INSERT INTO products (barcode, name, price, category, qty, expiry_date) VALUES (?,?,?,?,?,?)';
        db.run(sql, [barcode, name, price, category, qty, expiry_date], function (err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ id: this.lastID });
        });
    });
});

// --- 2. SALES ROUTES ---
app.post('/api/sale', (req, res) => {
    const { items, total, method } = req.body;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const stmt = db.prepare('UPDATE products SET qty = qty - ? WHERE id = ?');
        items.forEach(item => {
            stmt.run(item.buyQty, item.id);
        });
        stmt.finalize();

        db.run('INSERT INTO sales (total_amount, payment_method) VALUES (?,?)', [total, method], function (err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }
            db.run('COMMIT');
            res.json({ message: "Sale Complete", saleId: this.lastID });
        });
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

// --- 4. DASHBOARD STATS (NEW) ---
app.get('/api/dashboard-stats', (req, res) => {
    const stats = {};

    // Using simple callbacks to chain these queries (Promises would be cleaner, but keeping it simple for SQLite3)
    // 1. Today's Sales
    db.get("SELECT SUM(total_amount) as total FROM sales WHERE date >= date('now', 'start of day')", (err, row) => {
        stats.todaySales = row ? row.total : 0;

        // 2. Monthly Sales
        db.get("SELECT SUM(total_amount) as total FROM sales WHERE date >= date('now', 'start of month')", (err, row) => {
            stats.monthlySales = row ? row.total : 0;

            // 3. Pending Payments (Purchases)
            db.get("SELECT SUM(amount) as total FROM invoices WHERE status = 'Pending'", (err, row) => {
                stats.pendingPayments = row ? row.total : 0;

                // 4. Total Products
                db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
                    stats.totalProducts = row ? row.count : 0;

                    // 5. Low Stock/Expiry Alerts
                    db.all("SELECT * FROM products WHERE qty < 10 OR expiry_date < date('now', '+3 months')", (err, alerts) => {
                        stats.alerts = alerts;

                        // 6. Recent Sales for Chart (Last 7 sales)
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

app.listen(3000, () => {
    console.log('Server running on port 3000');
});