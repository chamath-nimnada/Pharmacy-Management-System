let cart = [];
let products = [];

// Load products for search
async function fetchProductsForBilling() {
    try {
        const res = await fetch('/api/products');
        const data = await res.json();
        products = data.data;
    } catch (e) { console.error(e); }
}
fetchProductsForBilling();

// Barcode Listener
const barcodeInput = document.getElementById('barcode-input');
barcodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const val = barcodeInput.value.trim();
        // Try to find by Barcode OR Name
        const product = products.find(p =>
            p.barcode === val ||
            p.name.toLowerCase() === val.toLowerCase()
        );

        if (product) {
            addToCart(product);
            barcodeInput.value = ''; // Clear
        } else {
            alert('Product not found! Check inventory.');
        }
    }
});

function addToCart(product) {
    const existing = cart.find(c => c.id === product.id);
    if (existing) {
        existing.buyQty++;
    } else {
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
        // 2. GENERATE BILL (Populate the hidden Print Area)
        document.getElementById('rec-bill-no').innerText = result.saleId;
        document.getElementById('rec-date').innerText = new Date().toLocaleString();

        const recItemsBody = document.getElementById('rec-items');
        recItemsBody.innerHTML = ''; // Clear previous

        cart.forEach(item => {
            recItemsBody.innerHTML += `
                <tr style="border-bottom: 1px dashed #000;">
                    <td style="padding: 5px 0;">${item.name}</td>
                    <td style="padding: 5px 0; text-align:center;">${item.buyQty}</td>
                    <td style="padding: 5px 0; text-align:right;">${(item.price * item.buyQty).toFixed(2)}</td>
                </tr>
            `;
        });

        document.getElementById('rec-total').innerText = total.toFixed(2);

        // 3. Print
        window.print();

        // 4. Cleanup
        cart = [];
        renderCart();
        loadDashboard(); // Refresh dash
    } else {
        alert("Error processing sale: " + result.error);
    }
}