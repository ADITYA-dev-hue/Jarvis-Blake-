/**
 * JARVIS Mobile Controller - Client Logic
 * Handles real-time Socket.IO communication with the relay server.
 */

(() => {
  // DOM Elements
  const serverStatusBadge = document.getElementById('server-status');
  const agentStatusBadge = document.getElementById('agent-status');
  const agentMetaBox = document.getElementById('agent-meta');
  const agentHostnameSpan = document.getElementById('agent-hostname');
  const agentOsSpan = document.getElementById('agent-os');
  const tokenInput = document.getElementById('token-input');
  const toggleTokenBtn = document.getElementById('toggle-token-btn');
  const reconnectBtn = document.getElementById('reconnect-btn');
  const consoleLogs = document.getElementById('console-logs');
  const clearLogBtn = document.getElementById('clear-log-btn');

  // Command Elements
  const btnStatus = document.getElementById('btn-status');
  const telemetryDisplay = document.getElementById('telemetry-display');
  const metricCpu = document.getElementById('metric-cpu');
  const barCpu = document.getElementById('bar-cpu');
  const metricRam = document.getElementById('metric-ram');
  const barRam = document.getElementById('bar-ram');
  const metricOs = document.getElementById('metric-os');
  const metricUptime = document.getElementById('metric-uptime');
  const metricBattery = document.getElementById('metric-battery');

  const urlInput = document.getElementById('url-input');
  const btnOpenUrl = document.getElementById('btn-open-url');
  const chips = document.querySelectorAll('.chip');

  const folderInput = document.getElementById('folder-input');
  const btnCreateFolder = document.getElementById('btn-create-folder');

  const appButtons = document.querySelectorAll('.hud-btn-app');

  // Load saved token from localStorage if available
  const savedToken = localStorage.getItem('jarvis_auth_token');
  if (savedToken) {
    tokenInput.value = savedToken;
  }

  let socket = null;
  let isAgentOnline = false;

  /**
   * Append a log entry to the activity console
   */
  function appendLog(type, message, details = null) {
    const timeStr = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;

    let content = `<span class="log-time">[${timeStr}]</span> ${escapeHtml(message)}`;
    if (details) {
      content += `<br><span style="opacity: 0.8; font-size: 0.72rem; padding-left: 12px;">${escapeHtml(JSON.stringify(details))}</span>`;
    }

    entry.innerHTML = content;
    consoleLogs.prepend(entry);
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') str = String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Update the Server and Laptop status badges
   */
  function setServerStatus(online, text = null) {
    const dot = serverStatusBadge.querySelector('.status-dot');
    const label = serverStatusBadge.querySelector('.status-label');
    dot.className = `status-dot ${online ? 'online' : 'offline'}`;
    label.textContent = text || (online ? 'Server: Connected' : 'Server: Offline');
  }

  function setAgentStatus(online, info = null) {
    isAgentOnline = online;
    const dot = agentStatusBadge.querySelector('.status-dot');
    const label = agentStatusBadge.querySelector('.status-label');
    dot.className = `status-dot ${online ? 'online' : 'offline'}`;
    label.textContent = online ? 'Laptop: Online' : 'Laptop: Offline';

    if (online && info) {
      agentHostnameSpan.textContent = info.hostname || 'Windows-PC';
      agentOsSpan.textContent = info.os || 'Windows';
      agentMetaBox.style.display = 'flex';
    } else {
      agentMetaBox.style.display = 'none';
    }
  }

  /**
   * Initialize or reconnect Socket.IO
   */
  function initSocket() {
    if (socket) {
      socket.disconnect();
    }

    const token = tokenInput.value.trim();
    localStorage.setItem('jarvis_auth_token', token);

    appendLog('system', `Connecting to JARVIS server...`);

    // Connect to same host & port serving the HTML
    socket = io({
      auth: {
        token: token,
        role: 'client',
        clientInfo: { userAgent: navigator.userAgent }
      },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      setServerStatus(true);
      appendLog('success', `Connected to server (Socket ID: ${socket.id})`);
    });

    socket.on('disconnect', (reason) => {
      setServerStatus(false, 'Server: Disconnected');
      setAgentStatus(false);
      appendLog('warning', `Server disconnected: ${reason}`);
    });

    socket.on('connect_error', (err) => {
      setServerStatus(false, 'Server: Auth Error');
      appendLog('error', `Connection error: ${err.message}`);
    });

    // Received live agent status broadcast
    socket.on('agent_status', (data) => {
      const { online, agentInfo } = data;
      setAgentStatus(online, agentInfo);
      appendLog(online ? 'info' : 'warning', `Laptop Agent is ${online ? 'ONLINE' : 'OFFLINE'}`);
    });

    // Activity log stream broadcasted from server
    socket.on('command_logged', (entry) => {
      const { command, success, error, durationMs } = entry;
      if (success) {
        appendLog('success', `[Agent] '${command}' completed (${durationMs}ms)`);
      } else {
        appendLog('error', `[Agent] '${command}' failed: ${error}`);
      }
    });
  }

  /**
   * Send command over Socket.IO with callback promise
   */
  function sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      if (!socket || !socket.connected) {
        const err = 'Cannot send command: Server is not connected.';
        appendLog('error', err);
        return reject(new Error(err));
      }

      if (!isAgentOnline) {
        const err = 'Laptop agent is offline. Please start agent.py on your laptop.';
        appendLog('warning', err);
        return reject(new Error(err));
      }

      appendLog('info', `Sending '${command}'...`, params);

      socket.emit('send_command', { command, params }, (response) => {
        if (!response) {
          const err = 'No response received from server.';
          appendLog('error', err);
          return reject(new Error(err));
        }

        if (response.success) {
          resolve(response);
        } else {
          appendLog('error', `Error executing '${command}': ${response.error}`);
          reject(new Error(response.error || 'Command failed'));
        }
      });
    });
  }

  // --- UI Event Handlers ---

  // Toggle token input visibility
  toggleTokenBtn.addEventListener('click', () => {
    tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
  });

  // Reconnect button
  reconnectBtn.addEventListener('click', () => {
    initSocket();
  });

  // Clear logs button
  clearLogBtn.addEventListener('click', () => {
    consoleLogs.innerHTML = '';
    appendLog('system', 'Activity log cleared.');
  });

  // Command 1: System Status
  btnStatus.addEventListener('click', async () => {
    btnStatus.disabled = true;
    try {
      const res = await sendCommand('system_status');
      const data = res.data;
      if (data) {
        telemetryDisplay.style.display = 'flex';
        // CPU
        const cpuUsage = data.cpu.usage_percent;
        metricCpu.textContent = `${cpuUsage}% (${data.cpu.logical_cores} Cores)`;
        barCpu.style.width = `${Math.min(cpuUsage, 100)}%`;

        // RAM
        const ram = data.memory;
        metricRam.textContent = `${ram.used} / ${ram.total} (${ram.percent}%)`;
        barRam.style.width = `${Math.min(ram.percent, 100)}%`;

        // Details
        metricOs.textContent = `${data.os.platform} ${data.os.release} (${data.os.machine})`;
        metricUptime.textContent = data.os.uptime || `${data.os.uptime_seconds}s`;
        if (data.battery) {
          metricBattery.textContent = `${data.battery.percent}% (${data.battery.power_plugged ? 'Plugged in' : 'On battery'})`;
        } else {
          metricBattery.textContent = 'Desktop / AC Power';
        }
      }
    } catch (err) {
      // Error already logged
    } finally {
      btnStatus.disabled = false;
    }
  });

  // Command 2: Open URL
  btnOpenUrl.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      appendLog('warning', 'Please enter a URL to open.');
      return;
    }
    try {
      await sendCommand('open_url', { url });
      appendLog('success', `Opened URL in laptop browser: ${url}`);
    } catch (err) {}
  });

  // Quick URL Chips
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      urlInput.value = chip.dataset.url;
    });
  });

  // Command 3: Create Folder
  btnCreateFolder.addEventListener('click', async () => {
    const folderName = folderInput.value.trim();
    if (!folderName) {
      appendLog('warning', 'Please enter a folder name.');
      return;
    }
    try {
      const res = await sendCommand('create_folder', { folder_name: folderName });
      appendLog('success', `Created folder in workspace: ${res.data.relative_path}`);
    } catch (err) {}
  });

  // Command 4: Launch App
  appButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const appName = btn.dataset.app;
      try {
        const res = await sendCommand('open_app', { app_name: appName });
        appendLog('success', `Launched ${res.data.app_label} (PID: ${res.data.pid})`);
      } catch (err) {}
    });
  });

  // Initial connection
  initSocket();
})();
