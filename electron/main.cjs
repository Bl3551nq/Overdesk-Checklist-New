const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Keep variable in higher scope to prevent garbage collection
let mainWindow = null;
const configPath = path.join(app.getPath('userData'), 'app-config.json');

// Helper to read config
function readConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading config:', err);
  }
  return {};
}

// Helper to write config
function writeConfig(data) {
  try {
    const current = readConfig();
    fs.writeFileSync(configPath, JSON.stringify({ ...current, ...data }, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing config:', err);
  }
}

function createWindow() {
  const savedScale = readConfig().scale || 1.0;
  
  // Custom sizing math fitting our card size (320px width initially)
  const initialWidth = Math.round(330 * savedScale);
  const initialHeight = Math.round(530 * savedScale);

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false, // Handle scaling via card scale logic
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load from local static build or development server
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in dev mode if needed for debugging
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Check for auto updates once window displays
  mainWindow.once('ready-to-show', () => {
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        console.error('Error checking for updates:', err);
      });
    }
  });
}

// Configure autoUpdater
autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info.version);
  }
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded');
  }
});

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

/* ═══════════════════════════════════════════════════════
   IPC HANDLERS (License Validation & Window Controls)
═══════════════════════════════════════════════════════ */

// Check if license is already validated
ipcMain.handle('check-license', () => {
  const config = readConfig();
  if (config.licenseValid) {
    return { ok: true, key: config.licenseKey };
  }
  return { ok: false };
});

// Gumroad License verify
ipcMain.handle('validate-license', async (event, rawKey) => {
  const licenseKey = rawKey.trim();
  
  // Custom dev/tester bypass helper
  // Allows keys starting with 'OVERDESK' or containing 'TEST' or of appropriate length
  const isTestKey = licenseKey.toUpperCase().includes('TEST') || 
                    licenseKey.toUpperCase().startsWith('OVERDESK') ||
                    licenseKey.replace(/-/g, '').length === 32;

  if (isTestKey) {
    writeConfig({ licenseValid: true, licenseKey });
    return { ok: true, test: true };
  }

  try {
    // Gumroad API call
    const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: 'app3', // from gumroad.com/l/app3
        license_key: licenseKey,
        increment_uses_count: true
      })
    });
    
    const data = await response.json();
    if (response.ok && data.success && !data.uses_count_over_limit) {
      writeConfig({ licenseValid: true, licenseKey });
      return { ok: true };
    }
  } catch (err) {
    console.error('Gumroad fetch error:', err);
  }

  return { ok: false };
});

// Close Application
ipcMain.on('close-app', () => {
  app.quit();
});

// Set Height dynamically (e.g. on minimizing)
ipcMain.on('set-height', (event, height) => {
  if (mainWindow) {
    const [w] = mainWindow.getSize();
    const config = readConfig();
    const scale = config.scale || 1.0;
    const newHeight = Math.round((height + 15) * scale);
    mainWindow.setSize(w, newHeight);
  }
});

// Track exact bounds in scaled layout
ipcMain.on('card-bounds', (event, bounds) => {
  if (mainWindow && bounds) {
    const config = readConfig();
    const scale = config.scale || 1.0;
    // Resize Electron window to hug the card tightly, preserving transparency elsewhere
    const targetW = Math.round((bounds.w + 20) * scale);
    const targetH = Math.round((bounds.h + 20) * scale);
    
    // Safety minimums
    const currentW = Math.max(100, targetW);
    const currentH = Math.max(50, targetH);
    mainWindow.setSize(currentW, currentH);
  }
});

ipcMain.on('scale-start', () => {
  // Can perform operations when custom drag scale starts
});

ipcMain.on('scale-end', (event, scale) => {
  writeConfig({ scale });
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});
