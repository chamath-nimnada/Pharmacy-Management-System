let allSales = [];

// 1. Fetch Sales Data
async function loadHistory() {
    try {
        const res = await fetch('/api/sales');
        const data = await res.json();
        allSales = data.data;
        renderHistory(allSales);

        // Reset filters
        document.getElementById('history-date').value = '';
        document.getElementById('history-search-id').value = '';
    } catch (e) {
        console.error("Error loading history:", e);
    }
}

// 2. Render Table
function renderHistory(sales) {
    const tbody = document.getElementById('history-list');
    tbody.innerHTML = '';

    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No sales found.</td></tr>';
        return;
    }

    sales.forEach(sale => {
        // Parse date
        const dateObj = new Date(sale.date);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();

        // Products Display (Using the new aggregated column)
        const productsDisplay = sale.items_list ?
            `<span style="font-size:13px; color:#334155;">${sale.items_list}</span>` :
            '<span style="color:#94a3b8;">-</span>';

        tbody.innerHTML += `
            <tr>
                <td>${dateStr}</td>
                <td style="font-family:monospace; font-weight:bold;">#${sale.id}</td>
                <td>${productsDisplay}</td>
                <td>
                    <span class="badge" style="background: #eff6ff; color: #2563eb;">
                        ${sale.payment_method}
                    </span>
                </td>
                <td style="font-weight:bold;">LKR ${sale.total_amount.toFixed(2)}</td>
            </tr>
        `;
    });
}

// 3. Filter by Date & ID
function filterHistory() {
    const inputDate = document.getElementById('history-date').value; // Returns YYYY-MM-DD
    const searchId = document.getElementById('history-search-id').value.trim().toLowerCase();

    const filtered = allSales.filter(sale => {
        // Filter 1: Date (if selected)
        let dateMatch = true;
        if (inputDate) {
            const saleDate = new Date(sale.date).toISOString().split('T')[0];
            dateMatch = (saleDate === inputDate);
        }

        // Filter 2: Sale ID (if typed)
        let idMatch = true;
        if (searchId) {
            idMatch = sale.id.toString().includes(searchId);
        }

        return dateMatch && idMatch;
    });

    renderHistory(filtered);
}

// Initialize
loadHistory();