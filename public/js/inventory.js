let inventoryData = [];

// 1. Load Inventory from Server
async function loadInventory() {
    try {
        const res = await fetch('/api/products');
        const data = await res.json();

        if (data.data) {
            inventoryData = data.data;
            // Apply filter immediately after loading
            filterInventory();
        } else {
            console.error("No data received from API");
        }
    } catch (error) {
        console.error("Error loading inventory:", error);
        const tbody = document.getElementById('inventory-list');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6">Error connecting to server.</td></tr>';
    }
}

// 2. Render Table Rows (GROUPED BY BARCODE)
function renderInventory(products) {
    const tbody = document.getElementById('inventory-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #666;">No products found matching filters.</td></tr>';
        return;
    }

    // Group items by barcode to show Total Quantity
    const grouped = {};
    products.forEach(item => {
        if (!grouped[item.barcode]) {
            grouped[item.barcode] = {
                ...item,
                totalQty: 0,
                batches: []
            };
        }
        grouped[item.barcode].totalQty += item.qty;
        grouped[item.barcode].batches.push(item);
    });

    Object.values(grouped).forEach(group => {
        // Find nearest expiry date among batches
        group.batches.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
        const nearestExpiry = group.batches[0].expiry_date;
        const batchCount = group.batches.length;

        // Check for Low Stock (Red highlight if total qty < 5)
        let rowStyle = '';
        if (group.totalQty < 5) rowStyle = 'background: #fff0f0; color: #d63031;';

        tbody.innerHTML += `
            <tr style="${rowStyle}">
                <td style="font-family:monospace; font-weight:bold;">${group.barcode}</td>
                <td>
                    ${group.name} 
                    ${batchCount > 1 ? `<span style="font-size:10px; color:blue; font-weight:bold;">(${batchCount} Batches)</span>` : ''}
                </td>
                <td><span class="badge" style="background:#eef2f6; color:#333; padding:4px 8px; border-radius:4px;">${group.category}</span></td>
                <td>LKR ${parseFloat(group.price).toFixed(2)}</td>
                <td style="font-weight:bold;">${group.totalQty}</td>
                <td>${nearestExpiry}</td>
            </tr>
        `;
    });
}

// 3. Add New Product (NON-BLOCKING UPDATE)
async function addProduct() {
    const barcodeEl = document.getElementById('inv-barcode');
    const nameEl = document.getElementById('inv-name');
    const priceEl = document.getElementById('inv-price');
    const qtyEl = document.getElementById('inv-qty');
    const catEl = document.getElementById('inv-category');
    const expEl = document.getElementById('inv-expiry');
    const saveBtn = document.querySelector('#add-product-form button.btn-success');

    if (!barcodeEl || !nameEl) return;

    const payload = {
        barcode: barcodeEl.value.trim(),
        name: nameEl.value.trim(),
        price: parseFloat(priceEl.value || 0),
        qty: parseInt(qtyEl.value || 0),
        category: catEl.value,
        expiry_date: expEl.value
    };

    // Helper to revert button text
    const resetButton = (originalText, originalColor) => {
        setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.innerText = originalText;
            saveBtn.style.backgroundColor = originalColor;
        }, 1500);
    };

    const originalText = "Save Item";
    const originalColor = ""; // Default from CSS

    // Validation Feedback
    if (!payload.barcode || !payload.name) {
        saveBtn.innerText = "⚠ Missing Info";
        saveBtn.style.backgroundColor = "#ef4444"; // Red
        resetButton(originalText, originalColor);
        return;
    }

    try {
        saveBtn.disabled = true;
        saveBtn.innerText = "Saving...";

        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (res.ok) {
            // SUCCESS
            saveBtn.innerText = "✔ Saved!";
            saveBtn.style.backgroundColor = "#059669"; // Green

            setTimeout(() => {
                document.getElementById('add-product-form').style.display = 'none';
                barcodeEl.value = '';
                nameEl.value = '';
                priceEl.value = '';
                qtyEl.value = '';

                // Reset Button
                saveBtn.disabled = false;
                saveBtn.innerText = originalText;
                saveBtn.style.backgroundColor = originalColor;

                loadInventory(); // Auto refresh
            }, 800);
        } else {
            // Server Error Feedback
            console.error(result.error);
            saveBtn.innerText = "⚠ Error Saving";
            saveBtn.style.backgroundColor = "#ef4444";
            resetButton(originalText, originalColor);
        }
    } catch (e) {
        console.error(e);
        saveBtn.innerText = "⚠ Network Error";
        saveBtn.style.backgroundColor = "#ef4444";
        resetButton(originalText, originalColor);
    }
}

// 4. FILTER LOGIC (Category + Search)
function filterInventory() {
    const searchEl = document.getElementById('inv-search');
    const catEl = document.getElementById('inv-filter-cat');

    const searchText = searchEl ? searchEl.value.toLowerCase() : '';
    const selectedCategory = catEl ? catEl.value : 'all';

    const filtered = inventoryData.filter(item => {
        const itemName = (item.name || '').toLowerCase();
        const barcode = (item.barcode || '').toString().toLowerCase();
        const matchesSearch = itemName.includes(searchText) || barcode.includes(searchText);
        const matchesCategory = (selectedCategory === 'all') || (item.category === selectedCategory);

        return matchesSearch && matchesCategory;
    });

    renderInventory(filtered);
}

// Initialize on page load
loadInventory();