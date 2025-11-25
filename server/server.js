const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public'))); // Serve frontend files

// --- API ROUTES ---

// 1. Inventory: Get All
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});

// 2. Inventory: Add Product
app.post('/api/products', (req, res) => {
    const { barcode, name, price, category, qty, expiry_date } = req.body;
    const sql = 'INSERT INTO products (barcode, name, price, category, qty, expiry_date) VALUES (?,?,?,?,?,?)';
    db.run(sql, [barcode, name, price, category, qty, expiry_date], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// 3. Billing: Process Sale
app.post('/api/sale', (req, res) => {
    const { items, total, method } = req.body;

    // Create Sale Record
    db.run('INSERT INTO sales (total_amount, payment_method) VALUES (?,?)', [total, method], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Update Inventory Qty (Simple Loop)
        items.forEach(item => {
            db.run('UPDATE products SET qty = qty - ? WHERE id = ?', [item.qty, item.id]);
        });

        res.json({ message: "Sale Complete", saleId: this.lastID });
    });
});

// 4. Dashboard: Low Stock & Expiry
app.get('/api/alerts', (req, res) => {
    const sql = `
        SELECT * FROM products 
        WHERE qty < 10 
        OR expiry_date < date('now', '+3 months')
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ alerts: rows });
    });
});

// Start Server
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
app.get('/api/purchases', (req, res) => {
    const sql = "SELECT * FROM invoices ORDER BY due_date ASC";
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});

// 2. Add New Invoice
app.post('/api/purchases', (req, res) => {
    const { supplier_name, company_name, invoice_number, amount, due_date, status } = req.body;
    const sql = `INSERT INTO invoices (supplier_name, company_name, invoice_number, amount, due_date, status) 
                 VALUES (?,?,?,?,?,?)`;

    db.run(sql, [supplier_name, company_name, invoice_number, amount, due_date, status], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Invoice Added", id: this.lastID });
    });
});

// 3. Mark Invoice as Paid
app.put('/api/purchases/:id/pay', (req, res) => {
    const sql = "UPDATE invoices SET status = 'Paid' WHERE id = ?";
    db.run(sql, [req.params.id], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Marked as Paid" });
    });
});