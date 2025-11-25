async function loadDashboard() {
    const response = await fetch('/api/alerts');
    const data = await response.json();

    const tableBody = document.querySelector('#alert-table tbody');
    tableBody.innerHTML = '';

    data.alerts.forEach(item => {
        const tr = document.createElement('tr');

        // Determine Logic: Expiring or Low Stock
        const expiryDate = new Date(item.expiry_date);
        const today = new Date();
        const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

        let status = '';
        let className = '';

        if (item.qty < 10) {
            status = `Low Stock (${item.qty})`;
            className = 'row-warning';
        } else if (diffDays < 30) {
            status = 'Expiring Soon (<1 Month)';
            className = 'row-danger'; // Red
        } else if (diffDays < 90) {
            status = 'Expiring (<3 Months)';
            className = 'row-warning'; // Orange
        }

        tr.className = className;
        tr.innerHTML = `<td>${item.name}</td><td>${status}</td><td><button>Check</button></td>`;
        tableBody.appendChild(tr);
    });

    // Render Chart
    const ctx = document.getElementById('salesChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{ label: 'Monthly Sales', data: [12000, 19000, 3000, 5000], backgroundColor: '#4F46E5' }]
        }
    });
}

loadDashboard();