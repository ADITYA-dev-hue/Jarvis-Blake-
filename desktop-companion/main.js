const { app, BrowserWindow, Tray, Menu, screen, ipcMain, shell } = require('electron');
const path = require('path');
const { SettingsStore } = require('./settings-store');
const { CompanionSocketClient } = require('./socket-client');

let mainWindow = null;
let tray = null;
let settingsStore = null;
let socketClient = null;

function createWindow() {
  settingsStore = new SettingsStore();
  const settings = settingsStore.getAll();
  const dims = settingsStore.getSizeDimensions(settings.size);

  let initialBounds;
  if (settings.rememberPosition && settings.bounds) {
    initialBounds = settingsStore.validateBounds(settings.bounds);
  } else {
    initialBounds = settingsStore.getDefaultPosition(settings.size);
  }

  mainWindow = new BrowserWindow({
    width: dims.width,
    height: dims.height,
    x: initialBounds.x,
    y: initialBounds.y,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    alwaysOnTop: settings.alwaysOnTop !== false,
    skipTaskbar: false,
    icon: path.join(__dirname, 'assets', 'igris', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.setOpacity(Math.max(0.2, (settings.opacity || 100) / 100));
  mainWindow.loadFile('index.html');

  // Save position when moved
  mainWindow.on('moved', () => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    settingsStore.save({ bounds });
  });

  // Handle close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Multi-monitor change listener
  screen.on('display-metrics-changed', () => {
    if (!mainWindow) return;
    const currentBounds = mainWindow.getBounds();
    const validated = settingsStore.validateBounds(currentBounds);
    if (validated.x !== currentBounds.x || validated.y !== currentBounds.y) {
      mainWindow.setBounds(validated);
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'igris', 'icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('IGRIS — 2.5D Desktop AI Companion');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open IGRIS Companion',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'Voice Command',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('companion:voice-trigger', { state: 'listening' });
        }
      }
    },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('companion:voice-trigger', { openSettings: true });
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Restart Connection',
      click: () => {
        if (socketClient) {
          socketClient.connect();
        }
      }
    },
    {
      label: 'Exit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function initSocketConnection() {
  const settings = settingsStore.getAll();
  socketClient = new CompanionSocketClient(settings.serverUrl, (eventType, data) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    if (eventType === 'state-update') {
      mainWindow.webContents.send('companion:state-update', data);
    } else if (eventType === 'task-progress') {
      mainWindow.webContents.send('companion:task-progress', data);
    } else if (eventType === 'agent-status') {
      mainWindow.webContents.send('companion:agent-status', data);
    }
  });

  socketClient.connect();
}

function registerIpcHandlers() {
  ipcMain.handle('companion:get-settings', () => {
    return settingsStore.getAll();
  });

  ipcMain.handle('companion:save-settings', (event, newSettings) => {
    const success = settingsStore.save(newSettings);
    
    // Apply changes if needed
    if (newSettings.alwaysOnTop !== undefined && mainWindow) {
      mainWindow.setAlwaysOnTop(newSettings.alwaysOnTop);
    }
    if (newSettings.opacity !== undefined && mainWindow) {
      mainWindow.setOpacity(Math.max(0.2, newSettings.opacity / 100));
    }
    if (newSettings.size !== undefined && mainWindow) {
      const dims = settingsStore.getSizeDimensions(newSettings.size);
      mainWindow.setSize(dims.width, dims.height);
    }
    if (newSettings.startWithWindows !== undefined) {
      try {
        app.setLoginItemSettings({
          openAtLogin: !!newSettings.startWithWindows,
          path: process.execPath
        });
      } catch (_) {}
    }
    return success;
  });

  ipcMain.handle('companion:set-size', (event, sizeKey) => {
    if (!mainWindow) return false;
    const dims = settingsStore.getSizeDimensions(sizeKey);
    mainWindow.setSize(dims.width, dims.height);
    settingsStore.save({ size: sizeKey });
    return true;
  });

  ipcMain.handle('companion:set-opacity', (event, opacityVal) => {
    if (!mainWindow) return false;
    const alpha = Math.max(0.2, opacityVal / 100);
    mainWindow.setOpacity(alpha);
    settingsStore.save({ opacity: opacityVal });
    return true;
  });

  ipcMain.handle('companion:set-always-on-top', (event, val) => {
    if (!mainWindow) return false;
    mainWindow.setAlwaysOnTop(val);
    settingsStore.save({ alwaysOnTop: val });
    return true;
  });

  ipcMain.handle('companion:minimize', () => {
    if (mainWindow) mainWindow.minimize();
    return true;
  });

  ipcMain.handle('companion:close', () => {
    if (mainWindow) mainWindow.hide();
    return true;
  });

  ipcMain.handle('companion:send-ai-command', async (event, commandText) => {
    if (!socketClient) return { success: false, error: 'Socket client not initialized.' };
    return await socketClient.sendAiCommand(commandText);
  });

  ipcMain.handle('companion:restart-connection', () => {
    if (socketClient) {
      socketClient.connect();
      return true;
    }
    return false;
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();
    registerIpcHandlers();
    initSocketConnection();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    // Keep app running in system tray on Windows
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
    if (socketClient) socketClient.disconnect();
  });
}
