let cart = [];
let products = [];

// Load products for search (grouped for search efficiency)
async function fetchProductsForBilling() {
    try {
        const res = await fetch('/api/products');
        const data = await res.json();
        products = data.data; // Includes all batches
    } catch (e) { console.error(e); }
}
fetchProductsForBilling();

// Event Listeners for Discount Inputs
document.querySelectorAll('.discount-input').forEach(input => {
    input.addEventListener('input', () => {
        renderCart(); // Re-calculate when user types a discount
    });
});

// Barcode Listener
const barcodeInput = document.getElementById('barcode-input');
barcodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const val = barcodeInput.value.trim().toLowerCase();
        
        // Updated Search Logic: Check Trade, Generic, Barcode, Code
        const product = products.find(p => {
            const trade = (p.trade_name || p.name || '').toLowerCase();
            const generic = (p.generic_name || '').toLowerCase();
            const barcode = (p.barcode || '').toLowerCase();
            const pCode = (p.product_code || '').toString();

            return barcode === val || pCode === val || trade === val || generic === val;
        });

        if (product) {
            addToCart(product);
            barcodeInput.value = '';
            barcodeInput.style.borderColor = "";
            barcodeInput.placeholder = "Scan Barcode, Trade Name, or Generic...";
        } else {
            // Visual Feedback for Not Found
            barcodeInput.value = '';
            barcodeInput.style.borderColor = "var(--danger)";
            barcodeInput.placeholder = "⚠ Product Not Found!";
            setTimeout(() => {
                barcodeInput.style.borderColor = "";
                barcodeInput.placeholder = "Scan Barcode, Trade Name, or Generic...";
            }, 1500);
        }
    }
});

function addToCart(product) {
    const existing = cart.find(c => c.barcode === product.barcode);
    if (existing) {
        existing.buyQty++;
    } else {
        // Map Display Name for Cart (Use Trade Name)
        cart.push({ 
            ...product, 
            name: product.trade_name || product.name, 
            buyQty: 1 
        });
    }
    renderCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

// Helper to get applicable discount
function getDiscountForItem(category) {
    const medInput = document.getElementById('disc-medicine');
    const drugInput = document.getElementById('disc-drug');
    const otherInput = document.getElementById('disc-other');

    const discMed = medInput ? parseFloat(medInput.value || 0) : 0;
    const discDrug = drugInput ? parseFloat(drugInput.value || 0) : 0;
    const discOther = otherInput ? parseFloat(otherInput.value || 0) : 0;

    if (category === 'Medicine') return discMed;
    if (category === 'Drug') return discDrug;
    if (category === 'Other') return discOther;
    return 0;
}

function renderCart() {
    const tbody = document.getElementById('cart-body');
    tbody.innerHTML = '';

    let subTotal = 0;
    let totalDiscount = 0;

    cart.forEach((item, index) => {
        // Calculate Line Totals
        const originalLineTotal = item.price * item.buyQty;
        subTotal += originalLineTotal;

        // Apply Discount
        const discountPct = getDiscountForItem(item.category);
        const discountedPrice = item.price * (1 - discountPct / 100);
        const finalLineTotal = discountedPrice * item.buyQty;

        totalDiscount += (originalLineTotal - finalLineTotal);

        // Display Logic
        let priceDisplay = item.price.toFixed(2);
        let totalDisplay = finalLineTotal.toFixed(2);

        if (discountPct > 0) {
            // Use CSS class for thin line (Visual UI)
            priceDisplay = `<span class="strike-thin" style="font-size:11px;">${item.price.toFixed(2)}</span> <br> ${discountedPrice.toFixed(2)}`;
            totalDisplay = `<span class="strike-thin" style="font-size:11px;">${originalLineTotal.toFixed(2)}</span> <br> ${finalLineTotal.toFixed(2)}`;
        }

        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td style="font-size:12px; color:#666;">${item.category}</td>
                <td>${priceDisplay}</td>
                <td>
                    <input type="number" min="1" value="${item.buyQty}" 
                    style="width:50px; padding:5px;" 
                    onchange="updateQty(${index}, this.value)">
                </td>
                <td style="font-weight:bold;">${totalDisplay}</td>
                <td><button onclick="removeFromCart(${index})" style="color:red; background:none;">✕</button></td>
            </tr>
        `;
    });

    const grandTotal = subTotal - totalDiscount;

    document.getElementById('sub-total').innerText = subTotal.toFixed(2);
    document.getElementById('disc-total').innerText = `-${totalDiscount.toFixed(2)}`;
    document.getElementById('grand-total').innerText = `LKR ${grandTotal.toFixed(2)}`;
}

function updateQty(index, newQty) {
    if (newQty < 1) return;
    cart[index].buyQty = parseInt(newQty);
    renderCart();
}

async function processSale() {
    const btn = document.querySelector('.btn-checkout');
    const originalText = `Complete Sale <span class="material-icons-round">arrow_forward</span>`;

    const showBtnError = (msg) => {
        btn.innerText = msg;
        btn.style.backgroundColor = "var(--danger)";
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.backgroundColor = "var(--primary)";
        }, 1500);
    };

    if (cart.length === 0) return showBtnError("⚠ Cart is Empty!");

    const method = document.getElementById('payment-method').value;
    const total = parseFloat(document.getElementById('grand-total').innerText.replace('LKR ', ''));
    const subTotal = parseFloat(document.getElementById('sub-total').innerText.replace('LKR ', ''));

    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        // 1. Send to Backend
        const res = await fetch('/api/sale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: cart, total, method })
        });

        const result = await res.json();

        if (result.saleId) {
            // 2. GENERATE BILL
            document.getElementById('rec-bill-no').innerText = result.saleId;
            document.getElementById('rec-date').innerText = new Date().toLocaleString('en-GB');

            const recItemsBody = document.getElementById('rec-items');
            recItemsBody.innerHTML = '';

            const rates = [];
            if (getDiscountForItem('Medicine') > 0) rates.push(`Medicine: ${getDiscountForItem('Medicine')}%`);
            if (getDiscountForItem('Drug') > 0) rates.push(`Drug: ${getDiscountForItem('Drug')}%`);
            if (getDiscountForItem('Other') > 0) rates.push(`Other: ${getDiscountForItem('Other')}%`);
            document.getElementById('rec-discounts').innerText = rates.length > 0 ? "Discount: " + rates.join(', ') : "";

            cart.forEach(item => {
                const discountPct = getDiscountForItem(item.category);
                const originalPrice = item.price;
                const discountedPrice = item.price * (1 - discountPct / 100);

                const originalLineTotal = originalPrice * item.buyQty;
                const lineTotal = discountedPrice * item.buyQty;

                let priceDisplay = originalPrice.toFixed(2);
                let totalDisplay = lineTotal.toFixed(2);

                if (discountPct > 0) {
                    // Use CSS class for thin line (Print Receipt)
                    priceDisplay = `<span class="strike-thin" style="font-size:10px; text-decoration:line-through; text-decoration-thickness: 0.5px; text-decoration-style: dotted;">${originalPrice.toFixed(2)}</span><br>${discountedPrice.toFixed(2)}`;
                    totalDisplay = `<span class="strike-thin" style="font-size:10px; text-decoration:line-through; text-decoration-thickness: 0.5px; text-decoration-style: dotted;">${originalLineTotal.toFixed(2)}</span><br>${lineTotal.toFixed(2)}`;
                }

                // UPDATED: Added Generic Name under Trade Name
                recItemsBody.innerHTML += `
                    <tr>
                        <td style="font-size:11px;">
                            ${item.name}
                            ${item.generic_name ? `<br><span style="font-size:9px; color:black;">(${item.generic_name})</span>` : ''}
                        </td>
                        <td style="font-size:11px;">${priceDisplay}</td>
                        <td style="font-size:11px; text-align:center;">${item.buyQty}</td>
                        <td style="text-align:right; font-size:11px;">${totalDisplay}</td>
                    </tr>
                `;
            });

            // Total Display Logic
            if (total < subTotal) {
                // Use CSS class for thin line (Print Receipt Total)
                document.getElementById('rec-total').innerHTML = `<span class="strike-thin" style="font-size:11px; text-decoration:line-through; text-decoration-thickness: 1px; text-decoration-style: dotted;">Rs. ${subTotal.toFixed(2)}</span><br>LKR ${total.toFixed(2)}`;
            } else {
                document.getElementById('rec-total').innerText = `LKR ${total.toFixed(2)}`;
            }

            // 3. Print
            window.print();

            // 4. Cleanup
            cart = [];
            const discMed = document.getElementById('disc-medicine');
            const discDrug = document.getElementById('disc-drug');
            const discOther = document.getElementById('disc-other');
            if (discMed) discMed.value = '';
            if (discDrug) discDrug.value = '';
            if (discOther) discOther.value = '';

            renderCart();
            loadDashboard();
            fetchProductsForBilling();

            btn.innerHTML = originalText;
            btn.disabled = false;
        } else {
            showBtnError("⚠ Error: " + (result.error || "Failed"));
            btn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        showBtnError("⚠ Network Error");
        btn.disabled = false;
    }
}