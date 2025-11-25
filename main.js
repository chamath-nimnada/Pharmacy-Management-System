const { app, BrowserWindow } = require('electron');
const path = require('path');
const server = require('./server/server'); // Starts the Express server

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "Pharmacy Management System",
        webPreferences: {
            nodeIntegration: false, // Security best practice
            contextIsolation: true
        }
    });

    // Load the Express App
    win.loadURL('http://localhost:3000');

    // Uncomment next line to open DevTools for debugging
    // win.webContents.openDevTools();
}

app.whenReady().then(() => {
    // Start Server
    const expressApp = server.listen(3000, () => {
        console.log('Electron: Express server started on port 3000');
        createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});