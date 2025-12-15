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
        if (tbody) tbody.innerHTML = '<tr><td colspan="9">Error connecting to server.</td></tr>';
    }
}

// 2. Render Table Rows (GROUPED BY BARCODE)
function renderInventory(products) {
    const tbody = document.getElementById('inventory-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px; color: #666;">No products found matching filters.</td></tr>';
        return;
    }

    // Group items by product_code (better stability than barcode if barcode is missing)
    const grouped = {};
    products.forEach(item => {
        // Use product_code as key if available, else barcode
        const key = item.product_code || item.barcode;
        if (!grouped[key]) {
            grouped[key] = {
                ...item,
                totalQty: 0,
                batches: []
            };
        }
        grouped[key].totalQty += item.qty;
        grouped[key].batches.push(item);
    });

    Object.values(grouped).forEach(group => {
        // Find nearest expiry date among batches
        group.batches.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
        const nearestExpiry = group.batches[0].expiry_date;
        const batchCount = group.batches.length;

        // Check for Low Stock (Red highlight if total qty < 5)
        let rowStyle = '';
        if (group.totalQty < 5) rowStyle = 'background: #fff0f0; color: #d63031;';

        // Format Date for Table (dd/mm/yyyy)
        const dateObj = new Date(nearestExpiry);
        const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('en-GB') : nearestExpiry;

        // Batches Button (Only if multiple batches)
        let batchesBtn = '';
        if (batchCount > 1) {
             batchesBtn = `<button class="btn-primary" style="padding:4px 8px; font-size:12px; background:#64748b; color:white; margin-right:5px;" onclick="viewBatches('${group.product_code}')">Batches</button>`;
        }

        tbody.innerHTML += `
            <tr style="${rowStyle}">
                <td style="font-family:monospace; color:#64748b;">${group.product_code || '-'}</td>
                <td style="font-family:monospace; font-weight:bold;">${group.barcode || '<span style="color:#ccc">N/A</span>'}</td>
                <td>
                    ${group.name} 
                    ${batchCount > 1 ? `<span style="font-size:10px; color:blue; font-weight:bold;">(${batchCount} Batches)</span>` : ''}
                </td>
                <td style="color:#475569;">${group.company_name || '-'}</td>
                <td><span class="badge" style="background:#eef2f6; color:#333; padding:4px 8px; border-radius:4px;">${group.category}</span></td>
                <td>LKR ${parseFloat(group.price).toFixed(2)}</td>
                <td style="font-weight:bold;">${group.totalQty}</td>
                <td>${formattedDate}</td>
                <td>
                    ${batchesBtn}
                    <button class="btn-primary" style="padding:4px 8px; font-size:12px; background:#f59e0b; color:black; margin-right:5px;" 
                        onclick="editProduct('${group.product_code}')">Edit</button>
                    <button class="btn-danger" style="padding:4px 8px;" onclick="deleteProduct('${group.product_code}', this)">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    });
}

// 3. Add New Product (NON-BLOCKING UPDATE)
async function addProduct() {
    const barcodeEl = document.getElementById('inv-barcode');
    const nameEl = document.getElementById('inv-name');
    const companyEl = document.getElementById('inv-company');
    const priceEl = document.getElementById('inv-price');
    const qtyEl = document.getElementById('inv-qty');
    const catEl = document.getElementById('inv-category');
    const expEl = document.getElementById('inv-expiry');
    const saveBtn = document.querySelector('#add-product-form button.btn-success');

    if (!nameEl) return;

    // Handle Optional Barcode: If empty, generate internal unique ID
    let finalBarcode = barcodeEl.value.trim();
    if (!finalBarcode) {
        finalBarcode = "SYS-" + Date.now(); 
    }

    const payload = {
        barcode: finalBarcode,
        name: nameEl.value.trim(),
        company_name: companyEl.value.trim(),
        price: parseFloat(priceEl.value || 0),
        qty: parseInt(qtyEl.value || 0),
        category: catEl.value,
        expiry_date: expEl.value
    };

    const resetButton = (originalText, originalColor) => {
        setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.innerText = originalText;
            saveBtn.style.backgroundColor = originalColor;
        }, 1500);
    };

    const originalText = "Save Item";
    const originalColor = "";

    // Validate Name (Barcode is optional now)
    if (!payload.name) {
        saveBtn.innerText = "⚠ Missing Name";
        saveBtn.style.backgroundColor = "#ef4444";
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
            saveBtn.innerText = "✔ Saved!";
            saveBtn.style.backgroundColor = "#059669";

            setTimeout(() => {
                // DO NOT HIDE FORM (Update 1)
                // document.getElementById('add-product-form').style.display = 'none';
                
                // Clear fields for next entry (Fast Adding)
                barcodeEl.value = '';
                nameEl.value = '';
                // Keep company & category? User might add multiple from same company. 
                // But prompt implies fresh start usually. Let's clear to be safe.
                // companyEl.value = ''; 
                priceEl.value = '';
                qtyEl.value = '';
                // catEl.value = 'Medicine'; // Keep category selection? Maybe better to keep last used.
                
                // Focus back to first input (Update 5)
                barcodeEl.focus();

                saveBtn.disabled = false;
                saveBtn.innerText = originalText;
                saveBtn.style.backgroundColor = originalColor;

                loadInventory();
            }, 800);
        } else {
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

// Check Existing Product for Auto-Fill (Update 6)
function checkExistingProduct(barcode) {
    if (!barcode) return;
    
    // Check locally in loaded inventoryData for speed
    const existing = inventoryData.find(p => p.barcode === barcode);
    if (existing) {
        document.getElementById('inv-name').value = existing.name;
        document.getElementById('inv-company').value = existing.company_name;
        document.getElementById('inv-price').value = existing.price;
        document.getElementById('inv-category').value = existing.category;
    }
}

// 4. Delete Product (Double Click Logic)
async function deleteProduct(code, btn) {
    // First click: Confirmation
    if (btn.innerText !== "Confirm?") {
        btn.innerText = "Confirm?";
        btn.style.backgroundColor = "#f59e0b"; // Orange warning
        // Reset if not clicked again
        setTimeout(() => {
            if (btn && btn.innerText === "Confirm?") {
                btn.innerText = "Delete";
                btn.style.backgroundColor = ""; // Back to default class style (red)
            }
        }, 3000);
        return;
    }

    // Second click: Execution
    btn.innerText = "Deleting...";
    try {
        const res = await fetch(`/api/products/${code}`, { method: 'DELETE' });
        if (res.ok) {
            loadInventory(); // Auto refresh
        } else {
            btn.innerText = "Error";
            btn.style.backgroundColor = "#ef4444";
        }
    } catch (e) {
        console.error(e);
        btn.innerText = "Network Error";
        btn.style.backgroundColor = "#ef4444";
    }
}

// 5. Edit Product (Open Modal)
function editProduct(code) {
    // Find product data
    const product = inventoryData.find(p => p.product_code == code);
    if (!product) return;

    document.getElementById('edit-code').value = code;
    document.getElementById('edit-barcode').value = product.barcode;
    document.getElementById('edit-name').value = product.name;
    document.getElementById('edit-company').value = product.company_name;
    document.getElementById('edit-price').value = product.price;
    document.getElementById('edit-category').value = product.category;

    document.getElementById('edit-product-form').style.display = 'block';
    document.getElementById('add-product-form').style.display = 'none'; // Close add form if open
}

// 6. View Batches (New Feature)
function viewBatches(code) {
    // Filter all items that match this product code
    const batches = inventoryData.filter(p => (p.product_code && p.product_code == code) || (!p.product_code && p.barcode === code));
    
    if (batches.length === 0) return;

    const tbody = document.getElementById('batch-list-body');
    tbody.innerHTML = '';

    batches.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

    batches.forEach(b => {
        const dateObj = new Date(b.expiry_date);
        const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('en-GB') : b.expiry_date;

        tbody.innerHTML += `
            <tr>
                <td>${formattedDate}</td>
                <td style="font-weight:bold;">${b.qty}</td>
            </tr>
        `;
    });

    document.getElementById('batch-modal-title').innerText = `${batches[0].name} (Batches)`;
    document.getElementById('batches-modal').style.display = 'block';
}

// 7. Save Edit (Fixed Error Handling)
async function saveEdit() {
    const code = document.getElementById('edit-code').value;
    const name = document.getElementById('edit-name').value;
    const company = document.getElementById('edit-company').value;
    const price = document.getElementById('edit-price').value;
    const category = document.getElementById('edit-category').value;
    const btn = document.querySelector('#edit-product-form button');

    if(!name) return alert("Name is required");

    btn.innerText = "Updating...";
    btn.disabled = true;

    try {
        const res = await fetch(`/api/products/${code}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, company_name: company, price, category })
        });

        const result = await res.json();

        if (res.ok) {
            document.getElementById('edit-product-form').style.display = 'none';
            loadInventory();
        } else {
            alert("Failed to update: " + (result.error || "Unknown Error"));
        }
    } catch (e) {
        console.error(e);
        alert("Error updating: " + e.message);
    } finally {
        btn.innerText = "Update Item";
        btn.disabled = false;
    }
}

// 8. FILTER LOGIC (Category + Search)
function filterInventory() {
    const searchEl = document.getElementById('inv-search');
    const catEl = document.getElementById('inv-filter-cat');

    const searchText = searchEl ? searchEl.value.toLowerCase() : '';
    const selectedCategory = catEl ? catEl.value : 'all';

    const filtered = inventoryData.filter(item => {
        const itemName = (item.name || '').toLowerCase();
        const barcode = (item.barcode || '').toString().toLowerCase();
        const company = (item.company_name || '').toLowerCase();

        // Match Name, Barcode OR Company
        const matchesSearch = itemName.includes(searchText) ||
            barcode.includes(searchText) ||
            company.includes(searchText);

        const matchesCategory = (selectedCategory === 'all') || (item.category === selectedCategory);

        return matchesSearch && matchesCategory;
    });

    renderInventory(filtered);
}

// Initialize on page load
loadInventory();