let salesChartInstance = null; // Store chart to destroy/update later

async function loadDashboard() {
    try {
        const res = await fetch('/api/dashboard-stats');
        const data = await res.json();

        // 1. Populate Cards
        document.getElementById('today-sales').innerText = `LKR ${(data.todaySales || 0).toFixed(2)}`;
        document.getElementById('monthly-sales').innerText = `LKR ${(data.monthlySales || 0).toFixed(2)}`;
        document.getElementById('due-current').innerText = `LKR ${(data.pendingPayments || 0).toFixed(2)}`;
        document.getElementById('total-products').innerText = `${data.totalProducts || 0}`;

        // 2. Populate Separate Alerts Tables
        const stockBody = document.querySelector('#stock-table tbody');
        const expiryBody = document.querySelector('#expiry-table tbody');

        stockBody.innerHTML = '';
        expiryBody.innerHTML = '';

        data.alerts.forEach(item => {
            const expiryDate = new Date(item.expiry_date);
            const today = new Date();
            const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

            // CHECK 1: Low Stock (< 10)
            if (item.qty < 10) {
                stockBody.innerHTML += `
                    <tr>
                        <td>${item.name}</td>
                        <td style="color: var(--warning); font-weight:bold;">${item.qty} Left</td>
                        <td>
                            <button class="btn-sm" 
                                style="cursor:pointer; padding:4px 8px;"
                                onclick="this.innerText='Ordered'; this.disabled=true; this.style.color='#999';">
                                Restock
                            </button>
                        </td>
                    </tr>
                `;
            }

            // CHECK 2: Expiring (< 90 days)
            if (diffDays < 90) {
                expiryBody.innerHTML += `
                    <tr>
                        <td>${item.name}</td>
                        <td style="color: var(--danger); font-weight:bold;">${diffDays} Days</td>
                        <td>
                            <button class="btn-sm" 
                                style="cursor:pointer; padding:4px 8px;"
                                onclick="this.innerText='Checked'; this.disabled=true; this.style.color='#999';">
                                Check
                            </button>
                        </td>
                    </tr>
                `;
            }
        });

        // Handle Empty States
        if (stockBody.innerHTML === '') stockBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999;">No Low Stock Items</td></tr>';
        if (expiryBody.innerHTML === '') expiryBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999;">No Expiring Items</td></tr>';

        // 3. Render Chart (Sales Trend)
        renderChart(data.chartData);

    } catch (err) {
        console.error("Dashboard Load Error:", err);
    }
}

function renderChart(salesData) {
    const ctx = document.getElementById('salesChart').getContext('2d');

    const labels = salesData.map(s => new Date(s.date).toLocaleDateString()).reverse();
    const values = salesData.map(s => s.total_amount).reverse();

    if (salesChartInstance) {
        salesChartInstance.destroy();
    }

    salesChartInstance = new Chart(ctx, {
        type: 'line',
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