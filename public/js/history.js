let allSales = [];
let searchDebounceTimer = null;

async function loadHistory() {
    const list = document.getElementById('history-list');

    // 1. Show Loading State
    if (list) {
        list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#666; font-style:italic;">Loading sales history... Please wait.</td></tr>';
    }

    try {
        const res = await fetch('/api/sales');

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server Error (${res.status})`);
        }

        const data = await res.json();

        // Check if data.data exists (based on server.js response format)
        if (data && data.data) {
            allSales = data.data;
            renderHistory(allSales);
        } else {
            throw new Error("Invalid data format received from server");
        }
    } catch (e) {
        console.error("History Load Error:", e);
        if (list) {
            list.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#ef4444;">⚠ Failed to load history. <br> <small>${e.message}</small></td></tr>`;
        }
    }
}

function renderHistory(sales) {
    const list = document.getElementById('history-list');
    if (!list) return;

    if (!sales || sales.length === 0) {
        list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#666;">No sales records found.</td></tr>';
        return;
    }

    let htmlBuffer = '';

    sales.forEach(sale => {
        const amount = parseFloat(sale.total_amount) || 0;
        const items = sale.items_list || 'No items';

        htmlBuffer += `
            <tr>
                <td>${sale.date}</td>
                <td style="font-weight:bold;">#${sale.id}</td>
                <td style="font-size:12px; max-width: 300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${items.replace(/"/g, '&quot;')}">
                    ${items}
                </td>
                <td>${sale.payment_method}</td>
                <td style="font-weight:bold;">LKR ${amount.toFixed(2)}</td>
                <td>
                    <button class="btn-primary" style="padding: 5px 10px; font-size: 12px;" onclick="reprintSale(${sale.id})">
                        <span class="material-icons-round" style="font-size: 14px; vertical-align: middle;">print</span> Print
                    </button>
                </td>
            </tr>
        `;
    });

    list.innerHTML = htmlBuffer;
}

function filterHistory() {
    clearTimeout(searchDebounceTimer);

    searchDebounceTimer = setTimeout(() => {
        const searchId = (document.getElementById('history-search-id')?.value || '').toLowerCase();
        const filterDate = document.getElementById('history-date')?.value;
        const paymentMethod = document.getElementById('history-payment-method')?.value;

        const filtered = allSales.filter(sale => {
            const idStr = (sale.id || '').toString();
            const matchesId = idStr.includes(searchId);
            const matchesDate = !filterDate || (sale.date && sale.date.includes(filterDate));
            const matchesMethod = paymentMethod === 'all' || sale.payment_method === paymentMethod;
            return matchesId && matchesDate && matchesMethod;
        });

        renderHistory(filtered);
    }, 300);
}

async function reprintSale(saleId) {
    try {
        const res = await fetch(`/api/sales/${saleId}`);
        const sale = await res.json();

        if (sale.error) {
            alert("Error: " + sale.error);
            return;
        }

        document.getElementById('rec-bill-no').innerText = sale.id;
        document.getElementById('rec-date').innerText = sale.date;

        const patientCont = document.getElementById('rec-patient-container');
        if (sale.patient_name) {
            patientCont.style.display = 'block';
            document.getElementById('rec-patient-name').innerText = sale.patient_name;
        } else {
            patientCont.style.display = 'none';
        }

        const recItemsBody = document.getElementById('rec-items');
        recItemsBody.innerHTML = '';
        document.getElementById('rec-discounts').innerText = "";

        if (sale.items) {
            sale.items.forEach(item => {
                const lineTotal = (parseFloat(item.price) || 0) * (parseInt(item.qty) || 0);
                recItemsBody.innerHTML += `
                    <tr>
                        <td style="font-size:11px;"><span style="font-weight:bold; font-size:12px;">${item.product_name}</span></td>
                        <td style="font-size:11px;">${parseFloat(item.price).toFixed(2)}</td>
                        <td style="font-size:11px; text-align:center;">${item.qty}</td>
                        <td style="text-align:right; font-size:11px;">${lineTotal.toFixed(2)}</td>
                    </tr>
                `;
            });
        }

        document.getElementById('rec-total').innerText = `LKR ${parseFloat(sale.total_amount).toFixed(2)}`;
        window.print();
    } catch (err) {
        console.error("Print Error:", err);
        alert("Failed to reprint bill.");
    }
}

async function getSummaryReport() {
    const date = document.getElementById('summary-date').value;
    const cat = document.getElementById('summary-category').value;
    if (!date) return alert("Please select a date.");

    try {
        const res = await fetch(`/api/sales-summary?date=${date}&category=${cat}`);
        const data = await res.json();
        const summaryRes = document.getElementById('summary-result');
        if (summaryRes) {
            summaryRes.innerText = `Total: LKR ${parseFloat(data.total || 0).toFixed(2)}`;
        }
    } catch (e) {
        console.error(e);
        alert("Failed to fetch summary.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    const sumDate = document.getElementById('summary-date');
    if (sumDate) sumDate.valueAsDate = new Date();
});