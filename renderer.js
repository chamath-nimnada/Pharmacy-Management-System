let cart = [];

// --- UI HELPERS ---
function showLoader() { document.getElementById('global-loader').classList.remove('hidden'); }
function hideLoader() { document.getElementById('global-loader').classList.add('hidden'); }

function nav(id) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    // Find button that calls this function (rough logic, usually passed via event)
    const btns = Array.from(document.querySelectorAll('.nav-btn'));
    const targetBtn = btns.find(b => b.getAttribute('onclick').includes(id));
    if (targetBtn) targetBtn.classList.add('active');

    document.querySelectorAll('.view').forEach(v => {
        v.classList.add('hidden');
        v.classList.remove('fade-in');
    });
    const activeView = document.getElementById(id);
    activeView.classList.remove('hidden');
    // Force Reflow
    void activeView.offsetWidth;
    activeView.classList.add('fade-in');

    if (id === 'dashboard') loadDashboard();
    if (id === 'inventory') loadInventory();
    if (id === 'pos') document.getElementById('posInput').focus();
}

// --- DASHBOARD ---
async function loadDashboard() {
    showLoader();
    const data = await window.api.getDashboard();
    document.getElementById('d-sales-total').innerText = `₹${data.todayTotal.toFixed(2)}`;
    document.getElementById('d-sales-count').innerText = data.todayCount;
    document.getElementById('d-low-count').innerText = data.lowStock.length;
    document.getElementById('d-expiry-count').innerText = data.expiring.length;
    document.getElementById('d-due-count').innerText = data.dueInvoices.length;

    fillAlertList('lowStockList', data.lowStock.map(x => `Low stock: ${x.name} (${x.stock})`), '⚠️');
    fillAlertList('expiryList', data.expiring.map(x => `${x.name} expires ${x.expiry_date}`), '⏰');
    fillAlertList('dueList', data.dueInvoices.map(x => `Inv#${x.invoice_no} due ${x.due_date}`), '🔔');
    hideLoader();
}
function fillAlertList(elementId, items, icon) {
    document.getElementById(elementId).innerHTML = items.length ? items.map(i => `<li>${icon} ${i}</li>`).join('') : '<li style="color:#ccc">No alerts</li>';
}

// --- INVENTORY ---
async function loadInventory() {
    showLoader();
    const filterCategory = document.getElementById('invFilter').value;
    const items = await window.api.getInventory(filterCategory);
    document.querySelector('#invTable tbody').innerHTML = items.map(i => `
        <tr>
            <td><strong>${i.name}</strong></td>
            <td>${i.barcode}</td>
            <td><span class="badge">${i.category || 'General'}</span></td>
            <td>₹${i.price.toFixed(2)}</td>
            <td style="font-weight:bold; color:${(i.total_stock || 0) <= i.reorder_level ? '#dc2626' : '#059669'}">${i.total_stock || 0}</td>
            <td style="color:#6b7280; font-size:13px">${i.next_expiry || 'N/A'}</td>
        </tr>
    `).join('');
    hideLoader();
}

function openModal(id) {
    if (id === 'modal-add-stock') {
        ['mBar', 'mName', 'mPrice', 'mQty', 'mExp'].forEach(pid => document.getElementById(pid).value = '');
        document.getElementById('mName').readOnly = false;
        document.getElementById('mCat').disabled = false;
    }
    document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

async function checkProductExistence() {
    const barcode = document.getElementById('mBar').value;
    if (!barcode) return;
    showLoader();
    const p = await window.api.searchProduct(barcode);
    hideLoader();
    if (p) {
        document.getElementById('mName').value = p.name;
        document.getElementById('mPrice').value = p.price;
        document.getElementById('mCat').value = p.category || 'Medicine';
        document.getElementById('mName').readOnly = true;
        document.getElementById('mCat').disabled = true;
    }
}

async function submitStock() {
    // Removed Reorder Level reading
    const data = {
        barcode: document.getElementById('mBar').value,
        category: document.getElementById('mCat').value,
        name: document.getElementById('mName').value,
        price: parseFloat(document.getElementById('mPrice').value),
        qty: parseInt(document.getElementById('mQty').value),
        expiry: document.getElementById('mExp').value
    };

    if (!data.barcode || !data.name || !data.qty || !data.expiry) {
        alert("Please fill all marked (*) fields"); return;
    }

    showLoader();
    try {
        await window.api.addStock(data);
        alert("Stock Added!");
        closeModal('modal-add-stock');
        loadInventory();
    } catch (e) { alert("Error: " + e); }
    hideLoader();
}

// --- POS & PRINTING ---
document.getElementById('posInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') triggerSearch(); });

async function triggerSearch() {
    const input = document.getElementById('posInput');
    const val = input.value.trim();
    if (!val) return;
    showLoader();
    const product = await window.api.searchProduct(val);
    hideLoader();
    if (product) {
        if (!product.total_stock || product.total_stock <= 0) alert("Out of Stock!");
        else { addToCart(product); input.value = ''; }
    } else alert("Product not found");
}

function addToCart(p) {
    const existing = cart.find(x => x.id === p.id);
    if (existing) existing.qty++;
    else cart.push({ ...p, qty: 1 });
    renderCart();
}

function renderCart() {
    const tbody = document.querySelector('#cartTable tbody');
    tbody.innerHTML = '';
    let total = 0;
    if (cart.length === 0) document.getElementById('emptyCartMsg').style.display = 'block';
    else {
        document.getElementById('emptyCartMsg').style.display = 'none';
        cart.forEach((item, idx) => {
            total += item.price * item.qty;
            tbody.innerHTML += `
                <tr>
                    <td>${item.name}</td>
                    <td>₹${item.price}</td>
                    <td><input type="number" value="${item.qty}" class="qty-input" min="1" onchange="updateQty(${idx}, this.value)"></td>
                    <td>₹${(item.price * item.qty).toFixed(2)}</td>
                    <td><button class="btn-icon" onclick="remItem(${idx})">✕</button></td>
                </tr>`;
        });
    }
    document.getElementById('billSubtotal').innerText = `₹${total.toFixed(2)}`;
    document.getElementById('billTotal').innerText = `₹${total.toFixed(2)}`;
}

function updateQty(idx, val) { cart[idx].qty = parseInt(val) || 1; renderCart(); }
function remItem(idx) { cart.splice(idx, 1); renderCart(); }

async function checkout() {
    if (cart.length === 0) { alert("Cart is empty!"); return; }

    const total = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const payMethod = document.getElementById('payMethod').value;
    const custName = document.getElementById('custName').value || 'Walk-in Customer';

    showLoader();
    try {
        // 1. Process Sale
        const result = await window.api.processSale({ items: cart, total, paymentMethod: payMethod });

        // 2. Generate Receipt HTML
        generateReceipt(result.saleId, result.date, custName, cart, total, payMethod);

        // 3. Print
        window.print();

        // 4. Cleanup
        cart = [];
        renderCart();
        document.getElementById('custName').value = '';
    } catch (err) {
        alert("Sale Failed: " + err);
    }
    hideLoader();
}

function generateReceipt(saleId, dateStr, customer, items, total, method) {
    const date = new Date(dateStr).toLocaleString();
    let rows = items.map(i => `
        <tr>
            <td class="item-name">${i.name}</td>
            <td>${i.qty}</td>
            <td class="price">${(i.price * i.qty).toFixed(2)}</td>
        </tr>
    `).join('');

    const html = `
        <div class="receipt-container">
            <h2 class="center">PHARMACY PLUS</h2>
            <p class="center">123 Main Street, City</p>
            <p class="center">Tel: 011-2345678</p>
            <hr class="dashed">
            <div class="meta">
                <span>Inv: #${saleId}</span>
                <span>${date}</span>
            </div>
            <div class="meta">
                <span>Cust: ${customer}</span>
                <span>Mode: ${method}</span>
            </div>
            <hr class="dashed">
            <table>
                <thead><tr><th class="left">Item</th><th>Qty</th><th class="right">Amt</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <hr class="dashed">
            <div class="total-row">
                <span>TOTAL:</span>
                <span>₹${total.toFixed(2)}</span>
            </div>
            <hr class="dashed">
            <p class="center">Thank You!<br>No Returns.</p>
        </div>
    `;
    document.getElementById('print-area').innerHTML = html;
}

// --- PURCHASES ---
async function savePurchase() {
    const data = {
        supplier: document.getElementById('pSup').value,
        invoice: document.getElementById('pInv').value,
        total: parseFloat(document.getElementById('pAmt').value),
        due: document.getElementById('pDue').value
    };
    if (!data.supplier || !data.total || !data.due) { alert("Fill all fields"); return; }
    showLoader();
    await window.api.addPurchase(data);
    hideLoader();
    alert("Saved");
    ['pSup', 'pInv', 'pAmt', 'pDue'].forEach(id => document.getElementById(id).value = '');
}

loadDashboard();