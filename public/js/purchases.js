let allPurchases = [];
let currentFilterStatus = 'all'; // Default to showing all

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

// 2. Render Logic
function renderPurchases(list) {
    const tbody = document.getElementById('purchase-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">No invoices found.</td></tr>';
        return;
    }

    list.forEach(inv => {
        // Button Logic: Show "Mark Paid" only if pending
        const actionBtn = inv.status === 'Pending'
            ? `<button onclick="markAsPaid(${inv.id})" style="background:#3b82f6; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Mark Paid</button>`
            : '<span style="color:#10b981; font-weight:bold;">✔ Paid</span>';

        // Badge Logic
        const badgeColor = inv.status === 'Paid' ? 'background:#dcfce7; color:#166534;' : 'background:#fee2e2; color:#991b1b;';

        tbody.innerHTML += `
            <tr>
                <td style="font-family:monospace;">${inv.due_date || '-'}</td>
                <td>${inv.invoice_number || '-'}</td>
                <td>${inv.company_name || '-'}</td>
                <td>${inv.supplier_name || '-'}</td>
                <td>LKR ${(inv.amount || 0).toFixed(2)}</td>
                <td><span class="badge" style="${badgeColor} padding:4px 8px; border-radius:10px; font-size:12px;">${inv.status}</span></td>
                <td>${actionBtn}</td>
            </tr>
        `;
    });
}

// 3. Add New Invoice
async function addInvoice() {
    const supEl = document.getElementById('pur-supplier');
    const comEl = document.getElementById('pur-company');
    const invEl = document.getElementById('pur-invoice');
    const amtEl = document.getElementById('pur-amount');
    const dateEl = document.getElementById('pur-date');
    const statEl = document.getElementById('pur-status');

    if (!invEl || !amtEl) return;

    const payload = {
        supplier_name: supEl.value,
        company_name: comEl.value,
        invoice_number: invEl.value,
        amount: parseFloat(amtEl.value || 0),
        due_date: dateEl.value,
        status: statEl.value
    };

    if (!payload.invoice_number || payload.amount <= 0) {
        return alert("Please enter a valid Invoice Number and Amount.");
    }

    try {
        await fetch('/api/purchases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        alert("Invoice Added Successfully");

        // Clear main inputs
        invEl.value = '';
        amtEl.value = '';

        loadPurchases(); // Reload list
    } catch (e) {
        alert("Error saving invoice.");
    }
}

// 4. Mark Invoice as Paid
async function markAsPaid(id) {
    if (!confirm("Are you sure you want to mark this invoice as PAID?")) return;
    try {
        await fetch(`/api/purchases/${id}/pay`, { method: 'PUT' });
        loadPurchases();
    } catch (e) {
        alert("Error updating status.");
    }
}

// 5. Filter & Sort Logic
function filterStatus(status) {
    currentFilterStatus = status;

    // Visual: Update button colors
    const btns = document.querySelectorAll('.filter-btns button');
    btns.forEach(b => {
        // Reset style
        b.style.background = '#f1f5f9';
        b.style.color = '#333';

        // Highlight active button
        if (b.innerText === status || (status === 'all' && b.innerText === 'All')) {
            b.style.background = '#0d9488'; // Teal color
            b.style.color = '#fff';
        }
    });

    applyPurchasesFilter();
}

function filterPurchases() {
    // Called when typing in search bar
    applyPurchasesFilter();
}

function applyPurchasesFilter() {
    const searchInput = document.getElementById('pur-search');
    const txt = searchInput ? searchInput.value.toLowerCase() : '';

    // 1. FILTERING
    let filtered = allPurchases.filter(p => {
        const invNum = (p.invoice_number || '').toLowerCase();
        const comp = (p.company_name || '').toLowerCase();

        const matchesText = invNum.includes(txt) || comp.includes(txt);
        const matchesStatus = (currentFilterStatus === 'all') || (p.status === currentFilterStatus);

        return matchesText && matchesStatus;
    });

    // 2. SORTING (Nearest Date First)
    // We sort directly on the client side to ensure order persists after filtering
    filtered.sort((a, b) => {
        const dateA = new Date(a.due_date);
        const dateB = new Date(b.due_date);
        return dateA - dateB; // Ascending: Oldest/Nearest dates at top
    });

    renderPurchases(filtered);
}

// Initialize
loadPurchases();