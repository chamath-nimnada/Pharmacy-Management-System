let cart = [];
let products = [];

// 1. Fetch products for lookup
async function fetchProducts() {
    const res = await fetch('/api/products');
    const data = await res.json();
    products = data.data;
}
fetchProducts();

// 2. Barcode Listener (Auto-detect scanner input)
const barcodeInput = document.getElementById('barcode-input');
barcodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const code = barcodeInput.value;
        addToCartByBarcode(code);
        barcodeInput.value = ''; // Clear for next scan
    }
});

function addToCartByBarcode(code) {
    const product = products.find(p => p.barcode === code);
    if (product) {
        addToCart(product);
    } else {
        alert('Product not found!');
    }
}

function addToCart(product) {
    const existing = cart.find(c => c.id === product.id);
    if (existing) {
        existing.buyQty++;
    } else {
        cart.push({ ...product, buyQty: 1 });
    }
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
                <td>${item.price}</td>
                <td>${item.buyQty}</td>
                <td>${itemTotal}</td>
                <td onclick="removeFromCart(${index})" style="cursor:pointer; color:red;">🗑</td>
            </tr>
        `;
    });

    document.getElementById('grand-total').innerText = `LKR ${total.toFixed(2)}`;
}

async function processSale() {
    const method = document.getElementById('payment-method').value;
    const total = parseFloat(document.getElementById('grand-total').innerText.replace('LKR ', ''));

    const res = await fetch('/api/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, total, method })
    });

    const result = await res.json();
    if (result.saleId) {
        alert('Sale Complete!');
        cart = []; // Clear cart
        renderCart();
        window.print(); // Triggers browser print dialog for the bill
    }
}
async function processSale() {
    const method = document.getElementById('payment-method').value;
    const total = parseFloat(document.getElementById('grand-total').innerText.replace('LKR ', ''));

    if (cart.length === 0) return alert("Cart is empty!");

    // 1. Save to DB
    const res = await fetch('/api/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, total, method })
    });

    const result = await res.json();

    if (result.saleId) {
        // 2. PREPARE RECEIPT DATA
        document.getElementById('rec-bill-no').innerText = result.saleId;
        document.getElementById('rec-date').innerText = new Date().toLocaleString();
        document.getElementById('rec-total').innerText = `LKR ${total.toFixed(2)}`;

        const recItemsBody = document.getElementById('rec-items');
        recItemsBody.innerHTML = '';

        cart.forEach(item => {
            recItemsBody.innerHTML += `
                <tr>
                    <td class="text-left">${item.name}</td>
                    <td>${item.buyQty}</td>
                    <td class="text-right">${(item.price * item.buyQty).toFixed(2)}</td>
                </tr>
            `;
        });

        // 3. PRINT
        // The CSS @media print will handle showing ONLY the receipt div
        window.print();

        // 4. Cleanup
        cart = [];
        renderCart();
    }
}