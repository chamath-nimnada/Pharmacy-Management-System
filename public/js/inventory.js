let inventoryData = [];

// 1. Load Inventory from Server
async function loadInventory() {
    try {
        const res = await fetch('/api/products');
        const data = await res.json();
        inventoryData = data.data; // Store globally for filtering
        renderInventory(inventoryData);
    } catch (error) {
        console.error("Error loading inventory:", error);
    }
}

// 2. Render Table Rows
function renderInventory(products) {
    const tbody = document.getElementById('inventory-list');
    tbody.innerHTML = '';

    products.forEach(item => {
        // Highlight expiring items logic
        const daysLeft = Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
        let statusStyle = '';
        if (item.qty < 5) statusStyle = 'background: #fff1f2; color: #e11d48;'; // Low stock Red

        tbody.innerHTML += `
            <tr style="${statusStyle}">
                <td style="font-family:monospace; font-weight:bold;">${item.barcode}</td>
                <td>${item.name}</td>
                <td><span class="badge" style="background:#f1f5f9; color:#475569;">${item.category}</span></td>
                <td>LKR ${item.price.toFixed(2)}</td>
                <td>${item.qty}</td>
                <td>${item.expiry_date}</td>
            </tr>
        `;
    });
}

// 3. Add New Product
async function addProduct() {
    const payload = {
        barcode: document.getElementById('inv-barcode').value,
        name: document.getElementById('inv-name').value,
        price: parseFloat(document.getElementById('inv-price').value),
        qty: parseInt(document.getElementById('inv-qty').value),
        category: document.getElementById('inv-category').value,
        expiry_date: document.getElementById('inv-expiry').value
    };

    // Validation
    if (!payload.barcode || !payload.name || !payload.price) {
        return alert("Please fill in all required fields.");
    }

    const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        alert("Product Added Successfully!");
        document.getElementById('add-product-form').style.display = 'none'; // Close form
        clearInputs();
        loadInventory(); // Refresh table
    } else {
        alert("Error: Barcode might already exist.");
    }
}

function clearInputs() {
    document.querySelectorAll('#add-product-form input').forEach(input => input.value = '');
}

// 4. Filter Logic (Search + Category)
function filterInventory() {
    const searchTerm = document.getElementById('inv-search').value.toLowerCase();

    // We filter the global 'inventoryData' array
    const filtered = inventoryData.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm) ||
            item.barcode.includes(searchTerm);
        return matchesSearch;
    });

    renderInventory(filtered);
}

// Initialize
loadInventory();