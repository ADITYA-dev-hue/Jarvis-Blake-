const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const PRODUCTION_PHONE_TOKEN = 'JRUCJfoOgIDElEnUfzrC37tXFxe0lZ94Z_srWC_7RP0';
const DEV_PHONE_TOKEN = 'jarvis_phone_dev_token_884192';

function getAuthToken(serverUrl) {
  // 1. Check process environment first
  if (process.env.IGRIS_PHONE_TOKEN) return process.env.IGRIS_PHONE_TOKEN;
  if (process.env.JARVIS_PHONE_TOKEN) return process.env.JARVIS_PHONE_TOKEN;

  // Helper to safely read token from an env file without exposing contents
  const readKeyFromEnv = (filePath, keys) => {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const line of content.split('\n')) {
          for (const key of keys) {
            const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`));
            if (match) {
              return match[1].trim().replace(/^['"]|['"]$/g, '');
            }
          }
        }
      } catch (_) {}
    }
    return null;
  };

  // 2. Try reading from desktop-companion local .env
  const localEnvToken = readKeyFromEnv(path.resolve(__dirname, '.env'), ['IGRIS_PHONE_TOKEN', 'JARVIS_PHONE_TOKEN']);
  if (localEnvToken) return localEnvToken;

  // 3. Try reading from workspace root .env securely if exists
  const envPath = path.resolve(__dirname, '..', '.env');
  const workspaceToken = readKeyFromEnv(envPath, ['IGRIS_PHONE_TOKEN', 'JARVIS_PHONE_TOKEN']);
  if (workspaceToken) return workspaceToken;

  // 4. Try reading from phone-ui .env securely if exists
  const phoneUiEnvPath = path.resolve(__dirname, '..', 'phone-ui', '.env');
  const phoneUiToken = readKeyFromEnv(phoneUiEnvPath, ['VITE_IGRIS_PHONE_TOKEN', 'VITE_JARVIS_PHONE_TOKEN', 'IGRIS_PHONE_TOKEN']);
  if (phoneUiToken) return phoneUiToken;

  // 5. If serverUrl is explicitly localhost, use dev token
  if (serverUrl && (serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1'))) {
    return DEV_PHONE_TOKEN;
  }

  // 6. Default production token configured on Render server
  return PRODUCTION_PHONE_TOKEN;
}

class CompanionSocketClient {
  constructor(serverUrl, onEventCallback) {
    this.serverUrl = serverUrl || 'https://jarvis-blake.onrender.com';
    this.onEvent = onEventCallback || (() => {});
    this.socket = null;
    this.token = getAuthToken(this.serverUrl);
    this.connected = false;
    this.agentOnline = false;
    this.isExplicitlyClosed = false;
  }

  connect() {
    this.isExplicitlyClosed = false;

    // Ensure exactly ONE Socket.IO connection instance is created
    if (this.socket) {
      if (!this.socket.connected) {
        console.log(`[IGRIS DESKTOP] Connecting to: ${this.serverUrl}`);
        this.onEvent('connection-state', { state: 'connecting' });
        this.socket.connect();
      }
      return;
    }

    console.log(`[IGRIS DESKTOP] Connecting to: ${this.serverUrl}`);
    this.onEvent('connection-state', { state: 'connecting' });

    this.socket = io(this.serverUrl, {
      path: '/socket.io/',
      auth: {
        token: this.token,
        role: 'phone'
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[IGRIS DESKTOP] Socket connected');
      this.onEvent('connection-state', { state: 'online' });
      this.onEvent('state-update', { state: 'idle', message: 'Connected to IGRIS server.' });
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.log(`[IGRIS DESKTOP] Socket disconnected: ${reason}`);
      this.onEvent('connection-state', { state: 'offline', reason });
      this.onEvent('state-update', { state: 'offline', message: `Disconnected: ${reason}` });
    });

    this.socket.on('connect_error', (err) => {
      this.connected = false;
      const safeErrorMsg = err && err.message ? err.message : 'Unknown connection error';
      console.log(`[IGRIS DESKTOP] Socket connect_error: ${safeErrorMsg}`);
      this.onEvent('connection-state', { state: 'offline', error: safeErrorMsg });
      this.onEvent('state-update', { state: 'offline', message: `Connection error: ${safeErrorMsg}` });
    });

    this.socket.io.on('reconnect_attempt', () => {
      this.onEvent('connection-state', { state: 'connecting' });
    });

    this.socket.on('agent_status', (data) => {
      if (data && data.status) {
        this.agentOnline = (data.status === 'online');
        this.onEvent('agent-status', data);
        if (!this.agentOnline) {
          this.onEvent('state-update', { state: 'idle', message: 'Laptop agent offline.' });
        } else if (this.connected) {
          this.onEvent('state-update', { state: 'idle', message: 'Laptop agent online.' });
        }
      }
    });

    this.socket.on('task_progress', (data) => {
      this.onEvent('task-progress', data);
      this.onEvent('state-update', { 
        state: 'executing', 
        message: data.currentStep ? `Executing: ${data.currentStep}` : 'Executing task...' 
      });
    });

    this.socket.on('task_step_completed', (data) => {
      this.onEvent('task-progress', data);
    });

    this.socket.on('task_completed', (data) => {
      this.onEvent('state-update', { 
        state: 'success', 
        message: data.summary || 'Task completed successfully.' 
      });
    });

    this.socket.on('task_failed', (data) => {
      this.onEvent('state-update', { 
        state: 'error', 
        message: data.error || 'Task execution failed.' 
      });
    });
  }

  sendAiCommand(userText) {
    return new Promise((resolve) => {
      if (!this.socket || !this.connected) {
        resolve({
          success: false,
          error: 'Companion is offline. Please check IGRIS server connection.'
        });
        return;
      }

      this.onEvent('state-update', { state: 'thinking', message: 'Processing command...' });

      this.socket.emit('ai_command', {
        text: userText,
        source: 'desktop-companion',
        sessionId: 'desktop-companion-session',
        language: 'en'
      }, (res) => {
        if (res && res.success) {
          const spokenText = res.message || 'Task completed.';
          this.onEvent('state-update', { 
            state: 'speaking', 
            message: spokenText,
            ttsText: spokenText 
          });
          resolve(res);
        } else {
          this.onEvent('state-update', { 
            state: 'error', 
            message: (res && res.error) ? res.error : 'Command could not be completed.' 
          });
          resolve(res || { success: false, error: 'Unknown response' });
        }
      });
    });
  }

  disconnect() {
    this.isExplicitlyClosed = true;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

module.exports = {
  CompanionSocketClient,
  getAuthToken
};
