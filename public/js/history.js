let allSales = [];
let activeReturnSale = null;

async function loadHistory() {
    const list = document.getElementById('history-list');
    if (list) list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Loading history...</td></tr>';

    try {
        const res = await fetch('/api/sales');
        const data = await res.json();
        allSales = data.data || [];
        renderHistory(allSales);
    } catch (e) {
        console.error("History Load Error:", e);
    }
}

function renderHistory(sales) {
    const list = document.getElementById('history-list');
    if (!list) return;

    if (!sales || sales.length === 0) {
        list.innerHTML = '<tr><td colspan="6" style="text-align:center;">No records found.</td></tr>';
        return;
    }

    list.innerHTML = sales.map(sale => `
        <tr>
            <td>${sale.date}</td>
            <td style="font-weight:bold;">#${sale.id}</td>
            <td style="font-size:12px; max-width: 300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${(sale.items_list || '').replace(/"/g, '&quot;')}">
                ${sale.items_list || 'No items'}
            </td>
            <td>${sale.payment_method}</td>
            <td style="font-weight:bold;">LKR ${(parseFloat(sale.total_amount) || 0).toFixed(2)}</td>
            <td>
                <button class="btn-primary" style="padding: 5px 10px; font-size: 11px;" onclick="reprintSale(${sale.id})">Print</button>
                <button class="btn-primary" style="padding: 5px 10px; font-size: 11px; background:#ef4444;" onclick="openReturnModal(${sale.id})">Return</button>
            </td>
        </tr>
    `).join('');
}

async function openReturnModal(saleId) {
    try {
        const res = await fetch(`/api/sales/${saleId}`);
        activeReturnSale = await res.json();

        document.getElementById('ret-sale-id-display').innerText = saleId;
        const container = document.getElementById('return-items-container');

        container.innerHTML = activeReturnSale.items.map(item => {
            const available = item.qty - (item.returned_qty || 0);
            return `
                <div style="display:grid; grid-template-columns: 2fr 1fr 1.5fr; gap:15px; align-items:center; padding:12px; border-bottom:1px solid #f0f0f0;">
                    <div>
                        <b style="color:var(--text-main);">${item.product_name}</b><br>
                        <small style="color:#666;">Sold: ${item.qty} | Available: ${available}</small>
                    </div>
                    <div>
                        <input type="number" class="ret-qty-input" data-itemid="${item.id}" data-barcode="${item.barcode}" max="${available}" min="0" value="0" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px;">
                    </div>
                    <div>
                        <input type="text" class="ret-reason-input" placeholder="Return reason..." style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px; font-size:12px;">
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('return-modal').style.display = 'flex';
    } catch (e) {
        alert("Failed to load sale details for return.");
    }
}

async function submitReturn() {
    const qtyInputs = document.querySelectorAll('.ret-qty-input');
    const reasonInputs = document.querySelectorAll('.ret-reason-input');
    const itemsToReturn = [];

    qtyInputs.forEach((input, index) => {
        const qty = parseInt(input.value);
        if (qty > 0) {
            itemsToReturn.push({
                itemId: input.dataset.itemid,
                barcode: input.dataset.barcode,
                returnQty: qty,
                reason: reasonInputs[index].value || "Item Returned"
            });
        }
    });

    if (itemsToReturn.length === 0) return alert("Please specify quantities to return.");

    try {
        const res = await fetch('/api/sales/return', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ saleId: activeReturnSale.id, items: itemsToReturn })
        });

        if (res.ok) {
            alert("Return processed successfully. Stock updated.");
            closeModals();
            loadHistory(); // Refresh history
            if (typeof loadDashboard === 'function') loadDashboard();
        } else {
            const err = await res.json();
            alert("Error: " + err.error);
        }
    } catch (e) {
        alert("Network error processing return.");
    }
}

function filterHistory() {
    const searchId = document.getElementById('history-search-id').value.toLowerCase();
    const filtered = allSales.filter(sale => sale.id.toString().includes(searchId));
    renderHistory(filtered);
}

function closeModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
}

async function reprintSale(saleId) {
    try {
        const res = await fetch(`/api/sales/${saleId}`);
        const sale = await res.json();
        document.getElementById('rec-bill-no').innerText = sale.id;
        document.getElementById('rec-date').innerText = sale.date;
        const recItemsBody = document.getElementById('rec-items');
        recItemsBody.innerHTML = sale.items.map(item => `
            <tr>
                <td>${item.product_name}</td>
                <td>${parseFloat(item.price).toFixed(2)}</td>
                <td style="text-align:center;">${item.qty}</td>
                <td style="text-align:right;">${(item.price * item.qty).toFixed(2)}</td>
            </tr>
        `).join('');
        document.getElementById('rec-total').innerText = `LKR ${parseFloat(sale.total_amount).toFixed(2)}`;
        window.print();
    } catch (err) { alert("Reprint failed."); }
}

document.addEventListener('DOMContentLoaded', loadHistory);