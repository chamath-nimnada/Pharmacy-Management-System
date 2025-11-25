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
            views.forEach(v => v.classList.remove('active'));

            link.classList.add('active');
            const target = link.getAttribute('data-target');
            document.getElementById(target).classList.add('active');

            // 2. AUTO REFRESH DATA Logic
            // Based on which tab is clicked, reload that data
            switch (target) {
                case 'dashboard':
                    loadDashboard();
                    break;
                case 'inventory':
                    loadInventory(); // From inventory.js
                    break;
                case 'purchases':
                    loadPurchases(); // From purchases.js
                    break;
                case 'history':
                    loadHistory();   // From history.js
                    break;
                case 'billing':
                    // Just clear search, keep cart? Or clear? 
                    // Usually better to keep cart if they accidentally clicked away.
                    document.getElementById('barcode-input').focus();
                    break;
            }
        });
    });
});