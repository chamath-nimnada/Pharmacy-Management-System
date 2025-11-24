const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    addStock: (data) => ipcRenderer.invoke('add-stock', data),
    getInventory: (filter) => ipcRenderer.invoke('get-inventory', filter),
    searchProduct: (query) => ipcRenderer.invoke('search-product', query),
    processSale: (data) => ipcRenderer.invoke('process-sale', data),
    getDashboard: () => ipcRenderer.invoke('get-dashboard-data'),
    addPurchase: (data) => ipcRenderer.invoke('add-purchase', data)
});