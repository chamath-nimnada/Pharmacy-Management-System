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

// Barcode Listener
const barcodeInput = document.getElementById('barcode-input');
barcodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const val = barcodeInput.value.trim();
        // Find ANY batch matching barcode/name to get Product Info
        const product = products.find(p => p.barcode === val || p.name.toLowerCase() === val.toLowerCase());

        if (product) {
            addToCart(product);
            barcodeInput.value = '';
        } else {
            alert('Product not found! Check inventory.');
        }
    }
});

function addToCart(product) {
    // Add based on unique Barcode
    const existing = cart.find(c => c.barcode === product.barcode);
    if (existing) {
        existing.buyQty++;
    } else {
        // We only store the barcode in cart. Backend handles FIFO deduction from batches.
        cart.push({ ...product, buyQty: 1 });
    }
    renderCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

function renderCart() {
    const tbody = document.getElementById('cart-body');
    tbody.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.buyQty;
        total += itemTotal;
        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td>${item.price.toFixed(2)}</td>
                <td>
                    <input type="number" min="1" value="${item.buyQty}" 
                    style="width:50px; padding:5px;" 
                    onchange="updateQty(${index}, this.value)">
                </td>
                <td>${itemTotal.toFixed(2)}</td>
                <td><button onclick="removeFromCart(${index})" style="color:red; background:none;">✕</button></td>
            </tr>
        `;
    });

    document.getElementById('sub-total').innerText = total.toFixed(2);
    document.getElementById('grand-total').innerText = `LKR ${total.toFixed(2)}`;
}

function updateQty(index, newQty) {
    if (newQty < 1) return;
    cart[index].buyQty = parseInt(newQty);
    renderCart();
}

async function processSale() {
    if (cart.length === 0) return alert("Cart is empty!");

    const method = document.getElementById('payment-method').value;
    const total = parseFloat(document.getElementById('grand-total').innerText.replace('LKR ', ''));

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
        document.getElementById('rec-date').innerText = new Date().toLocaleString();

        const recItemsBody = document.getElementById('rec-items');
        recItemsBody.innerHTML = '';

        cart.forEach(item => {
            recItemsBody.innerHTML += `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.buyQty}</td>
                    <td style="text-align:right;">${(item.price * item.buyQty).toFixed(2)}</td>
                </tr>
            `;
        });

        document.getElementById('rec-total').innerText = `LKR ${total.toFixed(2)}`;

        // 3. Print
        window.print();

        // 4. Cleanup
        cart = [];
        renderCart();
        loadDashboard();
        fetchProductsForBilling(); // Refresh stock data
    } else {
        alert("Error processing sale: " + result.error);
    }
}