// 1. Export Database
async function exportDB() {
    window.location.href = '/api/export-db';
}

// 2. Import Database
async function triggerImport() {
    document.getElementById('db-upload').click();
}

// 3. Save Alert Settings
function saveAlertSettings() {
    const lowStock = document.getElementById('set-low-stock').value;
    const expiryDays = document.getElementById('set-expiry-days').value;
    const pendingDays = document.getElementById('set-pending-days').value;

    localStorage.setItem('pref_lowStock', lowStock);
    localStorage.setItem('pref_expiryDays', expiryDays);
    localStorage.setItem('pref_pendingDays', pendingDays);

    alert("Preferences Saved! Dashboard will update.");
}

// --- NEW: Receipt Settings Logic ---

function saveReceiptSettings() {
    const name = document.getElementById('set-rec-name').value;
    const add1 = document.getElementById('set-rec-address1').value;
    const add2 = document.getElementById('set-rec-address2').value;
    const contact = document.getElementById('set-rec-contact').value;
    const footer = document.getElementById('set-rec-footer').value;

    localStorage.setItem('rec_name', name);
    localStorage.setItem('rec_add1', add1);
    localStorage.setItem('rec_add2', add2);
    localStorage.setItem('rec_contact', contact);
    localStorage.setItem('rec_footer', footer);

    alert("Receipt Design Saved!");
    applyReceiptSettings(); // Update the hidden print area immediately
}

function applyReceiptSettings() {
    // Defaults if nothing is saved
    const name = localStorage.getItem('rec_name') || "HIRU PHARMACY & GROCERY";
    const add1 = localStorage.getItem('rec_add1') || "61/A, Biyagama Road, Balummahara";
    const add2 = localStorage.getItem('rec_add2') || "Mudungoda";
    const contact = localStorage.getItem('rec_contact') || "Tel: 070-2682795 | 071-7978277";
    const footer = localStorage.getItem('rec_footer') || "Thank You for your purchase!\nNo Returns on Medicine";

    // Update Print Area
    const printName = document.getElementById('print-shop-name');
    if(printName) {
        printName.innerText = name;
        document.getElementById('print-address-1').innerText = add1;
        document.getElementById('print-address-2').innerText = add2;
        document.getElementById('print-contact').innerText = contact;
        // Handle newlines for footer
        document.getElementById('print-footer-msg').innerHTML = footer.replace(/\n/g, '<br>');
    }

    // Update Settings Inputs (so they show current values when user goes to Settings tab)
    const nameInput = document.getElementById('set-rec-name');
    if(nameInput) {
        nameInput.value = name;
        document.getElementById('set-rec-address1').value = add1;
        document.getElementById('set-rec-address2').value = add2;
        document.getElementById('set-rec-contact').value = contact;
        document.getElementById('set-rec-footer').value = footer;
    }
}

// Load Preferences on Start
document.addEventListener("DOMContentLoaded", () => {
    // Dashboard Prefs
    const lowStock = localStorage.getItem('pref_lowStock') || 10;
    const expiryDays = localStorage.getItem('pref_expiryDays') || 90;
    const pendingDays = localStorage.getItem('pref_pendingDays') || 30;

    const stockInput = document.getElementById('set-low-stock');
    const expiryInput = document.getElementById('set-expiry-days');
    const pendingInput = document.getElementById('set-pending-days');

    if(stockInput) stockInput.value = lowStock;
    if(expiryInput) expiryInput.value = expiryDays;
    if(pendingInput) pendingInput.value = pendingDays;

    // Apply Receipt Prefs
    applyReceiptSettings();
});

// Handle File Selection
document.getElementById('db-upload').addEventListener('change', async function (e) {
    if (this.files.length === 0) return;

    const file = this.files[0];
    const formData = new FormData();
    formData.append('database', file);

    // Visual Feedback
    const btn = document.getElementById('btn-import');
    const originalText = btn.innerText;
    btn.innerText = "Importing...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/import-db', {
            method: 'POST',
            body: formData
        });

        const result = await res.json();

        if (res.ok) {
            btn.innerText = "✔ Success!";
            btn.style.backgroundColor = "#059669";
            btn.style.color = "white";

            setTimeout(() => {
                alert("Database imported successfully! The app will reload.");
                window.location.reload();
            }, 1000);
        } else {
            alert("Error: " + result.error);
            resetBtn();
        }
    } catch (err) {
        console.error(err);
        alert("Network Error during import.");
        resetBtn();
    }

    function resetBtn() {
        btn.innerText = originalText;
        btn.disabled = false;
        btn.style.backgroundColor = "white";
        btn.style.color = "var(--text-main)";
    }

    // Clear input
    this.value = '';
});