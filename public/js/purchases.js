let allPurchases = [];
let currentFilterStatus = 'all';

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
        // "Mark Paid" button with non-blocking confirm logic
        const actionBtn = inv.status === 'Pending'
            ? `<button id="btn-pay-${inv.id}" onclick="markAsPaid(${inv.id})" style="background:#3b82f6; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Mark Paid</button>`
            : '<span style="color:#10b981; font-weight:bold;">✔ Paid</span>';

        const badgeColor = inv.status === 'Paid' ? 'background:#dcfce7; color:#166534;' : 'background:#fee2e2; color:#991b1b;';
        
        // Format Date dd/mm/yyyy
        // Ensure we treat the date string as local time to prevent timezone shifts
        const dateObj = new Date(inv.due_date);
        const dateStr = !isNaN(dateObj) ? dateObj.toLocaleDateString('en-GB') : inv.due_date;

        tbody.innerHTML += `
            <tr>
                <td style="font-family:monospace;">${dateStr}</td>
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

// 3. Add New Invoice (NON-BLOCKING)
async function addInvoice() {
    const supEl = document.getElementById('pur-supplier');
    const comEl = document.getElementById('pur-company');
    const invEl = document.getElementById('pur-invoice');
    const amtEl = document.getElementById('pur-amount');
    const dateEl = document.getElementById('pur-date');
    const statEl = document.getElementById('pur-status');
    const saveBtn = document.querySelector('#purchases .form-grid button.btn-primary');

    if (!invEl || !amtEl) return;

    const payload = {
        supplier_name: supEl.value,
        company_name: comEl.value,
        invoice_number: invEl.value,
        amount: parseFloat(amtEl.value || 0),
        due_date: dateEl.value,
        status: statEl.value
    };

    const originalText = "Add Record";
    const originalColor = "";

    const resetButton = () => {
        setTimeout(() => {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerText = originalText;
                saveBtn.style.backgroundColor = originalColor;
            }
        }, 1500);
    };

    if (!payload.invoice_number || payload.amount <= 0) {
        if (saveBtn) {
            saveBtn.innerText = "⚠ Invalid Data";
            saveBtn.style.backgroundColor = "#ef4444";
            resetButton();
        }
        return;
    }

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerText = "Saving...";
        }

        const res = await fetch('/api/purchases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            if (saveBtn) {
                saveBtn.innerText = "✔ Saved!";
                saveBtn.style.backgroundColor = "#059669";
            }

            setTimeout(() => {
                // CLEAR ALL FIELDS
                invEl.value = '';
                amtEl.value = '';
                supEl.value = '';
                comEl.value = '';
                dateEl.value = '';
                statEl.value = 'Pending'; // Reset to default

                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerText = originalText;
                    saveBtn.style.backgroundColor = originalColor;
                }
                
                // Focus back to first field for rapid entry
                if(supEl) supEl.focus();

                loadPurchases();
            }, 800);
        } else {
            if (saveBtn) {
                saveBtn.innerText = "⚠ Server Error";
                saveBtn.style.backgroundColor = "#ef4444";
                resetButton();
            }
        }
    } catch (e) {
        if (saveBtn) {
            saveBtn.innerText = "⚠ Network Error";
            saveBtn.style.backgroundColor = "#ef4444";
            resetButton();
        }
    }
}

// 4. Mark Invoice as Paid (Double Click Confirmation)
async function markAsPaid(id) {
    const btn = document.getElementById(`btn-pay-${id}`);

    // First click: Ask for confirmation on the button itself
    if (btn.innerText !== "Confirm?") {
        btn.innerText = "Confirm?";
        btn.style.backgroundColor = "#f59e0b"; // Orange
        // Reset if not clicked again in 3 seconds
        setTimeout(() => {
            if (btn && btn.innerText === "Confirm?") {
                btn.innerText = "Mark Paid";
                btn.style.backgroundColor = "#3b82f6";
            }
        }, 3000);
        return;
    }

    // Second click: Execute
    try {
        btn.innerText = "Updating...";
        await fetch(`/api/purchases/${id}/pay`, { method: 'PUT' });
        loadPurchases();
    } catch (e) {
        console.error(e);
        btn.innerText = "Error";
        btn.style.backgroundColor = "#ef4444";
    }
}

// 5. Filter & Sort Logic
function filterStatus(status) {
    currentFilterStatus = status;
    const btns = document.querySelectorAll('.filter-btns button');
    btns.forEach(b => {
        b.style.background = '#f1f5f9';
        b.style.color = '#333';
        if (b.innerText === status || (status === 'all' && b.innerText === 'All')) {
            b.style.background = '#0d9488';
            b.style.color = '#fff';
        }
    });
    applyPurchasesFilter();
}

function filterPurchases() {
    applyPurchasesFilter();
}

function applyPurchasesFilter() {
    const searchInput = document.getElementById('pur-search');
    const txt = searchInput ? searchInput.value.toLowerCase() : '';

    let filtered = allPurchases.filter(p => {
        const invNum = (p.invoice_number || '').toLowerCase();
        const comp = (p.company_name || '').toLowerCase();
        const matchesText = invNum.includes(txt) || comp.includes(txt);
        const matchesStatus = (currentFilterStatus === 'all') || (p.status === currentFilterStatus);
        return matchesText && matchesStatus;
    });

    filtered.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    renderPurchases(filtered);
}

// Initialize
loadPurchases();