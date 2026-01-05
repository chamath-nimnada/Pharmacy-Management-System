const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('./database');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// --- 1. DATABASE MANAGEMENT ROUTES ---
app.get('/api/export-db', (req, res) => {
    const file = db.getDbPath();
    res.download(file, `pharmacy_backup_${new Date().toISOString().split('T')[0]}.db`);
});

app.post('/api/import-db', upload.single('database'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const tempPath = req.file.path;
    const targetPath = db.getDbPath();
    db.close((err) => {
        if (err) return res.status(500).json({ error: "Failed to close database for import." });
        fs.copyFile(tempPath, targetPath, (err) => {
            db.reconnect();
            fs.unlink(tempPath, () => { });
            if (err) return res.status(500).json({ error: "Failed to replace database file." });
            res.json({ message: "Database Imported Successfully!" });
        });
    });
});

// --- 2. INVENTORY ROUTES ---
app.get('/api/products', (req, res) => {
    // Optimization: Only fetch what's needed or assume frontend handles 1000 items (filtering logic handles this)
    db.all("SELECT * FROM products ORDER BY expiry_date ASC", [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.post('/api/products', (req, res) => {
    const { barcode, generic_name, trade_name, price, category, qty, expiry_date, company_name } = req.body;
    db.get("SELECT product_code FROM products WHERE barcode = ?", [barcode], (err, existingCodeRow) => {
        if (err) return res.status(500).json({ error: err.message });
        let finalProductCode;
        const proceedToSave = (pCode) => {
            db.get("SELECT id, qty FROM products WHERE barcode = ? AND expiry_date = ?", [barcode, expiry_date], (err, row) => {
                if (row) {
                    db.run("UPDATE products SET qty = qty + ?, company_name = ?, generic_name = ?, trade_name = ? WHERE id = ?",
                        [qty, company_name, generic_name, trade_name, row.id],
                        function (err) {
                            if (err) return res.status(400).json({ error: err.message });
                            res.json({ message: "Stock Updated", id: row.id, product_code: pCode });
                        }
                    );
                } else {
                    const sql = `INSERT INTO products (barcode, generic_name, trade_name, price, category, qty, expiry_date, company_name, product_code) 
                                 VALUES (?,?,?,?,?,?,?,?,?)`;
                    db.run(sql, [barcode, generic_name, trade_name, price, category, qty, expiry_date, company_name, pCode], function (err) {
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

app.put('/api/products/:code', (req, res) => {
    const { generic_name, trade_name, company_name, price, category } = req.body;
    db.run("UPDATE products SET generic_name = ?, trade_name = ?, company_name = ?, price = ?, category = ? WHERE product_code = ?",
        [generic_name, trade_name, company_name, price, category, req.params.code],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Product updated", changes: this.changes });
        }
    );
});

app.delete('/api/products/:code', (req, res) => {
    db.run("DELETE FROM products WHERE product_code = ?", [req.params.code], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Product deleted", changes: this.changes });
    });
});

app.put('/api/batch/:id', (req, res) => {
    const { qty, expiry_date } = req.body;
    db.run("UPDATE products SET qty = ?, expiry_date = ? WHERE id = ?", [qty, expiry_date, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Batch updated", changes: this.changes });
    });
});

app.delete('/api/batch/:id', (req, res) => {
    db.run("DELETE FROM products WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Batch deleted", changes: this.changes });
    });
});

// --- 3. SALES ROUTES ---
app.post('/api/sale', (req, res) => {
    const { items, total, method, patientName } = req.body;
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localDateStr = new Date(now - offset).toISOString().slice(0, 19).replace('T', ' ');

    // Use try-catch to ensure we don't crash the server silently
    try {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            let errorOccurred = false;

            const processItem = (index) => {
                if (index >= items.length) {
                    if (!errorOccurred) {
                        db.run('INSERT INTO sales (total_amount, payment_method, date, patient_name) VALUES (?,?,?,?)',
                            [total, method, localDateStr, patientName],
                            function (err) {
                                if (err) {
                                    console.error("Sale Insert Error:", err);
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: err.message });
                                }

                                const saleId = this.lastID;
                                const itemStmt = db.prepare("INSERT INTO sale_items (sale_id, product_name, qty, price, category) VALUES (?,?,?,?,?)");

                                items.forEach(item => {
                                    const pName = item.trade_name || item.name || "Unknown Item";
                                    const pQty = item.buyQty || 0;
                                    const pPrice = item.price || 0;
                                    const pCat = item.category || 'Other';
                                    itemStmt.run(saleId, pName, pQty, pPrice, pCat);
                                });

                                itemStmt.finalize();
                                db.run('COMMIT');
                                res.json({ message: "Sale Complete", saleId: saleId });
                            }
                        );
                    }
                    return;
                }

                const item = items[index];
                let qtyNeeded = item.buyQty;

                db.all("SELECT id, qty FROM products WHERE barcode = ? AND qty > 0 ORDER BY expiry_date ASC", [item.barcode], (err, batches) => {
                    if (err || !batches || batches.length === 0) {
                        errorOccurred = true;
                        db.run('ROLLBACK');
                        return res.status(400).json({ error: `Out of stock: ${item.trade_name || item.name}` });
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
                        return res.status(400).json({ error: `Not enough stock: ${item.trade_name || item.name}` });
                    }

                    const runUpdates = (uIndex) => {
                        if (uIndex >= updates.length) { processItem(index + 1); return; }

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
    } catch (e) {
        console.error("Server Crash Loop Prevented:", e);
        res.status(500).json({ error: "Server Transaction Error" });
    }
});

app.get('/api/sales', (req, res) => {
    // CRITICAL FIX: Limit results to 200 to prevent crashing the frontend/network
    // Also use COALESCE to handle potential NULLs in concatenation
    const query = `
        SELECT s.id, s.date, s.total_amount, s.payment_method, s.patient_name,
        GROUP_CONCAT(COALESCE(si.product_name, 'Unknown') || ' (' || COALESCE(si.qty, 0) || ')', ', ') as items_list 
        FROM sales s 
        LEFT JOIN sale_items si ON s.id = si.sale_id 
        GROUP BY s.id 
        ORDER BY s.date DESC 
        LIMIT 200
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.get('/api/sales/:id', (req, res) => {
    const saleId = req.params.id;
    db.get("SELECT * FROM sales WHERE id = ?", [saleId], (err, sale) => {
        if (err || !sale) return res.status(404).json({ error: "Sale not found" });
        db.all("SELECT * FROM sale_items WHERE sale_id = ?", [saleId], (err, items) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ...sale, items });
        });
    });
});

app.get('/api/sales-summary', (req, res) => {
    const { date, category } = req.query;
    let query = `
        SELECT SUM(si.qty * si.price) as total 
        FROM sale_items si 
        JOIN sales s ON si.sale_id = s.id 
        WHERE date(s.date) = date(?)
    `;
    const params = [date];

    if (category && category !== 'all') {
        query += " AND si.category = ?";
        params.push(category);
    }

    db.get(query, params, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ total: row ? row.total || 0 : 0 });
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
    const { supplier_name, invoice_number, amount, purchase_date, due_days, due_date, status } = req.body;
    const sql = `INSERT INTO invoices (supplier_name, invoice_number, amount, purchase_date, due_days, due_date, status) VALUES (?,?,?,?,?,?,?)`;
    db.run(sql, [supplier_name, invoice_number, amount, purchase_date, due_days, due_date, status], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Invoice Added", id: this.lastID });
    });
});

app.put('/api/purchases/:id', (req, res) => {
    const { supplier_name, invoice_number, amount, purchase_date, due_days, due_date, status } = req.body;
    const sql = `UPDATE invoices SET supplier_name=?, invoice_number=?, amount=?, purchase_date=?, due_days=?, due_date=?, status=? WHERE id=?`;
    db.run(sql, [supplier_name, invoice_number, amount, purchase_date, due_days, due_date, status, req.params.id], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Invoice Updated", changes: this.changes });
    });
});

app.delete('/api/purchases/:id', (req, res) => {
    db.run("DELETE FROM invoices WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Invoice Deleted", changes: this.changes });
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
    const lowStockThreshold = parseInt(req.query.minStock) || 10;
    const expiryDays = parseInt(req.query.minExpiryDays) || 90;
    const pendingDays = parseInt(req.query.pendingDays) || 30;
    const category = req.query.category || 'all';

    let todaySql, monthlySql, productsSql, alertsSql, chartSql;

    if (category === 'all') {
        todaySql = "SELECT SUM(total_amount) as total FROM sales WHERE date >= date('now', 'start of day')";
        monthlySql = "SELECT SUM(total_amount) as total FROM sales WHERE date >= date('now', 'start of month')";
        productsSql = "SELECT COUNT(*) as count FROM products";
        alertsSql = `SELECT * FROM products WHERE qty < ? OR expiry_date < date('now', '+' || ? || ' days')`;
        chartSql = "SELECT date, total_amount FROM sales ORDER BY date DESC LIMIT 7";
    } else {
        todaySql = `SELECT SUM(si.qty * si.price) as total FROM sale_items si JOIN sales s ON si.sale_id = s.id 
                    WHERE si.category = ? AND s.date >= date('now', 'start of day')`;
        monthlySql = `SELECT SUM(si.qty * si.price) as total FROM sale_items si JOIN sales s ON si.sale_id = s.id 
                      WHERE si.category = ? AND s.date >= date('now', 'start of month')`;
        productsSql = "SELECT COUNT(*) as count FROM products WHERE category = ?";
        alertsSql = `SELECT * FROM products WHERE (qty < ? OR expiry_date < date('now', '+' || ? || ' days')) AND category = ?`;
        chartSql = `SELECT date(s.date) as date, SUM(si.qty * si.price) as total_amount FROM sale_items si JOIN sales s ON si.sale_id = s.id 
                    WHERE si.category = ? GROUP BY date(s.date) ORDER BY s.date DESC LIMIT 7`;
    }

    db.get(todaySql, category === 'all' ? [] : [category], (err, row) => {
        stats.todaySales = row ? row.total || 0 : 0;
        db.get(monthlySql, category === 'all' ? [] : [category], (err, row) => {
            stats.monthlySales = row ? row.total || 0 : 0;
            db.get("SELECT SUM(amount) as total FROM invoices WHERE status = 'Pending' AND due_date <= date('now', '+' || ? || ' days')", [pendingDays], (err, row) => {
                stats.pendingPayments = row ? row.total || 0 : 0;
                db.get(productsSql, category === 'all' ? [] : [category], (err, row) => {
                    stats.totalProducts = row ? row.count || 0 : 0;

                    let aParams = category === 'all' ? [lowStockThreshold, expiryDays] : [lowStockThreshold, expiryDays, category];
                    db.all(alertsSql, aParams, (err, alerts) => {
                        stats.alerts = alerts ? alerts.map(a => ({ ...a, name: a.trade_name || a.name })) : [];

                        db.all(chartSql, category === 'all' ? [] : [category], (err, chartData) => {
                            stats.chartData = chartData || [];
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
    app.listen(3000, () => { console.log('Server running on port 3000'); });
}