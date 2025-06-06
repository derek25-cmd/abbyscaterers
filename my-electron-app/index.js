// my-electron-app/index.js
const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Apply a basic Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["script-src 'self' 'unsafe-inline'; object-src 'self'"]
      }
    });
  });

  if (!app.isPackaged) { // Use !app.isPackaged to determine development mode
    // In development, load from the Next.js dev server
    mainWindow.loadURL('http://localhost:9002'); // Ensure this port matches your Next.js dev script
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the static export of your Next.js app
    // Assumes the 'out' folder from Next.js build is copied into the 'app/out' directory during packaging
    const indexPath = path.join(__dirname, 'out/index.html');
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load production path:', indexPath, err);
      // You could show an error page or fallback here
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
