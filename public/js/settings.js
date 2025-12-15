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

// Load Preferences on Start
document.addEventListener("DOMContentLoaded", () => {
    const lowStock = localStorage.getItem('pref_lowStock') || 10;
    const expiryDays = localStorage.getItem('pref_expiryDays') || 90;
    const pendingDays = localStorage.getItem('pref_pendingDays') || 30;

    const stockInput = document.getElementById('set-low-stock');
    const expiryInput = document.getElementById('set-expiry-days');
    const pendingInput = document.getElementById('set-pending-days');

    if(stockInput) stockInput.value = lowStock;
    if(expiryInput) expiryInput.value = expiryDays;
    if(pendingInput) pendingInput.value = pendingDays;
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