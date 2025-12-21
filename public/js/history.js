let allSales = [];

async function loadHistory() {
    try {
        const res = await fetch('/api/sales');
        const data = await res.json();
        allSales = data.data;
        renderHistory(allSales);
    } catch (e) { console.error(e); }
}

function renderHistory(sales) {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    sales.forEach(sale => {
        list.innerHTML += `
            <tr>
                <td>${sale.date}</td>
                <td style="font-weight:bold;">#${sale.id}</td>
                <td style="font-size:12px; max-width: 300px;">${sale.items_list || 'No items'}</td>
                <td>${sale.payment_method}</td>
                <td style="font-weight:bold;">LKR ${parseFloat(sale.total_amount).toFixed(2)}</td>
                <td>
                    <button class="btn-primary" style="padding: 5px 10px; font-size: 12px;" onclick="reprintSale(${sale.id})">
                        <span class="material-icons-round" style="font-size: 14px; vertical-align: middle;">print</span> Print
                    </button>
                </td>
            </tr>
        `;
    });
}

function filterHistory() {
    const searchId = document.getElementById('history-search-id').value.toLowerCase();
    const filterDate = document.getElementById('history-date').value;

    const filtered = allSales.filter(sale => {
        const matchesId = sale.id.toString().includes(searchId);
        const matchesDate = !filterDate || sale.date.includes(filterDate);
        return matchesId && matchesDate;
    });

    renderHistory(filtered);
}

// Function to reprint an old sale bill
async function reprintSale(saleId) {
    try {
        const res = await fetch(`/api/sales/${saleId}`);
        const sale = await res.json();

        if (sale.error) {
            alert("Error fetching sale details: " + sale.error);
            return;
        }

        // 1. Populate Receipt Metadata
        document.getElementById('rec-bill-no').innerText = sale.id;
        document.getElementById('rec-date').innerText = sale.date;

        // 2. Handle Patient Name
        const patientCont = document.getElementById('rec-patient-container');
        if (sale.patient_name) {
            patientCont.style.display = 'block';
            document.getElementById('rec-patient-name').innerText = sale.patient_name;
        } else {
            patientCont.style.display = 'none';
        }

        // 3. Populate Items
        const recItemsBody = document.getElementById('rec-items');
        recItemsBody.innerHTML = '';

        // Clear discount summary for reprints as percentages aren't stored
        document.getElementById('rec-discounts').innerText = "";

        sale.items.forEach(item => {
            const lineTotal = item.price * item.qty;
            recItemsBody.innerHTML += `
                <tr>
                    <td style="font-size:11px;">
                        <span style="font-weight:bold; font-size:12px;">${item.product_name}</span>
                    </td>
                    <td style="font-size:11px;">${parseFloat(item.price).toFixed(2)}</td>
                    <td style="font-size:11px; text-align:center;">${item.qty}</td>
                    <td style="text-align:right; font-size:11px;">${lineTotal.toFixed(2)}</td>
                </tr>
            `;
        });

        // 4. Set Total
        document.getElementById('rec-total').innerText = `LKR ${parseFloat(sale.total_amount).toFixed(2)}`;

        // 5. Trigger Print
        window.print();
    } catch (err) {
        console.error("Print Error:", err);
        alert("Failed to reprint bill.");
    }
}

// Initial load
document.addEventListener('DOMContentLoaded', loadHistory);