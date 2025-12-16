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

// 2. Render Table Rows (GROUPED BY BARCODE/PRODUCT CODE)
function renderInventory(products) {
    const tbody = document.getElementById('inventory-list');
    if (!tbody) return;

    tbody.innerHTML = '';

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

    Object.values(grouped).forEach(group => {
        group.batches.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
        const nearestExpiry = group.batches[0].expiry_date;
        const batchCount = group.batches.length;

        // Use Trade Name (or name if legacy) for display
        const displayName = group.trade_name || group.name;
        const displayGeneric = group.generic_name || '-';

        // --- BARCODE TRUNCATION LOGIC ---
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

        tbody.innerHTML += `
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
                // CLEAR FIELDS
                barcodeEl.value = '';
                tradeEl.value = '';
                genericEl.value = '';
                companyEl.value = ''; // FIXED: Clear Company
                priceEl.value = '';
                qtyEl.value = '';
                expEl.value = '';     // FIXED: Clear Date
                
                barcodeEl.focus();

                saveBtn.disabled = false;
                saveBtn.innerText = "Save Item";
                saveBtn.style.backgroundColor = "";

                loadInventory();
            }, 800);
        } else {
            console.error(result.error);
            saveBtn.innerText = "⚠ Error Saving";
            saveBtn.style.backgroundColor = "#ef4444";
            resetButton("Save Item");
        }
    } catch (e) {
        console.error(e);
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

function editProduct(code) {
    const product = inventoryData.find(p => p.product_code == code);
    if (!product) return;

    document.getElementById('edit-code').value = code;
    document.getElementById('edit-barcode').value = product.barcode;
    document.getElementById('edit-trade-name').value = product.trade_name || product.name;
    document.getElementById('edit-generic-name').value = product.generic_name || '';
    document.getElementById('edit-company').value = product.company_name;
    document.getElementById('edit-price').value = product.price;
    document.getElementById('edit-category').value = product.category;

    document.getElementById('edit-product-form').style.display = 'block';
    document.getElementById('add-product-form').style.display = 'none';
}

async function saveEdit() {
    const code = document.getElementById('edit-code').value;
    const trade_name = document.getElementById('edit-trade-name').value;
    const generic_name = document.getElementById('edit-generic-name').value;
    const company = document.getElementById('edit-company').value;
    const price = document.getElementById('edit-price').value;
    const category = document.getElementById('edit-category').value;
    const btn = document.querySelector('#edit-product-form button');

    if(!trade_name) return alert("Trade Name is required");

    btn.innerText = "Updating...";
    btn.disabled = true;

    try {
        const res = await fetch(`/api/products/${code}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                trade_name, 
                generic_name, 
                company_name: company, 
                price, 
                category 
            })
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
        const rowId = `batch-row-${b.id}`;

        tbody.innerHTML += `
            <tr id="${rowId}">
                <td class="batch-date">${formattedDate}</td>
                <td class="batch-qty" style="font-weight:bold;">${b.qty}</td>
                <td class="batch-actions">
                    <button class="btn-sm" style="background:#f59e0b; color:black; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-right:5px;" 
                        onclick="enableBatchInlineEdit(${b.id}, '${b.qty}', '${b.expiry_date}')">Edit</button>
                    <button class="btn-sm" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" 
                        onclick="deleteBatch(${b.id})">Delete</button>
                </td>
            </tr>
        `;
    });

    const displayName = batches[0].trade_name || batches[0].name;
    document.getElementById('batch-modal-title').innerText = `${displayName} (Batches)`;
    document.getElementById('batches-modal').style.display = 'block';
}

function enableBatchInlineEdit(id, currentQty, currentExpiry) {
    const row = document.getElementById(`batch-row-${id}`);
    if(!row) return;

    const dateCell = row.querySelector('.batch-date');
    const qtyCell = row.querySelector('.batch-qty');
    const actionCell = row.querySelector('.batch-actions');

    dateCell.innerHTML = `<input type="date" id="edit-batch-date-${id}" value="${currentExpiry}" style="width:100%; padding:2px;">`;
    qtyCell.innerHTML = `<input type="number" id="edit-batch-qty-${id}" value="${currentQty}" style="width:100%; padding:2px;">`;

    actionCell.innerHTML = `
        <button class="btn-sm" style="background:#059669; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-right:5px;" 
            onclick="saveBatchInline(${id})">Save</button>
        <button class="btn-sm" style="background:#64748b; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" 
            onclick="cancelBatchEdit()">Cancel</button>
    `;
}

async function saveBatchInline(id) {
    const newQty = document.getElementById(`edit-batch-qty-${id}`).value;
    const newExpiry = document.getElementById(`edit-batch-date-${id}`).value;

    if(!newQty || !newExpiry) return alert("Invalid values");

    try {
        const res = await fetch(`/api/batch/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qty: parseInt(newQty), expiry_date: newExpiry })
        });

        if (res.ok) {
            await loadInventory();
            if(currentOpenProductCode) {
                const exists = inventoryData.some(p => (p.product_code && p.product_code == currentOpenProductCode) || (!p.product_code && p.barcode === currentOpenProductCode));
                if (exists) viewBatches(currentOpenProductCode);
                else document.getElementById('batches-modal').style.display = 'none';
            }
        } else {
            alert("Error updating batch.");
        }
    } catch (e) {
        console.error(e);
        alert("Network Error");
    }
}

function cancelBatchEdit() {
    if(currentOpenProductCode) {
        viewBatches(currentOpenProductCode);
    }
}

async function deleteBatch(id) {
    if (!confirm("Are you sure you want to delete this batch?")) return;

    try {
        const res = await fetch(`/api/batch/${id}`, { method: 'DELETE' });
        if (res.ok) {
            await loadInventory(); 
            
            // Fix: Check if product still has any batches. If not, close modal.
            if(currentOpenProductCode) {
                const stillExists = inventoryData.some(p => (p.product_code && p.product_code == currentOpenProductCode) || (!p.product_code && p.barcode === currentOpenProductCode));
                
                if(stillExists) {
                    viewBatches(currentOpenProductCode); // Refresh list
                } else {
                    document.getElementById('batches-modal').style.display = 'none'; // Close modal
                }
            }
        } else {
            alert("Error deleting batch.");
        }
    } catch (e) {
        console.error(e);
        alert("Network Error");
    }
}

function filterInventory() {
    const searchEl = document.getElementById('inv-search');
    const catEl = document.getElementById('inv-filter-cat');

    const searchText = searchEl ? searchEl.value.toLowerCase() : '';
    const selectedCategory = catEl ? catEl.value : 'all';

    const filtered = inventoryData.filter(item => {
        const trade = (item.trade_name || item.name || '').toLowerCase();
        const generic = (item.generic_name || '').toLowerCase();
        const barcode = (item.barcode || '').toString().toLowerCase();
        const company = (item.company_name || '').toLowerCase();

        const matchesSearch = trade.includes(searchText) ||
            generic.includes(searchText) ||
            barcode.includes(searchText) ||
            company.includes(searchText);

        const matchesCategory = (selectedCategory === 'all') || (item.category === selectedCategory);

        return matchesSearch && matchesCategory;
    });

    renderInventory(filtered);
}

loadInventory();