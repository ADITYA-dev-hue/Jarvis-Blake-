const fs = require('fs');
const path = require('path');
const { app, screen } = require('electron');

const SETTINGS_FILE_NAME = 'igris-companion-settings.json';

const DEFAULT_SETTINGS = {
  companionEnabled: true,
  alwaysOnTop: true,
  startWithWindows: false,
  size: 'medium', // 'small' | 'medium' | 'large'
  opacity: 100, // 20 to 100
  animationEnabled: true,
  rememberPosition: true,
  bounds: null, // { x, y, width, height }
  serverUrl: process.env.IGRIS_SERVER_URL || process.env.JARVIS_SERVER_URL || 'http://localhost:3000',
  voiceEnabled: true,
  handsFreeEnabled: true,
  wakeWord: 'igris',
  conversationMode: false
};

const SIZE_PRESETS = {
  small: { width: 160, height: 260 },
  medium: { width: 240, height: 380 },
  large: { width: 320, height: 500 }
};

class SettingsStore {
  constructor() {
    this.userDataPath = app ? app.getPath('userData') : path.join(__dirname, '.data');
    this.filePath = path.join(this.userDataPath, SETTINGS_FILE_NAME);
    this.settings = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (err) {
      console.warn('[SettingsStore] Failed to load settings, using defaults:', err.message);
    }
    return { ...DEFAULT_SETTINGS };
  }

  save(newSettings = {}) {
    try {
      this.settings = { ...this.settings, ...newSettings };
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('[SettingsStore] Failed to save settings:', err.message);
      return false;
    }
  }

  get(key) {
    return this.settings[key];
  }

  getAll() {
    return { ...this.settings };
  }

  getSizeDimensions(sizeKey) {
    const key = sizeKey || this.settings.size || 'medium';
    return SIZE_PRESETS[key] || SIZE_PRESETS.medium;
  }

  getDefaultPosition(sizeKey) {
    const dims = this.getSizeDimensions(sizeKey);
    const primaryDisplay = screen ? screen.getPrimaryDisplay() : null;
    if (!primaryDisplay) {
      return { x: 100, y: 100, ...dims };
    }
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const marginX = 25;
    const marginY = 35;
    const x = Math.max(0, screenWidth - dims.width - marginX);
    const y = Math.max(0, screenHeight - dims.height - marginY);
    return { x, y, ...dims };
  }

  validateBounds(bounds) {
    if (!bounds || typeof bounds.x !== 'number' || typeof bounds.y !== 'number') {
      return this.getDefaultPosition(this.settings.size);
    }

    if (!screen || !screen.getAllDisplays) {
      if (bounds.x < 0 || bounds.y < 0) {
        return this.getDefaultPosition(this.settings.size);
      }
      return bounds;
    }

    // Multi-monitor safety check: verify bounds intersect with at least one active display
    try {
      const displays = screen.getAllDisplays();
      if (!displays || displays.length === 0) {
        return (bounds.x < 0 || bounds.y < 0) ? this.getDefaultPosition(this.settings.size) : bounds;
      }
      const isVisibleOnAnyDisplay = displays.some(display => {
        const { x, y, width, height } = display.bounds;
        return (
          bounds.x + 50 >= x &&
          bounds.x <= x + width - 50 &&
          bounds.y + 50 >= y &&
          bounds.y <= y + height - 50
        );
      });

      if (!isVisibleOnAnyDisplay) {
        console.warn('[SettingsStore] Saved bounds are off-screen. Resetting to primary display default.');
        return this.getDefaultPosition(this.settings.size);
      }
    } catch (_) {
      if (bounds.x < 0 || bounds.y < 0) return this.getDefaultPosition(this.settings.size);
    }

    return bounds;
  }
}

module.exports = {
  SettingsStore,
  SIZE_PRESETS,
  DEFAULT_SETTINGS
};
