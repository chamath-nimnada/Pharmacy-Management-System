let inventoryData = [];
let currentOpenProductCode = null;
let searchDebounceTimer = null;

// Helper to ensure the main interface is interactive
function resetUIState() {
    const addForm = document.getElementById('add-product-form');
    if (addForm) {
        addForm.style.display = 'block';
        const allInputs = addForm.querySelectorAll('input, select, button');
        allInputs.forEach(el => el.disabled = false);
    }
    document.querySelectorAll('button').forEach(btn => btn.disabled = false);
}

// 1. Load Inventory from Server
async function loadInventory() {
    try {
        const res = await fetch('/api/products');
        const data = await res.json();
        if (data.data) {
            inventoryData = data.data;
            filterInventory();
        }
    } catch (error) {
        console.error("Error loading inventory:", error);
        const tbody = document.getElementById('inventory-list');
        if (tbody) tbody.innerHTML = '<tr><td colspan="10">Error connecting to server.</td></tr>';
    } finally {
        resetUIState();
    }
}

// 2. Render Table Rows (Optimized: Top 50 Limit)
function renderInventory(products) {
    const tbody = document.getElementById('inventory-list');
    if (!tbody) return;

    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 20px; color: #666;">No products found matching filters.</td></tr>';
        return;
    }

    const grouped = {};
    products.forEach(item => {
        const key = item.product_code || item.barcode;
        if (!grouped[key]) {
            grouped[key] = { ...item, totalQty: 0, batches: [] };
        }
        grouped[key].totalQty += item.qty;
        grouped[key].batches.push(item);
    });

    let htmlContent = '';
    const groupsArray = Object.values(grouped);
    const DISPLAY_LIMIT = 50;
    const itemsToShow = groupsArray.slice(0, DISPLAY_LIMIT);

    itemsToShow.forEach(group => {
        group.batches.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
        const nearestExpiry = group.batches[0].expiry_date;
        const batchCount = group.batches.length;
        const displayName = group.trade_name || group.name;

        const dateObj = new Date(nearestExpiry);
        const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('en-GB') : nearestExpiry;
        const rowStyle = group.totalQty < 5 ? 'background: #fff0f0; color: #d63031;' : '';

        let actionButtons = `
            ${batchCount > 1 ? `<button class="btn-primary" style="padding:4px 8px; font-size:12px; background:#64748b; margin-right:5px;" onclick="viewBatches('${group.product_code || group.barcode}')">Batches</button>` : ''}
            <button class="btn-primary" style="padding:4px 8px; font-size:12px; background:#f59e0b; color:black; margin-right:5px;" onclick="editProduct('${group.product_code}')">${batchCount > 1 ? 'Edit All' : 'Edit'}</button>
            <button class="btn-danger" style="padding:4px 8px;" onclick="deleteProduct('${group.product_code}', this)">${batchCount > 1 ? 'Delete All' : 'Delete'}</button>
        `;

        htmlContent += `
            <tr style="${rowStyle}">
                <td class="sticky-col col-sticky-1" style="font-family:monospace; color:#64748b;">${group.product_code || '-'}</td>
                <td class="sticky-col col-sticky-2" style="font-weight:bold;">${displayName} ${batchCount > 1 ? `<span style="color:blue;">(${batchCount})</span>` : ''}</td>
                <td style="font-family:monospace; font-weight:bold;">${group.barcode || '-'}</td>
                <td>${group.generic_name || '-'}</td>
                <td>${group.company_name || '-'}</td>
                <td><span class="badge" style="background:#eef2f6; color:#333;">${group.category}</span></td>
                <td>LKR ${parseFloat(group.price).toFixed(2)}</td>
                <td style="font-weight:bold;">${group.totalQty}</td>
                <td>${formattedDate}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    });

    if (groupsArray.length > DISPLAY_LIMIT) {
        htmlContent += `
            <tr>
                <td colspan="10" style="text-align:center; padding:15px; color:#666; background:#f8fafc; font-style:italic;">
                    Showing top ${DISPLAY_LIMIT} results of ${groupsArray.length}. Use the search bar to find specific items.
                </td>
            </tr>
        `;
    }

    tbody.innerHTML = htmlContent;
}

// Helper: Clear Form and Focus Barcode
function clearAddForm() {
    document.getElementById('inv-barcode').value = '';
    document.getElementById('inv-trade-name').value = '';
    document.getElementById('inv-generic-name').value = '';
    document.getElementById('inv-company').value = '';
    document.getElementById('inv-price').value = '';
    document.getElementById('inv-qty').value = '';
    document.getElementById('inv-category').value = 'Medicine'; // Reset to default
    document.getElementById('inv-expiry').value = '';

    // Focus back to barcode for rapid entry
    document.getElementById('inv-barcode').focus();
}

// 3. Add New Product
async function addProduct() {
    const saveBtn = document.querySelector('#add-product-form button.btn-success');
    if (!saveBtn || saveBtn.disabled) return;

    const payload = {
        barcode: document.getElementById('inv-barcode').value.trim() || "SYS-" + Date.now(),
        trade_name: document.getElementById('inv-trade-name').value.trim(),
        generic_name: document.getElementById('inv-generic-name').value.trim(),
        company_name: document.getElementById('inv-company').value.trim(),
        price: parseFloat(document.getElementById('inv-price').value || 0),
        qty: parseInt(document.getElementById('inv-qty').value || 0),
        category: document.getElementById('inv-category').value,
        expiry_date: document.getElementById('inv-expiry').value
    };

    if (!payload.trade_name) return alert("Missing Trade Name");

    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    try {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            saveBtn.innerText = "Saved!";
            saveBtn.style.backgroundColor = "#059669";
            setTimeout(() => {
                // Use the new helper function
                clearAddForm();

                saveBtn.innerText = "Save Item";
                saveBtn.style.backgroundColor = "";
                loadInventory();
            }, 800);
        }
    } catch (e) {
        saveBtn.innerText = "Error";
        saveBtn.style.backgroundColor = "#ef4444";
    } finally {
        setTimeout(() => { saveBtn.disabled = false; }, 1000);
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

// 4. Batch Logic
function viewBatches(code) {
    currentOpenProductCode = code;
    const batches = inventoryData.filter(p => (p.product_code && p.product_code == code) || (!p.product_code && p.barcode === code));
    if (batches.length === 0) {
        closeBatchModal();
        return;
    }

    const tbody = document.getElementById('batch-list-body');
    let html = '';
    batches.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

    batches.forEach(b => {
        const formattedDate = new Date(b.expiry_date).toLocaleDateString('en-GB');
        html += `
            <tr id="batch-row-${b.id}">
                <td>${formattedDate}</td>
                <td style="font-weight:bold;">${b.qty}</td>
                <td>
                    <button class="btn-sm" style="background:#f59e0b; color:black;" onclick="enableBatchInlineEdit(${b.id}, '${b.qty}', '${b.expiry_date}')">Edit</button>
                    <button class="btn-sm" style="background:#ef4444; color:white;" onclick="deleteBatch(${b.id})">Delete</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    document.getElementById('batch-modal-title').innerText = `${batches[0].trade_name || batches[0].name} (Batches)`;
    document.getElementById('batches-modal').style.display = 'flex';
}

function enableBatchInlineEdit(id, qty, expiry) {
    const row = document.getElementById(`batch-row-${id}`);
    if (!row) return;

    row.innerHTML = `
        <td><input type="date" id="edit-batch-date-${id}" value="${expiry}" style="padding:4px; font-size:12px; width:100%;"></td>
        <td><input type="number" id="edit-batch-qty-${id}" value="${qty}" style="padding:4px; width:60px; font-size:12px;"></td>
        <td>
            <button class="btn-sm" id="btn-batch-save-${id}" style="background:#059669; color:white;" onclick="saveBatchInline(${id})">Save</button>
            <button class="btn-sm" style="background:#64748b; color:white;" onclick="viewBatches(currentOpenProductCode)">Cancel</button>
        </td>
    `;
}

async function saveBatchInline(id) {
    const btn = document.getElementById(`btn-batch-save-${id}`);
    const newQty = document.getElementById(`edit-batch-qty-${id}`).value;
    const newExpiry = document.getElementById(`edit-batch-date-${id}`).value;

    if (btn) btn.disabled = true;

    try {
        const res = await fetch(`/api/batch/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qty: parseInt(newQty), expiry_date: newExpiry })
        });
        if (res.ok) {
            await loadInventory();
            viewBatches(currentOpenProductCode);
        }
    } catch (e) {
        console.error(e);
    } finally {
        resetUIState();
    }
}

async function deleteBatch(id) {
    if (!confirm("Are you sure?")) return;
    try {
        const res = await fetch(`/api/batch/${id}`, { method: 'DELETE' });
        if (res.ok) {
            await loadInventory();
            viewBatches(currentOpenProductCode);
        }
    } catch (e) {
        console.error(e);
    } finally {
        resetUIState();
    }
}

// 5. Product Actions
function editProduct(code) {
    const batches = inventoryData.filter(p => p.product_code == code);
    if (batches.length === 0) return;

    const product = batches[0];
    document.getElementById('edit-code').value = code;
    document.getElementById('edit-barcode').value = product.barcode;
    document.getElementById('edit-trade-name').value = product.trade_name || product.name;
    document.getElementById('edit-generic-name').value = product.generic_name || '';
    document.getElementById('edit-company').value = product.company_name;
    document.getElementById('edit-price').value = product.price;
    document.getElementById('edit-category').value = product.category;

    const isSingle = batches.length === 1;
    document.getElementById('edit-single-batch-group').style.display = isSingle ? 'contents' : 'none';
    document.getElementById('edit-multi-batch-msg').style.display = isSingle ? 'none' : 'flex';

    if (isSingle) {
        document.getElementById('edit-single-batch-id').value = product.id;
        document.getElementById('edit-qty').value = product.qty;
        document.getElementById('edit-expiry').value = product.expiry_date;
    }

    document.getElementById('edit-product-form').style.display = 'flex';
    document.getElementById('add-product-form').style.display = 'none';
}

async function saveEdit() {
    const btn = document.querySelector('#edit-product-form button.btn-primary');
    const code = document.getElementById('edit-code').value;

    btn.disabled = true;
    try {
        await fetch(`/api/products/${code}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                trade_name: document.getElementById('edit-trade-name').value,
                generic_name: document.getElementById('edit-generic-name').value,
                company_name: document.getElementById('edit-company').value,
                price: document.getElementById('edit-price').value,
                category: document.getElementById('edit-category').value
            })
        });

        const batchId = document.getElementById('edit-single-batch-id').value;
        if (batchId) {
            await fetch(`/api/batch/${batchId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    qty: parseInt(document.getElementById('edit-qty').value),
                    expiry_date: document.getElementById('edit-expiry').value
                })
            });
        }
        closeModals();
        loadInventory();
    } catch (e) {
        alert("Update Error");
    } finally {
        resetUIState();
    }
}

async function deleteProduct(code, btn) {
    if (btn.innerText !== "Confirm?") {
        const originalText = btn.innerText;
        btn.innerText = "Confirm?";
        btn.style.backgroundColor = "#f59e0b";
        setTimeout(() => { if (btn.innerText === "Confirm?") { btn.innerText = originalText; btn.style.backgroundColor = ""; } }, 3000);
        return;
    }

    btn.disabled = true;
    try {
        const res = await fetch(`/api/products/${code}`, { method: 'DELETE' });
        if (res.ok) loadInventory();
    } catch (e) {
        btn.disabled = false;
    }
}

// OPTIMIZED: Debounced Filter
function filterInventory() {
    clearTimeout(searchDebounceTimer);

    searchDebounceTimer = setTimeout(() => {
        const searchText = (document.getElementById('inv-search')?.value || '').toLowerCase();
        const selectedCategory = document.getElementById('inv-filter-cat')?.value || 'all';

        const filtered = inventoryData.filter(item => {
            const matchesSearch = (item.trade_name || item.name || '').toLowerCase().includes(searchText) ||
                (item.barcode || '').toString().toLowerCase().includes(searchText);
            const matchesCategory = (selectedCategory === 'all') || (item.category === selectedCategory);
            return matchesSearch && matchesCategory;
        });

        renderInventory(filtered);
    }, 300);
}

function closeModals() {
    document.getElementById('edit-product-form').style.display = 'none';
    document.getElementById('batches-modal').style.display = 'none';
    resetUIState();
}

function closeBatchModal() {
    document.getElementById('batches-modal').style.display = 'none';
    resetUIState();
}

loadInventory();