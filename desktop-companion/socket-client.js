const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

function getAuthToken() {
  // Check process environment first
  if (process.env.IGRIS_PHONE_TOKEN) return process.env.IGRIS_PHONE_TOKEN;
  if (process.env.JARVIS_PHONE_TOKEN) return process.env.JARVIS_PHONE_TOKEN;
  if (process.env.JARVIS_AUTH_TOKEN) return process.env.JARVIS_AUTH_TOKEN;

  // Try reading from workspace .env securely if exists
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*(IGRIS_PHONE_TOKEN|JARVIS_PHONE_TOKEN|JARVIS_AUTH_TOKEN)\s*=\s*(.+?)\s*$/);
        if (match) {
          return match[2].trim().replace(/^['"]|['"]$/g, '');
        }
      }
    } catch (_) {}
  }
  return 'jarvis-phone-secret-2026';
}

class CompanionSocketClient {
  constructor(serverUrl, onEventCallback) {
    this.serverUrl = serverUrl || 'http://localhost:3000';
    this.onEvent = onEventCallback || (() => {});
    this.socket = null;
    this.token = getAuthToken();
    this.connected = false;
    this.agentOnline = false;
  }

  connect() {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(this.serverUrl, {
      auth: {
        token: this.token,
        role: 'phone'
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.onEvent('state-update', { state: 'idle', message: 'Connected to IGRIS server.' });
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      this.onEvent('state-update', { state: 'offline', message: `Disconnected: ${reason}` });
    });

    this.socket.on('connect_error', (err) => {
      this.connected = false;
      this.onEvent('state-update', { state: 'offline', message: `Connection error: ${err.message}` });
    });

    this.socket.on('agent_status', (data) => {
      if (data && data.status) {
        this.agentOnline = (data.status === 'online');
        this.onEvent('agent-status', data);
        if (!this.agentOnline) {
          this.onEvent('state-update', { state: 'offline', message: 'Laptop agent offline.' });
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
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

module.exports = {
  CompanionSocketClient
};
