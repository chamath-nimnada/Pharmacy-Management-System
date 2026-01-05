let allPurchases = [];
let currentFilterStatus = 'all';
let purchaseDebounceTimer = null; // Optimization variable

// Helper to calculate due date
function calculateDueDate(purchaseDate, days) {
    if (!purchaseDate || isNaN(days)) return purchaseDate;
    const date = new Date(purchaseDate);
    date.setDate(date.getDate() + parseInt(days));
    return date.toISOString().split('T')[0];
}

// 1. Load Purchases
async function loadPurchases() {
    try {
        const res = await fetch('/api/purchases');
        const data = await res.json();
        if (data.data) {
            allPurchases = data.data;
            applyPurchasesFilter();
        }
    } catch (e) {
        console.error("Error loading purchases:", e);
    }
}

// 2. Render Logic (OPTIMIZED: Pagination)
function renderPurchases(list) {
    const tbody = document.getElementById('purchase-list');
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No invoices found.</td></tr>';
        return;
    }

    // FIX: Limit rendering to top 50 to save CPU
    const DISPLAY_LIMIT = 50;
    const itemsToShow = list.slice(0, DISPLAY_LIMIT);

    let htmlBuffer = '';

    itemsToShow.forEach(inv => {
        const payBtn = inv.status === 'Pending'
            ? `<button id="btn-pay-${inv.id}" class="btn-primary" onclick="markAsPaid(${inv.id})" style="background:#3b82f6; padding:4px 8px; font-size:12px;">Pay</button>`
            : '';

        const actionButtons = `
            <div style="display:flex; gap:5px; align-items:center;">
                ${payBtn}
                <button class="btn-primary" style="padding:4px 8px; font-size:12px; background:#f59e0b; color:black;" 
                    onclick="editInvoice(${inv.id})">Edit</button>
                <button class="btn-danger" style="padding:4px 8px; font-size:12px;" 
                    onclick="deleteInvoice(${inv.id}, this)">Delete</button>
            </div>
        `;

        const badgeColor = inv.status === 'Paid' ? 'background:#dcfce7; color:#166534;' : 'background:#fee2e2; color:#991b1b;';
        const dateObj = new Date(inv.due_date);
        const dateStr = !isNaN(dateObj) ? dateObj.toLocaleDateString('en-GB') : inv.due_date;

        htmlBuffer += `
            <tr>
                <td style="font-family:monospace;">${dateStr}</td>
                <td style="font-weight:bold;">${inv.invoice_number || '-'}</td>
                <td>${inv.supplier_name || '-'}</td>
                <td>LKR ${(inv.amount || 0).toFixed(2)}</td>
                <td><span class="badge" style="${badgeColor} padding:4px 8px; border-radius:10px; font-size:12px;">${inv.status}</span></td>
                <td>${actionButtons}</td>
            </tr>
        `;
    });

    if (list.length > DISPLAY_LIMIT) {
        htmlBuffer += `
            <tr>
                <td colspan="6" style="text-align:center; padding:10px; color:#666; font-style:italic; background:#f8fafc;">
                    Showing ${DISPLAY_LIMIT} of ${list.length} invoices. Use search to find specific records.
                </td>
            </tr>
        `;
    }

    tbody.innerHTML = htmlBuffer;
}

// 3. Add New Invoice
async function addInvoice() {
    const supEl = document.getElementById('pur-supplier');
    const invEl = document.getElementById('pur-invoice');
    const amtEl = document.getElementById('pur-amount');
    const dateEl = document.getElementById('pur-date');
    const daysEl = document.getElementById('pur-due-days');
    const statEl = document.getElementById('pur-status');
    const saveBtn = document.querySelector('#purchases .form-grid button.btn-success');

    const purchase_date = dateEl.value;
    const due_days = parseInt(daysEl.value || 0);
    const calculated_due_date = calculateDueDate(purchase_date, due_days);

    const payload = {
        supplier_name: supEl.value,
        invoice_number: invEl.value,
        amount: parseFloat(amtEl.value || 0),
        purchase_date: purchase_date,
        due_days: due_days,
        due_date: calculated_due_date,
        status: statEl.value
    };

    if (!payload.invoice_number || payload.amount <= 0 || !purchase_date) {
        alert("Please fill Invoice #, Amount, and Purchase Date");
        return;
    }

    try {
        saveBtn.disabled = true;
        saveBtn.innerText = "Saving...";

        const res = await fetch('/api/purchases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            saveBtn.innerText = "✔ Saved!";
            setTimeout(() => {
                // Clear fields
                invEl.value = ''; amtEl.value = ''; supEl.value = '';
                dateEl.value = ''; daysEl.value = '';
                saveBtn.disabled = false;
                saveBtn.innerText = "Save Record";

                supEl.focus();
                loadPurchases();
            }, 800);
        }
    } catch (e) { console.error(e); }
}

// 4. Update and Delete Logic
function editInvoice(id) {
    const inv = allPurchases.find(p => p.id == id);
    if (!inv) return;

    document.getElementById('edit-pur-id').value = inv.id;
    document.getElementById('edit-pur-supplier').value = inv.supplier_name;
    document.getElementById('edit-pur-invoice').value = inv.invoice_number;
    document.getElementById('edit-pur-amount').value = inv.amount;
    document.getElementById('edit-pur-date').value = inv.purchase_date;
    document.getElementById('edit-pur-due-days').value = inv.due_days || 0;
    document.getElementById('edit-pur-status').value = inv.status;

    document.getElementById('edit-purchase-modal').style.display = 'flex';
}

async function saveInvoiceEdit() {
    const id = document.getElementById('edit-pur-id').value;
    const purchase_date = document.getElementById('edit-pur-date').value;
    const due_days = parseInt(document.getElementById('edit-pur-due-days').value || 0);

    const payload = {
        supplier_name: document.getElementById('edit-pur-supplier').value,
        invoice_number: document.getElementById('edit-pur-invoice').value,
        amount: parseFloat(document.getElementById('edit-pur-amount').value),
        purchase_date: purchase_date,
        due_days: due_days,
        due_date: calculateDueDate(purchase_date, due_days),
        status: document.getElementById('edit-pur-status').value
    };

    try {
        const res = await fetch(`/api/purchases/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            document.getElementById('edit-purchase-modal').style.display = 'none';
            loadPurchases();
        }
    } catch (e) { alert("Error updating invoice"); }
}

async function deleteInvoice(id, btn) {
    if (btn.innerText !== "Confirm?") {
        const originalText = btn.innerText;
        btn.innerText = "Confirm?";
        btn.style.backgroundColor = "#f59e0b";
        setTimeout(() => { if (btn) { btn.innerText = originalText; btn.style.backgroundColor = ""; } }, 3000);
        return;
    }

    try {
        await fetch(`/api/purchases/${id}`, { method: 'DELETE' });
        loadPurchases();
    } catch (e) { console.error(e); }
}

// 5. Filter & Search Logic (OPTIMIZED: Debounce)
function filterPurchases() {
    clearTimeout(purchaseDebounceTimer);
    purchaseDebounceTimer = setTimeout(() => {
        applyPurchasesFilter();
    }, 250); // 250ms delay
}

function filterStatus(status) {
    currentFilterStatus = status;

    const btns = document.querySelectorAll('.pur-filter-btn');
    btns.forEach(btn => {
        const btnText = btn.innerText.toLowerCase();
        const targetStatus = status.toLowerCase();

        if (btnText === targetStatus || (targetStatus === 'all' && btnText === 'all')) {
            btn.classList.add('active');
            btn.style.background = "var(--primary)";
            btn.style.color = "white";
        } else {
            btn.classList.remove('active');
            btn.style.background = "transparent";
            btn.style.color = "var(--text-main)";
        }
    });

    applyPurchasesFilter();
}

function applyPurchasesFilter() {
    const txt = (document.getElementById('pur-search')?.value || '').toLowerCase();

    let filtered = allPurchases.filter(p => {
        const invNum = (p.invoice_number || '').toLowerCase();
        const sup = (p.supplier_name || '').toLowerCase();
        const matchesText = invNum.includes(txt) || sup.includes(txt);
        const matchesStatus = (currentFilterStatus === 'all') || (p.status === currentFilterStatus);
        return matchesText && matchesStatus;
    });

    filtered.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    renderPurchases(filtered);
}

async function markAsPaid(id) {
    const btn = document.getElementById(`btn-pay-${id}`);
    if (btn.innerText !== "Confirm?") {
        btn.innerText = "Confirm?";
        btn.style.backgroundColor = "#f59e0b";
        setTimeout(() => { if (btn && btn.innerText === "Confirm?") { btn.innerText = "Pay"; btn.style.backgroundColor = "#3b82f6"; } }, 3000);
        return;
    }
    try {
        await fetch(`/api/purchases/${id}/pay`, { method: 'PUT' });
        loadPurchases();
    } catch (e) { console.error(e); }
}

loadPurchases();