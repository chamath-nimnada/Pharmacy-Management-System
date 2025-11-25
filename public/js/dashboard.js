let salesChartInstance = null; // Store chart to destroy/update later

async function loadDashboard() {
    try {
        const res = await fetch('/api/dashboard-stats');
        const data = await res.json();

        // 1. Populate Cards (with null checks)
        document.getElementById('today-sales').innerText = `LKR ${(data.todaySales || 0).toFixed(2)}`;
        document.getElementById('monthly-sales').innerText = `LKR ${(data.monthlySales || 0).toFixed(2)}`;
        document.getElementById('due-current').innerText = `LKR ${(data.pendingPayments || 0).toFixed(2)}`;
        document.getElementById('total-products').innerText = `${data.totalProducts || 0}`;

        // 2. Populate Alerts Table
        const alertTable = document.querySelector('#alert-table tbody');
        alertTable.innerHTML = '';
        data.alerts.forEach(item => {
            // Determine logic
            const expiryDate = new Date(item.expiry_date);
            const today = new Date();
            const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

            let issue = '';
            let style = '';

            if (item.qty < 10) {
                issue = `Low Stock (${item.qty})`;
                style = 'color: var(--warning); font-weight:bold;';
            } else if (diffDays < 90) {
                issue = `Expiring (${diffDays} days)`;
                style = 'color: var(--danger); font-weight:bold;';
            }

            // REPLACED BLOCKING ALERT WITH INLINE ACTION
            alertTable.innerHTML += `
                <tr>
                    <td>${item.name}</td>
                    <td style="${style}">${issue}</td>
                    <td>
                        <button class="btn-sm" 
                            style="cursor:pointer; padding:4px 8px;"
                            onclick="this.innerText='Ordered'; this.disabled=true; this.style.color='#999';">
                            Resolve
                        </button>
                    </td>
                </tr>
            `;
        });

        // 3. Render Chart (Sales Trend)
        renderChart(data.chartData);

    } catch (err) {
        console.error("Dashboard Load Error:", err);
    }
}

function renderChart(salesData) {
    const ctx = document.getElementById('salesChart').getContext('2d');

    // Prepare Data (reverse to show oldest to newest left-to-right)
    const labels = salesData.map(s => new Date(s.date).toLocaleDateString()).reverse();
    const values = salesData.map(s => s.total_amount).reverse();

    // If chart exists, destroy it first to avoid overlap bugs
    if (salesChartInstance) {
        salesChartInstance.destroy();
    }

    salesChartInstance = new Chart(ctx, {
        type: 'line', // Changed to Line for "Trend"
        data: {
            labels: labels,
            datasets: [{
                label: 'Recent Sales (LKR)',
                data: values,
                borderColor: '#0d9488',
                backgroundColor: 'rgba(13, 148, 136, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}