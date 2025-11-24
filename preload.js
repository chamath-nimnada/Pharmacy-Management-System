const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    addStock: (data) => ipcRenderer.invoke('add-stock', data),
    getInventory: (filter) => ipcRenderer.invoke('get-inventory', filter),
    searchProduct: (query) => ipcRenderer.invoke('search-product', query),
    processSale: (data) => ipcRenderer.invoke('process-sale', data),
    getDashboard: () => ipcRenderer.invoke('get-dashboard-data'),

    // Purchases
    getPurchases: (query) => ipcRenderer.invoke('get-purchases', query),
    addPurchase: (data) => ipcRenderer.invoke('add-purchase', data),
    payPurchase: (id) => ipcRenderer.invoke('pay-purchase', id),

    // Sales History
    getSalesHistory: () => ipcRenderer.invoke('get-sales-history')
});