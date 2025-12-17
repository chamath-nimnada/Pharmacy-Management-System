let inventoryData = [];
let currentOpenProductCode = null;

// 1. Load Inventory from Server
async function loadInventory() {
    try {
        const res = await fetch('/api/products');
        const data = await res.json();

        if (data.data) {
            inventoryData = data.data;
            filterInventory();
        } else {
            console.error("No data received from API");
        }
    } catch (error) {
        console.error("Error loading inventory:", error);
        const tbody = document.getElementById('inventory-list');
        if (tbody) tbody.innerHTML = '<tr><td colspan="10">Error connecting to server.</td></tr>';
    }
}

// 2. Render Table Rows (OPTIMIZED FOR LARGE DATASETS)
function renderInventory(products) {
    const tbody = document.getElementById('inventory-list');
    if (!tbody) return;

    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 20px; color: #666;">No products found matching filters.</td></tr>';
        return;
    }

    // Group items
    const grouped = {};
    products.forEach(item => {
        const key = item.product_code || item.barcode;
        if (!grouped[key]) {
            grouped[key] = { ...item, totalQty: 0, batches: [] };
        }
        grouped[key].totalQty += item.qty;
        grouped[key].batches.push(item);
    });

    // --- FIX: Build a string buffer to avoid DOM re-parsing in the loop ---
    let htmlContent = '';

    Object.values(grouped).forEach(group => {
        group.batches.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
        const nearestExpiry = group.batches[0].expiry_date;
        const batchCount = group.batches.length;

        const displayName = group.trade_name || group.name;
        const displayGeneric = group.generic_name || '-';

        let displayBarcode = group.barcode || '';
        if (displayBarcode.length > 15) {
            displayBarcode = `${displayBarcode.substring(0, 15)}<span style="color:blue;">...</span>`;
        } else if (!displayBarcode) {
            displayBarcode = '<span style="color:#ccc">N/A</span>';
        }

        let rowStyle = '';
        if (group.totalQty < 5) rowStyle = 'background: #fff0f0; color: #d63031;';

        const dateObj = new Date(nearestExpiry);
        const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('en-GB') : nearestExpiry;

        let actionButtons = '';
        if (batchCount > 1) {
            actionButtons = `
                <button class="btn-primary" style="padding:4px 8px; font-size:12px; background:#64748b; color:white; margin-right:5px;" 
                    onclick="viewBatches('${group.product_code || group.barcode}')">Batches</button>
                <button class="btn-primary" style="padding:4px 8px; font-size:12px; background:#f59e0b; color:black; margin-right:5px;" 
                    onclick="editProduct('${group.product_code}')">Edit All</button>
                <button class="btn-danger" style="padding:4px 8px;" onclick="deleteProduct('${group.product_code}', this)">
                    Delete All
                </button>
            `;
        } else {
            actionButtons = `
                <button class="btn-primary" style="padding:4px 8px; font-size:12px; background:#f59e0b; color:black; margin-right:5px;" 
                    onclick="editProduct('${group.product_code}')">Edit</button>
                <button class="btn-danger" style="padding:4px 8px;" onclick="deleteProduct('${group.product_code}', this)">
                    Delete
                </button>
            `;
        }

        htmlContent += `
            <tr style="${rowStyle}">
                <td style="font-family:monospace; color:#64748b;">${group.product_code || '-'}</td>
                <td style="font-family:monospace; font-weight:bold;">${displayBarcode}</td>
                <td style="font-weight:bold;">${displayName} ${batchCount > 1 ? `<span style="font-size:10px; color:blue;">(${batchCount})</span>` : ''}</td>
                <td style="color:#64748b;">${displayGeneric}</td>
                <td style="color:#475569;">${group.company_name || '-'}</td>
                <td><span class="badge" style="background:#eef2f6; color:#333; padding:4px 8px; border-radius:4px;">${group.category}</span></td>
                <td>LKR ${parseFloat(group.price).toFixed(2)}</td>
                <td style="font-weight:bold;">${group.totalQty}</td>
                <td>${formattedDate}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    });

    // Update the DOM exactly once
    tbody.innerHTML = htmlContent;
}

// 3. Add New Product
async function addProduct() {
    const barcodeEl = document.getElementById('inv-barcode');
    const tradeEl = document.getElementById('inv-trade-name');
    const genericEl = document.getElementById('inv-generic-name');
    const companyEl = document.getElementById('inv-company');
    const priceEl = document.getElementById('inv-price'); 
    const qtyEl = document.getElementById('inv-qty');
    const catEl = document.getElementById('inv-category');
    const expEl = document.getElementById('inv-expiry');
    const saveBtn = document.querySelector('#add-product-form button.btn-success');

    if (!tradeEl) return;

    let finalBarcode = barcodeEl.value.trim();
    if (!finalBarcode) finalBarcode = "SYS-" + Date.now(); 

    const payload = {
        barcode: finalBarcode,
        trade_name: tradeEl.value.trim(),
        generic_name: genericEl.value.trim(),
        company_name: companyEl.value.trim(),
        price: parseFloat(priceEl.value || 0),
        qty: parseInt(qtyEl.value || 0),
        category: catEl.value,
        expiry_date: expEl.value
    };

    const resetButton = (text) => {
        setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.innerText = text;
            saveBtn.style.backgroundColor = "";
        }, 1500);
    };

    if (!payload.trade_name) {
        saveBtn.innerText = "⚠ Missing Trade Name";
        saveBtn.style.backgroundColor = "#ef4444";
        resetButton("Save Item");
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
                barcodeEl.value = '';
                tradeEl.value = '';
                genericEl.value = '';
                companyEl.value = ''; 
                priceEl.value = '';
                qtyEl.value = '';
                expEl.value = '';     
                barcodeEl.focus();
                saveBtn.disabled = false;
                saveBtn.innerText = "Save Item";
                saveBtn.style.backgroundColor = "";
                loadInventory();
            }, 800);
        } else {
            saveBtn.innerText = "⚠ Error Saving";
            saveBtn.style.backgroundColor = "#ef4444";
            resetButton("Save Item");
        }
    } catch (e) {
        saveBtn.innerText = "⚠ Network Error";
        saveBtn.style.backgroundColor = "#ef4444";
        resetButton("Save Item");
    }
}

function checkExistingProduct(barcode) {
    if (!barcode) return;
    const existing = inventoryData.find(p => p.barcode === barcode);
    if (existing) {
        document.getElementById('inv-trade-name').value = existing.trade_name || existing.name;
        document.getElementById('inv-generic-name').value = existing.generic_name || '';
        document.getElementById('inv-company').value = existing.company_name;
        document.getElementById('inv-price').value = existing.price;
        document.getElementById('inv-category').value = existing.category;
    }
}

async function deleteProduct(code, btn) {
    if (btn.innerText !== "Confirm?") {
        const originalText = btn.innerText;
        btn.innerText = "Confirm?";
        btn.style.backgroundColor = "#f59e0b";
        setTimeout(() => {
            if (btn && btn.innerText === "Confirm?") {
                btn.innerText = originalText;
                btn.style.backgroundColor = ""; 
            }
        }, 3000);
        return;
    }

    btn.innerText = "Deleting...";
    try {
        const res = await fetch(`/api/products/${code}`, { method: 'DELETE' });
        if (res.ok) loadInventory();
        else {
            btn.innerText = "Error";
            btn.style.backgroundColor = "#ef4444";
        }
    } catch (e) {
        btn.innerText = "Network Error";
        btn.style.backgroundColor = "#ef4444";
    }
}

// 4. Edit Product logic
function editProduct(code) {
    const batches = inventoryData.filter(p => p.product_code == code);
    if (!batches || batches.length === 0) return;

    const product = batches[0];
    document.getElementById('edit-code').value = code;
    document.getElementById('edit-barcode').value = product.barcode;
    document.getElementById('edit-trade-name').value = product.trade_name || product.name;
    document.getElementById('edit-generic-name').value = product.generic_name || '';
    document.getElementById('edit-company').value = product.company_name;
    document.getElementById('edit-price').value = product.price;
    document.getElementById('edit-category').value = product.category;

    const singleBatchGroup = document.getElementById('edit-single-batch-group');
    const multiBatchMsg = document.getElementById('edit-multi-batch-msg');
    const singleBatchIdInput = document.getElementById('edit-single-batch-id');

    if (batches.length === 1) {
        singleBatchGroup.style.display = 'contents';
        multiBatchMsg.style.display = 'none';
        document.getElementById('edit-qty').value = product.qty;
        document.getElementById('edit-expiry').value = product.expiry_date;
        singleBatchIdInput.value = product.id;
    } else {
        singleBatchGroup.style.display = 'none';
        multiBatchMsg.style.display = 'flex';
        singleBatchIdInput.value = '';
    }

    document.getElementById('edit-product-form').style.display = 'flex';
    document.getElementById('add-product-form').style.display = 'none';
}

async function saveEdit() {
    const code = document.getElementById('edit-code').value;
    const trade_name = document.getElementById('edit-trade-name').value;
    const generic_name = document.getElementById('edit-generic-name').value;
    const company = document.getElementById('edit-company').value;
    const price = document.getElementById('edit-price').value;
    const category = document.getElementById('edit-category').value;
    
    const batchId = document.getElementById('edit-single-batch-id').value;
    const qty = document.getElementById('edit-qty').value;
    const expiry_date = document.getElementById('edit-expiry').value;

    const btn = document.querySelector('#edit-product-form button.btn-primary');
    if(!trade_name) return alert("Trade Name is required");

    btn.innerText = "Updating...";
    btn.disabled = true;

    try {
        await fetch(`/api/products/${code}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trade_name, generic_name, company_name: company, price, category })
        });

        if (batchId && qty && expiry_date) {
            await fetch(`/api/batch/${batchId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qty: parseInt(qty), expiry_date })
            });
        }
        document.getElementById('edit-product-form').style.display = 'none';
        loadInventory();
    } catch (e) {
        alert("Error updating");
    } finally {
        btn.innerText = "Update Item";
        btn.disabled = false;
    }
}

// 6. View Batches
function viewBatches(code) {
    currentOpenProductCode = code;
    const batches = inventoryData.filter(p => (p.product_code && p.product_code == code) || (!p.product_code && p.barcode === code));
    if (batches.length === 0) return;

    const tbody = document.getElementById('batch-list-body');
    tbody.innerHTML = '';
    batches.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

    batches.forEach(b => {
        const dateObj = new Date(b.expiry_date);
        const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('en-GB') : b.expiry_date;
        tbody.innerHTML += `
            <tr id="batch-row-${b.id}">
                <td class="batch-date">${formattedDate}</td>
                <td class="batch-qty" style="font-weight:bold;">${b.qty}</td>
                <td>
                    <button class="btn-sm" style="background:#f59e0b; color:black;" onclick="enableBatchInlineEdit(${b.id}, '${b.qty}', '${b.expiry_date}')">Edit</button>
                    <button class="btn-sm" style="background:#ef4444; color:white;" onclick="deleteBatch(${b.id})">Delete</button>
                </td>
            </tr>
        `;
    });

    document.getElementById('batch-modal-title').innerText = `${batches[0].trade_name || batches[0].name} (Batches)`;
    document.getElementById('batches-modal').style.display = 'flex';
}

async function saveBatchInline(id) {
    const newQty = document.getElementById(`edit-batch-qty-${id}`).value;
    const newExpiry = document.getElementById(`edit-batch-date-${id}`).value;
    try {
        const res = await fetch(`/api/batch/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qty: parseInt(newQty), expiry_date: newExpiry })
        });
        if (res.ok) {
            await loadInventory();
            if(currentOpenProductCode) viewBatches(currentOpenProductCode);
        }
    } catch (e) { console.error(e); }
}

function filterInventory() {
    const searchText = (document.getElementById('inv-search')?.value || '').toLowerCase();
    const selectedCategory = document.getElementById('inv-filter-cat')?.value || 'all';

    const filtered = inventoryData.filter(item => {
        const matchesSearch = (item.trade_name || item.name || '').toLowerCase().includes(searchText) ||
                             (item.generic_name || '').toLowerCase().includes(searchText) ||
                             (item.barcode || '').toString().toLowerCase().includes(searchText) ||
                             (item.company_name || '').toLowerCase().includes(searchText);
        const matchesCategory = (selectedCategory === 'all') || (item.category === selectedCategory);
        return matchesSearch && matchesCategory;
    });

    renderInventory(filtered);
}

loadInventory();