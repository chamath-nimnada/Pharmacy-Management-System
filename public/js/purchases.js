let allPurchases = [];

// 1. Load Purchases
async function loadPurchases() {
    const res = await fetch('/api/purchases');
    const data = await res.json();
    allPurchases = data.data;
    renderPurchases(allPurchases);
}

// 2. Render Table
function renderPurchases(list) {
    const tbody = document.getElementById('purchase-list');
    tbody.innerHTML = '';

    list.forEach(inv => {
        // Calculate days left for Due Date logic
        const daysLeft = Math.ceil((new Date(inv.due_date) - new Date()) / (1000 * 60 * 60 * 24));
        const dateColor = (daysLeft < 0 && inv.status === 'Pending') ? 'color: red; font-weight:bold;' : '';

        const actionBtn = inv.status === 'Pending'
            ? `<button onclick="markAsPaid(${inv.id})" class="btn-sm">Mark Paid</button>`
            : '<span>✅</span>';

        tbody.innerHTML += `
            <tr>
                <td style="${dateColor}">${inv.due_date}</td>
                <td>${inv.invoice_number}</td>
                <td>${inv.company_name}</td>
                <td>${inv.supplier_name}</td>
                <td>LKR ${inv.amount.toFixed(2)}</td>
                <td><span class="badge ${inv.status}">${inv.status}</span></td>
                <td>${actionBtn}</td>
            </tr>
        `;
    });
}

// 3. Add Invoice
async function addInvoice() {
    const payload = {
        supplier_name: document.getElementById('pur-supplier').value,
        company_name: document.getElementById('pur-company').value,
        invoice_number: document.getElementById('pur-invoice').value,
        amount: parseFloat(document.getElementById('pur-amount').value),
        due_date: document.getElementById('pur-date').value,
        status: document.getElementById('pur-status').value
    };

    if (!payload.invoice_number || !payload.amount) return alert("Fill required fields!");

    await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    alert('Invoice Added');
    loadPurchases(); // Refresh list
    // Clear inputs...
}

// 4. Mark Paid
async function markAsPaid(id) {
    if (!confirm("Mark this invoice as PAID?")) return;
    await fetch(`/api/purchases/${id}/pay`, { method: 'PUT' });
    loadPurchases();
}

// 5. Search & Filter
function filterPurchases() {
    const term = document.getElementById('pur-search').value.toLowerCase();
    const filtered = allPurchases.filter(p =>
        p.invoice_number.toLowerCase().includes(term) ||
        p.company_name.toLowerCase().includes(term) ||
        p.supplier_name.toLowerCase().includes(term)
    );
    renderPurchases(filtered);
}

function filterStatus(status) {
    if (status === 'all') renderPurchases(allPurchases);
    else renderPurchases(allPurchases.filter(p => p.status === status));
}

// Init
loadPurchases();