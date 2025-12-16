let salesChartInstance = null; 

async function loadDashboard() {
    try {
        const lowStockPref = localStorage.getItem('pref_lowStock') || 10;
        const expiryPref = localStorage.getItem('pref_expiryDays') || 90;
        const pendingPref = localStorage.getItem('pref_pendingDays') || 30;

        const pendingLabel = document.getElementById('pending-days-label');
        if(pendingLabel) pendingLabel.innerText = `(Next ${pendingPref} Days)`;

        const res = await fetch(`/api/dashboard-stats?minStock=${lowStockPref}&minExpiryDays=${expiryPref}&pendingDays=${pendingPref}`);
        const data = await res.json();

        document.getElementById('today-sales').innerText = `LKR ${(data.todaySales || 0).toFixed(2)}`;
        document.getElementById('monthly-sales').innerText = `LKR ${(data.monthlySales || 0).toFixed(2)}`;
        document.getElementById('due-current').innerText = `LKR ${(data.pendingPayments || 0).toFixed(2)}`;
        document.getElementById('total-products').innerText = `${data.totalProducts || 0}`;

        const monthName = new Date().toLocaleString('default', { month: 'long' });
        const monthLabel = document.getElementById('monthly-sales-label');
        if(monthLabel) monthLabel.innerText = `${monthName} Revenue`;

        const stockBody = document.querySelector('#stock-table tbody');
        const expiryBody = document.querySelector('#expiry-table tbody');

        stockBody.innerHTML = '';
        expiryBody.innerHTML = '';

        data.alerts.forEach(item => {
            const expiryDate = new Date(item.expiry_date);
            const today = new Date();
            const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            
            // USE TRADE NAME (server now maps this to item.name in response, but let's be safe)
            const displayName = item.trade_name || item.name;

            if (item.qty < parseInt(lowStockPref)) {
                stockBody.innerHTML += `
                    <tr>
                        <td>${displayName}</td>
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

            if (diffDays < parseInt(expiryPref)) {
                expiryBody.innerHTML += `
                    <tr>
                        <td>${displayName}</td>
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

        if (stockBody.innerHTML === '') stockBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999;">No Low Stock Items</td></tr>';
        if (expiryBody.innerHTML === '') expiryBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999;">No Expiring Items</td></tr>';

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