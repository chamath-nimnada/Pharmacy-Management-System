document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view');

    // Initial Load
    loadDashboard();

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // 1. Visual updates
            links.forEach(l => l.classList.remove('active'));
            views.forEach(v => {
                v.classList.remove('active');
                v.classList.add('hidden'); // Ensure others are hidden
            });

            link.classList.add('active');
            const target = link.getAttribute('data-target');
            const targetView = document.getElementById(target);

            if (targetView) {
                targetView.classList.add('active');
                targetView.classList.remove('hidden'); // REMOVE HIDDEN TO SHOW THE TAB
            }

            // 2. AUTO REFRESH DATA Logic
            switch (target) {
                case 'dashboard':
                    if (typeof loadDashboard === 'function') loadDashboard();
                    break;
                case 'inventory':
                    if (typeof loadInventory === 'function') loadInventory();
                    break;
                case 'purchases':
                    if (typeof loadPurchases === 'function') loadPurchases();
                    break;
                case 'history':
                    if (typeof loadHistory === 'function') loadHistory();
                    break;
                case 'billing':
                    document.getElementById('barcode-input').focus();
                    if (typeof fetchProductsForBilling === 'function') {
                        fetchProductsForBilling();
                    }
                    break;
            }
        });
    });
});