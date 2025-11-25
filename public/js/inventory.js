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

// 2. Render Table Rows
function renderInventory(products) {
    const tbody = document.getElementById('inventory-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #666;">No products found matching filters.</td></tr>';
        return;
    }

    products.forEach(item => {
        // Safe value handling
        const barcode = item.barcode || '-';
        const name = item.name || 'Unknown Product';
        const category = item.category || 'Other';
        const price = parseFloat(item.price || 0).toFixed(2);
        const qty = parseInt(item.qty || 0);
        const expiry = item.expiry_date || '-';

        // Check for Low Stock (Red highlight if low)
        let rowStyle = '';
        if (qty < 5) rowStyle = 'background: #fff0f0; color: #d63031;';

        tbody.innerHTML += `
            <tr style="${rowStyle}">
                <td style="font-family:monospace; font-weight:bold;">${barcode}</td>
                <td>${name}</td>
                <td><span class="badge" style="background:#eef2f6; color:#333; padding:4px 8px; border-radius:4px;">${category}</span></td>
                <td>LKR ${price}</td>
                <td>${qty}</td>
                <td>${expiry}</td>
            </tr>
        `;
    });
}

// 3. Add New Product
async function addProduct() {
    const barcodeEl = document.getElementById('inv-barcode');
    const nameEl = document.getElementById('inv-name');
    const priceEl = document.getElementById('inv-price');
    const qtyEl = document.getElementById('inv-qty');
    const catEl = document.getElementById('inv-category');
    const expEl = document.getElementById('inv-expiry');

    if (!barcodeEl || !nameEl) return alert("Error: Form elements not found.");

    const payload = {
        barcode: barcodeEl.value.trim(),
        name: nameEl.value.trim(),
        price: parseFloat(priceEl.value || 0),
        qty: parseInt(qtyEl.value || 0),
        category: catEl.value,
        expiry_date: expEl.value
    };

    if (!payload.barcode || !payload.name) {
        return alert("Please enter a Barcode and Product Name.");
    }

    try {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (res.ok) {
            alert("Product Added Successfully!");
            // Hide form and clear inputs
            document.getElementById('add-product-form').style.display = 'none';
            barcodeEl.value = '';
            nameEl.value = '';
            priceEl.value = '';
            qtyEl.value = '';
            loadInventory(); // Refresh list
        } else {
            alert("Error: " + (result.error || "Could not save product."));
        }
    } catch (e) {
        console.error(e);
        alert("Network Error: Could not contact server.");
    }
}

// 4. FILTER LOGIC (Category + Search)
function filterInventory() {
    const searchEl = document.getElementById('inv-search');
    const catEl = document.getElementById('inv-filter-cat');

    const searchText = searchEl ? searchEl.value.toLowerCase() : '';
    const selectedCategory = catEl ? catEl.value : 'all';

    const filtered = inventoryData.filter(item => {
        // 1. Check Search Text (Name or Barcode)
        const name = (item.name || '').toLowerCase();
        const barcode = (item.barcode || '').toString().toLowerCase();
        const matchesSearch = name.includes(searchText) || barcode.includes(searchText);

        // 2. Check Category (Exact Match or 'all')
        // Ensure your HTML <option> values match these exactly (e.g. "Medicine", "Drug")
        const matchesCategory = (selectedCategory === 'all') || (item.category === selectedCategory);

        return matchesSearch && matchesCategory;
    });

    renderInventory(filtered);
}

// Initialize on page load
loadInventory();