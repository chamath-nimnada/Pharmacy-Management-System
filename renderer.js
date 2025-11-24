let cart = [];

// --- UI HELPERS ---
let loaderCount = 0;
function showLoader() {
    loaderCount++;
    document.getElementById('global-loader').classList.remove('hidden');
}
function hideLoader() {
    loaderCount--;
    if (loaderCount <= 0) {
        loaderCount = 0;
        document.getElementById('global-loader').classList.add('hidden');
    }
}

function nav(id) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const btns = Array.from(document.querySelectorAll('.nav-btn'));
    const targetBtn = btns.find(b => b.getAttribute('onclick').includes(id));
    if (targetBtn) targetBtn.classList.add('active');

    document.querySelectorAll('.view').forEach(v => {
        v.classList.add('hidden');
        v.classList.remove('fade-in');
    });
    const activeView = document.getElementById(id);
    activeView.classList.remove('hidden');
    void activeView.offsetWidth;
    activeView.classList.add('fade-in');

    if (id === 'dashboard') loadDashboard();
    if (id === 'inventory') loadInventory();
    if (id === 'purchases') loadPurchases();
    if (id === 'sales-history') loadSalesHistory();
    if (id === 'pos') document.getElementById('posInput').focus();
}

// --- DASHBOARD ---
async function loadDashboard() {
    showLoader();
    try {
        const data = await window.api.getDashboard();
        document.getElementById('d-sales-total').innerText = `Rs.${data.todayTotal.toFixed(2)}`;
        document.getElementById('d-sales-count').innerText = data.todayCount;
        document.getElementById('d-month-total').innerText = `Rs.${data.monthTotal.toFixed(2)}`;
        document.getElementById('d-low-count').innerText = data.lowStock.length;
        document.getElementById('d-expiry-count').innerText = data.expiring.length;

        fillAlertList('lowStockList', data.lowStock.map(x => `Low stock: ${x.name} (${x.stock})`), '⚠️');
        fillAlertList('expiryList', data.expiring.map(x => `${x.name} expires ${x.expiry_date}`), '⏰');
        fillAlertList('dueList', data.dueInvoices.map(x => `Inv#${x.invoice_no} due ${x.due_date} (Rs.${x.total_amount})`), '🔔');
    } catch (e) { console.error(e); }
    hideLoader();
}

function fillAlertList(elementId, items, icon) {
    document.getElementById(elementId).innerHTML =
        items.length ? items.map(i => `<li>${icon} ${i}</li>`).join('') : '<li style="color:#ccc">No alerts</li>';
}

// --- MODAL MANAGEMENT ---
function openModal(id) {
    document.getElementById(id).classList.remove('hidden');

    if (id === 'modal-add-stock') {

        const fields = ['mBar', 'mName', 'mPrice', 'mQty', 'mExp'];
        fields.forEach(pid => {
            const el = document.getElementById(pid);
            el.value = '';
            el.disabled = false;
            el.readOnly = false;
        });

        const catEl = document.getElementById('mCat');
        catEl.disabled = false;
        catEl.value = 'Medicine';

        setTimeout(() => document.getElementById('mBar').focus(), 100);
    }

    if (id === 'modal-add-purchase') {
        ['pSup', 'pInv', 'pAmt', 'pDue'].forEach(pid => {
            const el = document.getElementById(pid);
            el.value = '';
            el.disabled = false;
            el.readOnly = false;
        });

        const statusEl = document.getElementById('pStatus');
        statusEl.disabled = false;
        statusEl.value = 'Pending';

        setTimeout(() => document.getElementById('pSup').focus(), 100);
    }
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');

    if (id === 'modal-add-stock') {
        const fields = ['mBar', 'mName', 'mPrice', 'mQty', 'mExp'];
        fields.forEach(pid => {
            const el = document.getElementById(pid);
            el.value = '';
            el.disabled = false;
            el.readOnly = false;
        });
        const catEl = document.getElementById('mCat');
        catEl.disabled = false;
        catEl.value = 'Medicine';
    }

    if (id === 'modal-add-purchase') {
        ['pSup', 'pInv', 'pAmt', 'pDue'].forEach(pid => {
            const el = document.getElementById(pid);
            el.value = '';
            el.disabled = false;
            el.readOnly = false;
        });
        const statusEl = document.getElementById('pStatus');
        statusEl.disabled = false;
        statusEl.value = 'Pending';
    }
}

// --- INVENTORY ---
async function loadInventory() {
    showLoader();
    try {
        const filterCategory = document.getElementById('invFilter').value;
        const items = await window.api.getInventory(filterCategory);
        document.querySelector('#invTable tbody').innerHTML = items.map(i => `
            <tr>
                <td><strong>${i.name}</strong></td>
                <td>${i.barcode}</td>
                <td><span class="badge" style="background:#e0f2fe; color:#0369a1;">${i.category || 'General'}</span></td>
                <td>Rs.${i.price.toFixed(2)}</td>
                <td style="font-weight:bold; color:${(i.total_stock || 0) <= i.reorder_level ? '#dc2626' : '#059669'}">
                    ${i.total_stock || 0}
                </td>
                <td style="color:#6b7280; font-size:13px">${i.next_expiry || 'N/A'}</td>
            </tr>
        `).join('');
    } catch (e) {
        alert("Error loading inventory");
    }
    hideLoader();
}

async function checkProductExistence() {
    const barcode = document.getElementById('mBar').value.trim();
    if (!barcode) return;

    showLoader();
    try {
        const p = await window.api.searchProduct(barcode);

        const nameField = document.getElementById('mName');
        const priceField = document.getElementById('mPrice');
        const catField = document.getElementById('mCat');

        if (p) {
            // Product exists - populate and lock name/category
            nameField.value = p.name;
            priceField.value = p.price;
            catField.value = p.category || 'Medicine';

            nameField.readOnly = true;
            catField.disabled = true;

        } else {
            // New product - clear and unlock all
            nameField.value = '';
            priceField.value = '';
            catField.value = 'Medicine';

            nameField.readOnly = false;
            catField.disabled = false;
        }

    } catch (e) {
        console.error(e);
    } finally {
        hideLoader();
    }
}

async function submitStock() {
    const data = {
        barcode: document.getElementById('mBar').value,
        category: document.getElementById('mCat').value,
        name: document.getElementById('mName').value,
        price: parseFloat(document.getElementById('mPrice').value),
        qty: parseInt(document.getElementById('mQty').value),
        expiry: document.getElementById('mExp').value
    };

    if (!data.barcode || !data.name || !data.qty || !data.expiry) {
        alert("Please fill all marked (*) fields");
        return;
    }

    showLoader();
    try {
        await window.api.addStock(data);
        alert("Stock Added!");

        const fields = ['mBar', 'mName', 'mPrice', 'mQty', 'mExp'];
        fields.forEach(pid => {
            const el = document.getElementById(pid);
            el.value = '';
            el.disabled = false;
            el.readOnly = false;
        });
        const catEl = document.getElementById('mCat');
        catEl.disabled = false;
        catEl.value = 'Medicine';

        closeModal('modal-add-stock');
        await loadInventory();
    } catch (e) {
        alert("Error: " + e);
    } finally {
        hideLoader();
    }
}

// --- POS & PRINTING ---
document.getElementById('posInput')
    .addEventListener('keydown', (e) => { if (e.key === 'Enter') triggerSearch(); });

async function triggerSearch() {
    const input = document.getElementById('posInput');
    const val = input.value.trim();
    if (!val) return;

    showLoader();
    try {
        const product = await window.api.searchProduct(val);
        if (product) {
            if (!product.total_stock || product.total_stock <= 0) alert("Out of Stock!");
            else {
                addToCart(product);
                input.value = '';
            }
        } else alert("Product not found");
    } catch (e) { console.error(e); }
    hideLoader();
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

    if (cart.length === 0) {
        document.getElementById('emptyCartMsg').style.display = 'block';
    } else {
        document.getElementById('emptyCartMsg').style.display = 'none';

        cart.forEach((item, idx) => {
            total += item.price * item.qty;
            tbody.innerHTML += `
                <tr>
                    <td>${item.name}</td>
                    <td>Rs.${item.price}</td>
                    <td>
                        <input type="number"
                            value="${item.qty}"
                            class="qty-input"
                            min="1"
                            style="width:60px"
                            onchange="updateQty(${idx}, this.value)">
                    </td>
                    <td>Rs.${(item.price * item.qty).toFixed(2)}</td>
                    <td><button class="btn-icon" onclick="remItem(${idx})">✕</button></td>
                </tr>`;
        });
    }

    document.getElementById('billSubtotal').innerText = `Rs.${total.toFixed(2)}`;
    document.getElementById('billTotal').innerText = `Rs.${total.toFixed(2)}`;
}

function updateQty(idx, val) {
    cart[idx].qty = parseInt(val) || 1;
    renderCart();
}

function remItem(idx) {
    cart.splice(idx, 1);
    renderCart();
}

function clearCart() {
    cart = [];
    renderCart();
}

async function checkout() {
    if (cart.length === 0) {
        alert("Cart is empty!");
        return;
    }

    const total = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const payMethod = document.getElementById('payMethod').value;
    const custName = document.getElementById('custName').value || 'Walk-in Customer';

    showLoader();
    try {
        const result = await window.api.processSale({
            items: cart,
            total,
            paymentMethod: payMethod
        });

        generateReceipt(
            result.saleId,
            result.date,
            custName,
            cart,
            total,
            payMethod
        );

        window.print();
        clearCart();
        document.getElementById('custName').value = '';
    } catch (err) {
        alert("Sale Failed: " + err);
    } finally {
        hideLoader();
    }
}

function generateReceipt(saleId, dateStr, customer, items, total, method) {
    const date = new Date(dateStr).toLocaleString();
    let rows = items.map(i => `
        <tr>
            <td class="item-name">${i.name}</td>
            <td class="center">${i.qty}</td>
            <td class="right">${(i.price * i.qty).toFixed(2)}</td>
        </tr>
    `).join('');

    const html = `
        <div class="receipt-container">
            <div class="center bold" style="font-size:16px;">PHARMACORE</div>
            <div class="center">123 Main Street, City</div>
            <div class="center">Tel: 011-2345678</div>
            <div class="dashed"></div>
            <div class="meta"><span>Inv: #${saleId}</span><span>${date.split(',')[0]}</span></div>
            <div class="meta"><span>Cust: ${customer}</span><span>Time: ${date.split(',')[1]}</span></div>
            <div class="dashed"></div>
            <table>
                <thead><tr><th style="width:50%">Item</th><th class="center">Qty</th><th class="right">Amt</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="dashed"></div>
            <div class="total-row"><span>TOTAL (${method})</span><span>Rs.${total.toFixed(2)}</span></div>
            <div class="dashed"></div>
            <div class="center" style="margin-top:10px;">Thank You!<br>No Returns.</div>
        </div>
    `;

    document.getElementById('print-area').innerHTML = html;
}

// --- PURCHASES ---
async function loadPurchases() {
    showLoader();
    try {
        const query = document.getElementById('purchaseSearch').value;
        const purchases = await window.api.getPurchases(query);

        document.querySelector('#purchaseTable tbody').innerHTML =
            purchases.map(p => `
            <tr>
                <td>${p.supplier}</td>
                <td>${p.invoice_no}</td>
                <td>Rs.${p.total_amount.toFixed(2)}</td>
                <td>${p.due_date}</td>
                <td>
                    <span class="badge ${p.is_paid ? 'badge-green' : 'badge-red'}">
                        ${p.is_paid ? 'Paid' : 'Pending'}
                    </span>
                </td>
                <td>
                    ${!p.is_paid
                    ? `<button class="btn-primary" style="padding:4px 8px; font-size:12px;" onclick="payPurchase(${p.id})">Mark Paid</button>`
                    : '✓'}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error(e);
    }
    hideLoader();
}

async function savePurchase() {
    const data = {
        supplier: document.getElementById('pSup').value,
        invoice: document.getElementById('pInv').value,
        total: parseFloat(document.getElementById('pAmt').value),
        due: document.getElementById('pDue').value,
        status: document.getElementById('pStatus').value
    };

    if (!data.supplier || !data.total || !data.due) {
        alert("Fill all fields");
        return;
    }

    showLoader();
    try {
        await window.api.addPurchase(data);
        alert("Saved");

        const fields = ['pSup', 'pInv', 'pAmt', 'pDue'];
        fields.forEach(pid => {
            const el = document.getElementById(pid);
            el.value = '';
            el.disabled = false;
            el.readOnly = false;
        });

        const statusEl = document.getElementById('pStatus');
        statusEl.disabled = false;
        statusEl.value = 'Pending';

        closeModal('modal-add-purchase');
        await loadPurchases();
    } catch (e) {
        alert("Error: " + e);
    } finally {
        hideLoader();
    }
}

async function payPurchase(id) {
    if (confirm('Mark this invoice as PAID?')) {
        showLoader();
        try {
            await window.api.payPurchase(id);
            await loadPurchases();
        } catch (e) {
            alert(e);
        }
        hideLoader();
    }
}

// --- SALES HISTORY ---
async function loadSalesHistory() {
    showLoader();
    try {
        const sales = await window.api.getSalesHistory();

        document.querySelector('#salesTable tbody').innerHTML =
            sales.map(s => {
                const items = JSON.parse(s.details)
                    .map(i => `${i.name} (x${i.qty})`)
                    .join(', ');

                return `
                <tr>
                    <td>#${s.id}</td>
                    <td>${new Date(s.sale_date).toLocaleString()}</td>
                    <td>${s.payment_method}</td>
                    <td>Rs.${s.total_amount.toFixed(2)}</td>
                    <td style="font-size:12px; color:#555;">${items}</td>
                </tr>`;
            }).join('');
    } catch (e) {
        console.error(e);
    }
    hideLoader();
}
loadDashboard();
