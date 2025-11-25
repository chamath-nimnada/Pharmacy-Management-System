let allSales = [];

// 1. Fetch Sales Data
async function loadHistory() {
    const res = await fetch('/api/sales');
    const data = await res.json();
    allSales = data.data;
    renderHistory(allSales);

    // Reset date picker
    document.getElementById('history-date').value = '';
}

// 2. Render Table
function renderHistory(sales) {
    const tbody = document.getElementById('history-list');
    tbody.innerHTML = '';

    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No sales found.</td></tr>';
        return;
    }

    sales.forEach(sale => {
        // Parse date for prettier display
        const dateObj = new Date(sale.date);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();

        tbody.innerHTML += `
            <tr>
                <td>${dateStr}</td>
                <td style="font-family:monospace;">#${sale.id}</td>
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

// 3. Filter by Date
function filterHistory() {
    const inputDate = document.getElementById('history-date').value; // Returns YYYY-MM-DD

    if (!inputDate) return loadHistory(); // If cleared, show all

    const filtered = allSales.filter(sale => {
        // Extract YYYY-MM-DD from the sale's timestamp
        const saleDate = new Date(sale.date).toISOString().split('T')[0];
        return saleDate === inputDate;
    });

    renderHistory(filtered);
}

// Initialize
loadHistory();