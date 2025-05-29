// my-electron-app/index.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200, // Increased width for a more typical desktop app feel
    height: 800, // Increased height
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true, // Be cautious with nodeIntegration and consider a preload script
      contextIsolation: false, // Be cautious with contextIsolation and consider a preload script
    },
  });

  // Load your Next.js application
  if (isDev) {
    // In development, load from the Next.js dev server
    // Ensure your Next.js dev server is running on this port (from root package.json "dev" script)
    mainWindow.loadURL('http://localhost:9002');
    // Open the DevTools automatically if in development
    mainWindow.webContents.openDevTools();
  } else {
    // In a production build, you would load the output of `next build && next export`
    // For example: mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
    // This setup requires `next export` to generate static files.
    // For now, as a fallback or if `next export` is not configured,
    // you might still point to a running server or handle this differently.
    // Let's point to the same URL for simplicity in this step, assuming a server will handle it.
    // Or, if you package Next.js differently (without static export), the path would change.
    
    // Placeholder for production:
    // mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
    // For this initial setup, we'll make it try the dev URL even if not isDev,
    // or you can implement a proper production loading strategy here.
    mainWindow.loadURL('http://localhost:9002');
    // Consider what to load if isDev is false. If you `next export` to an `out` directory:
    // const prodPath = path.join(__dirname, '../out/index.html');
    // mainWindow.loadFile(prodPath).catch(err => {
    //   console.error('Failed to load production path:', prodPath, err);
    //   // Fallback or error handling
    // });
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
