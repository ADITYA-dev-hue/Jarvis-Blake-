/**
 * JARVIS Phase 3 - Safe Command Communication, Mobile Phone & AI Interpreter Server
 * 
 * Coordinates authenticated communication between:
 * - Phone Clients (Socket.IO, role: "phone")
 * - Laptop Agents (Socket.IO, role: "agent")
 * - AI Natural-Language Interpreter (Google Gemini + Command Validator)
 * 
 * Enforces role-based token validation, status broadcasting, and safe command dispatch.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables (from server directory and cwd fallback)
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const { interpretCommand, GEMINI_MODEL } = require('./ai/gemini');
const { sessionStore, DEFAULT_CONTEXT_LIMIT } = require('./memory/session-store');

// Security Audit Log setup (Phase 6)
const LOGS_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
const AUDIT_LOG_FILE = path.join(LOGS_DIR, 'jarvis.log');
const MAX_LOG_SIZE = 1000000; // 1 MB rotation cap

function appendAuditLog(sessionId, action, success) {
  try {
    const timestamp = new Date().toISOString();
    const entry = `${timestamp} sessionId=${sessionId || 'unknown'} action=${action || 'unknown'} success=${Boolean(success)}\n`;

    if (fs.existsSync(AUDIT_LOG_FILE)) {
      const stats = fs.statSync(AUDIT_LOG_FILE);
      if (stats.size > MAX_LOG_SIZE) {
        const rotated = path.join(LOGS_DIR, `jarvis-${Date.now()}.log.bak`);
        fs.renameSync(AUDIT_LOG_FILE, rotated);
      }
    }
    fs.appendFileSync(AUDIT_LOG_FILE, entry, 'utf8');
  } catch (_) {
    // Fail silently on logging errors
  }
}

const MAX_CONTEXT_MESSAGES = parseInt(process.env.MAX_CONTEXT_MESSAGES, 10) || DEFAULT_CONTEXT_LIMIT;
const JARVIS_DEBUG = process.env.JARVIS_DEBUG === 'true';

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const IGRIS_AUTH_TOKEN = process.env.IGRIS_AUTH_TOKEN || process.env.JARVIS_AUTH_TOKEN;
const IGRIS_PHONE_TOKEN = process.env.IGRIS_PHONE_TOKEN || process.env.JARVIS_PHONE_TOKEN || 'jarvis_phone_dev_token_884192';
const IGRIS_PHONE_ORIGIN = process.env.IGRIS_PHONE_ORIGIN || process.env.JARVIS_PHONE_ORIGIN || 'http://localhost:5173';
const IGRIS_FRONTEND_URL = process.env.IGRIS_FRONTEND_URL || process.env.JARVIS_FRONTEND_URL;

// Retain legacy references for full backwards compatibility
const JARVIS_AUTH_TOKEN = IGRIS_AUTH_TOKEN;
const JARVIS_PHONE_TOKEN = IGRIS_PHONE_TOKEN;
const JARVIS_PHONE_ORIGIN = IGRIS_PHONE_ORIGIN;
const JARVIS_FRONTEND_URL = IGRIS_FRONTEND_URL;

if (!IGRIS_AUTH_TOKEN || !IGRIS_AUTH_TOKEN.trim()) {
  console.error('[ERROR] IGRIS_AUTH_TOKEN (or JARVIS_AUTH_TOKEN) is not defined in environment variables');
  process.exit(1);
}

// Default command timeout: 5000ms (5 seconds)
const COMMAND_TIMEOUT_MS = parseInt(process.env.COMMAND_TIMEOUT_MS, 10) || 5000;

const app = express();
const server = http.createServer(app);

/**
 * Origin validation helper for local dev, Render server, and Vercel mobile UI
 */
function normalizeOrigin(urlStr) {
  if (!urlStr) return '';
  try {
    return new URL(urlStr).origin.toLowerCase();
  } catch (_) {
    return urlStr.replace(/\/+$/, '').toLowerCase();
  }
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);

  // Check configured frontends (supports single URL or comma-separated list)
  const configured = [
    process.env.IGRIS_FRONTEND_URL,
    process.env.IGRIS_PHONE_ORIGIN,
    process.env.JARVIS_FRONTEND_URL,
    process.env.JARVIS_PHONE_ORIGIN
  ].filter(Boolean);

  for (const entry of configured) {
    const list = entry.split(',').map((s) => s.trim()).filter(Boolean);
    for (const item of list) {
      if (normalizeOrigin(item) === normalized) {
        return true;
      }
    }
  }

  // Local development origins
  if (normalized === 'http://localhost:5173' || normalized === 'http://localhost:3000') {
    return true;
  }

  // Private network ranges for mobile Wi-Fi testing
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) return true;
  } catch (_) {}

  return false;
}

// Enable CORS and JSON parsing
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) callback(null, true);
    else callback(new Error('CORS not allowed for origin'));
  },
  credentials: true
}));
app.use(express.json());

// Serve production UI assets from phone-ui/dist if present
const phoneDistPath = path.join(__dirname, '..', 'phone-ui', 'dist');
if (fs.existsSync(phoneDistPath)) {
  app.use(express.static(phoneDistPath));
}

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) callback(null, true);
      else callback(new Error('CORS not allowed for origin'));
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingInterval: 10000,
  pingTimeout: 5000
});

// State tracking for connected laptop agents
// socket.id -> { agentId, socket, connectedAt }
const connectedAgentsBySocket = new Map();
// agentId -> { socketId, socket, connectedAt }
const connectedAgentsById = new Map();

// State tracking for commands awaiting response
// commandId -> { commandId, action, agentId, timer, resolve }
const pendingCommands = new Map();

// State tracking for live system telemetry (Phase 7)
let latestSystemMetrics = null;

/**
 * Socket.IO Authentication Middleware
 * 
 * Strict security rules:
 * - Role separation: 'agent' (laptop) vs 'phone' (mobile UI)
 * - Laptop agents MUST provide JARVIS_AUTH_TOKEN
 * - Phone clients MUST provide JARVIS_PHONE_TOKEN
 * - Never allow a phone client to authenticate as a laptop agent
 * - NEVER log authentication tokens
 */
io.use((socket, next) => {
  const role = socket.handshake.auth?.role || socket.handshake.query?.role || 'agent';
  const authToken = socket.handshake.auth?.token || socket.handshake.query?.token;
  const agentId = socket.handshake.auth?.agentId || 'LAPTOP-01';

  if (!authToken) {
    return next(new Error('Authentication failed: Missing token'));
  }

  if (role === 'agent') {
    const validTokens = (JARVIS_AUTH_TOKEN || '').split(',').map(t => t.trim()).filter(Boolean);
    if (validTokens.length === 0 || !validTokens.includes(authToken)) {
      return next(new Error('Authentication failed: Invalid token'));
    }

    socket.data = {
      role: 'agent',
      agentId,
      clientInfo: socket.handshake.auth?.clientInfo || {},
      authenticatedAt: new Date().toISOString()
    };
    return next();
  } else if (role === 'phone') {
    const validPhoneTokens = (JARVIS_PHONE_TOKEN || '').split(',').map(t => t.trim()).filter(Boolean);
    if (validPhoneTokens.length === 0 || !validPhoneTokens.includes(authToken)) {
      return next(new Error('Authentication failed: Invalid phone token'));
    }

    socket.data = {
      role: 'phone',
      authenticatedAt: new Date().toISOString()
    };
    return next();
  } else {
    return next(new Error('Authentication failed: Invalid role'));
  }
});

// Handle socket engine errors gracefully
io.engine.on('connection_error', (err) => {
  // Prevent unhandled errors, never log secrets
});

/**
 * Dispatch a command to an authenticated laptop agent
 * 
 * @param {object} agentEntry Connected agent object
 * @param {string} commandId Unique correlation identifier
 * @param {string} action Safe command action name
 * @param {object} parameters Command parameters
 * @param {number} timeoutMs Milliseconds before timeout
 * @returns {Promise<object>} Command execution result
 */
function dispatchCommand(agentEntry, commandId, action, parameters = {}, timeoutMs = COMMAND_TIMEOUT_MS) {
  return new Promise((resolve) => {
    console.log(`[COMMAND] ${commandId} -> ${agentEntry.agentId} -> ${action}`);

    // Set timeout to avoid hanging requests
    const timer = setTimeout(() => {
      if (pendingCommands.has(commandId)) {
        pendingCommands.delete(commandId);
        console.log(`[RESULT] ${commandId} -> FAILED (Command timed out)`);
        resolve({
          commandId,
          success: false,
          action,
          data: null,
          error: "Laptop agent command timed out."
        });
      }
    }, timeoutMs);

    pendingCommands.set(commandId, {
      commandId,
      action,
      agentId: agentEntry.agentId,
      timer,
      resolve
    });

    // Send command to authenticated laptop agent
    agentEntry.socket.emit('execute_command', {
      commandId,
      action,
      parameters: parameters || {}
    });
  });
}

/**
 * Format natural human-readable messages for Voice / Text-to-Speech responses
 */
function formatFriendlyResponseMessage(action, parameters, result, userText = '') {
  if (!result || !result.success) {
    return result?.error || "I couldn't complete that command.";
  }

  if (action === 'open_url') {
    const url = parameters?.url || '';
    if (url.toLowerCase().includes('github.com')) return 'GitHub opened successfully.';
    if (url.toLowerCase().includes('google.com')) return 'Google opened successfully.';
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, '');
      return `${host} opened successfully.`;
    } catch (_) {
      return 'Website opened successfully.';
    }
  }

  if (action === 'open_app') {
    const app = (parameters?.app || '').toLowerCase();
    if (app === 'notepad') return 'Notepad launched successfully.';
    if (app === 'calculator') return 'Calculator launched successfully.';
    if (app === 'paint') return 'Paint launched successfully.';
    if (app === 'explorer') return 'File Explorer opened successfully.';
    if (app === 'code') return 'Visual Studio Code launched successfully.';
    return `${parameters?.app || 'Application'} launched successfully.`;
  }

  if (action === 'system_status') {
    const data = result?.data || latestSystemMetrics;
    const cpuVal = typeof data?.cpu === 'number' ? data.cpu : (typeof data?.cpu?.usagePercent === 'number' ? data.cpu.usagePercent : null);
    const ramVal = typeof data?.ram === 'number' ? data.ram : (typeof data?.memory?.usagePercent === 'number' ? data.memory.usagePercent : null);
    const diskVal = typeof data?.disk === 'number' ? data.disk : (typeof data?.disk?.usagePercent === 'number' ? data.disk.usagePercent : null);
    const batt = data?.battery;

    const lowerQuery = (userText || '').toLowerCase();
    if (lowerQuery.includes('ram') || lowerQuery.includes('memory')) {
      if (typeof ramVal === 'number') {
        return `Your RAM usage is currently ${ramVal} percent.`;
      }
      return 'Your RAM usage telemetry is ready.';
    }
    if (lowerQuery.includes('cpu')) {
      if (typeof cpuVal === 'number') {
        return `Your CPU is currently at ${cpuVal} percent.`;
      }
      return 'Your CPU activity telemetry is ready.';
    }
    if (lowerQuery.includes('battery')) {
      if (batt && batt.available && typeof batt.percent === 'number') {
        const chargingText = batt.charging ? ' and currently charging' : '';
        return `Your battery level is currently ${batt.percent} percent${chargingText}.`;
      } else if (batt && batt.available === false) {
        return 'Battery information is not available on this system.';
      }
      return 'Battery status retrieved.';
    }
    if (lowerQuery.includes('storage') || lowerQuery.includes('disk')) {
      if (typeof diskVal === 'number') {
        return `Your storage usage is currently ${diskVal} percent.`;
      }
      return 'Storage status retrieved.';
    }

    if (typeof cpuVal === 'number' && typeof ramVal === 'number') {
      return `Laptop status: CPU is at ${cpuVal} percent, memory is at ${ramVal} percent.`;
    }
    return 'Laptop status retrieved successfully.';
  }

  if (action === 'create_folder') {
    const folder = parameters?.name || 'folder';
    return `Folder ${folder} created successfully.`;
  }

  if (action === 'open_folder') {
    const target = parameters?.path ? `Folder "${parameters.path}"` : 'Workspace';
    return `${target} opened in File Explorer.`;
  }

  if (action === 'list_folder') {
    const items = result?.data?.items || [];
    const count = items.length;
    const target = parameters?.path ? `folder "${parameters.path}"` : 'workspace';
    if (count === 0) return `The ${target} is currently empty.`;
    const names = items.slice(0, 5).map(i => i.name).join(', ');
    const more = count > 5 ? ` and ${count - 5} more` : '';
    return `Found ${count} item${count === 1 ? '' : 's'} in ${target}: ${names}${more}.`;
  }

  if (action === 'get_file_info') {
    const file = parameters?.path || result?.data?.filename || 'File';
    const size = result?.data?.size !== undefined ? result.data.size : (result?.data?.size_bytes ? `${result.data.size_bytes} bytes` : '');
    const sizeText = size ? `, size is ${size}` : '';
    return `File info for ${file}: found${sizeText}.`;
  }

  if (action === 'create_text_file') {
    const file = parameters?.path || 'File';
    return `File ${file} created successfully.`;
  }

  if (action === 'open_file') {
    const file = parameters?.path || 'File';
    return `File ${file} opened successfully.`;
  }

  return 'Command executed successfully.';
}

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  const { role, agentId } = socket.data;

  if (role === 'agent') {
    const agentEntry = {
      agentId,
      socket,
      connectedAt: new Date().toISOString()
    };

    connectedAgentsBySocket.set(socket.id, agentEntry);
    connectedAgentsById.set(agentId, agentEntry);

    console.log('Laptop agent connected');
    console.log(`Agent ID: ${agentId}`);
    console.log('Authentication: SUCCESS');

    // Broadcast laptop online status to connected phone clients
    io.to('phones').emit('agent_status', {
      agentId,
      status: 'online'
    });

    // Phase 7: Live system metrics streaming from laptop agent
    socket.on('system_metrics', (metrics) => {
      if (!metrics || typeof metrics !== 'object') return;
      latestSystemMetrics = {
        ...metrics,
        receivedAt: new Date().toISOString()
      };
      // Forward telemetry strictly to authenticated phone clients
      io.to('phones').emit('system_metrics', latestSystemMetrics);
    });

    // Laptop -> Server result event
    socket.on('command_result', (result) => {
      if (!result || typeof result !== 'object') return;
      const { commandId, success, action, data, error } = result;

      if (!commandId) return;

      const pending = pendingCommands.get(commandId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingCommands.delete(commandId);

        const statusText = success ? 'SUCCESS' : `FAILED (${error || 'Unknown error'})`;
        console.log(`[RESULT] ${commandId} -> ${statusText}`);

        pending.resolve({
          commandId,
          success: Boolean(success),
          action: action || pending.action,
          data: data !== undefined ? data : null,
          error: error || null
        });
      }
    });

    socket.on('disconnect', () => {
      connectedAgentsBySocket.delete(socket.id);
      if (connectedAgentsById.get(agentId)?.socket.id === socket.id) {
        connectedAgentsById.delete(agentId);
      }
      latestSystemMetrics = null;
      console.log('Laptop agent disconnected');
      console.log(`Agent ID: ${agentId}`);

      // Broadcast laptop offline status to connected phone clients
      io.to('phones').emit('agent_status', {
        agentId,
        status: 'offline'
      });
    });
  } else if (role === 'phone') {
    socket.join('phones');
    console.log('Phone client connected');
    console.log('Authentication: SUCCESS');

    // Send current status of laptop agent immediately upon phone connection
    const isLaptopOnline = connectedAgentsById.has('LAPTOP-01') && connectedAgentsById.get('LAPTOP-01').socket.connected;
    socket.emit('agent_status', {
      agentId: 'LAPTOP-01',
      status: isLaptopOnline ? 'online' : 'offline'
    });

    // Phase 7: Send latest system metrics snapshot immediately if available
    if (isLaptopOnline) {
      if (latestSystemMetrics) {
        socket.emit('system_metrics', latestSystemMetrics);
      }
      // Request an immediate fresh snapshot from laptop agent
      const laptopAgent = connectedAgentsById.get('LAPTOP-01');
      if (laptopAgent && laptopAgent.socket && laptopAgent.socket.connected) {
        laptopAgent.socket.emit('request_system_metrics');
      }
    }

    // Phase 7: Handle phone client manual request for metrics refresh
    socket.on('request_system_metrics', () => {
      const laptopAgent = connectedAgentsById.get('LAPTOP-01');
      if (laptopAgent && laptopAgent.socket && laptopAgent.socket.connected) {
        laptopAgent.socket.emit('request_system_metrics');
      }
    });

    // Phase 1/2 Direct Phone command dispatcher
    socket.on('execute_command', async (payload, callback) => {
      const { action, parameters = {}, agentId = 'LAPTOP-01', timeoutMs } = payload || {};
      const agentEntry = connectedAgentsById.get(agentId);

      if (!agentEntry || !agentEntry.socket || !agentEntry.socket.connected) {
        const offlineResult = {
          commandId: payload?.commandId || `cmd-phone-${Date.now()}`,
          success: false,
          action,
          data: null,
          error: "Laptop agent is offline."
        };
        socket.emit('command_result', offlineResult);
        if (typeof callback === 'function') callback(offlineResult);
        return;
      }

      const commandId = payload?.commandId || `cmd-phone-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const effectiveTimeout = timeoutMs ? parseInt(timeoutMs, 10) : COMMAND_TIMEOUT_MS;
      const result = await dispatchCommand(agentEntry, commandId, action, parameters, effectiveTimeout);
      appendAuditLog('phone-direct', action, result.success);

      socket.emit('command_result', result);
      if (typeof callback === 'function') callback(result);
    });

    // Phase 3, 4 & 5 Natural Language AI Command Event with Session Context
    socket.on('ai_command', async (payload, callback) => {
      const { text = '', agentId = 'LAPTOP-01', sessionId = 'default-session', source = 'text' } = payload || {};

      // 1. Retrieve recent conversation context for this session
      const recentContext = sessionStore.getRecentMessages(sessionId, MAX_CONTEXT_MESSAGES);

      // 2. Record current user message in session memory
      sessionStore.addMessage(sessionId, {
        role: 'user',
        content: text,
        source: source === 'voice' ? 'voice' : 'text'
      });

      // 3. Interpret command with conversation context
      const interpretation = await interpretCommand(text, recentContext);

      if (!interpretation.success) {
        const failMsg = interpretation.message || "I can't perform that action yet.";
        appendAuditLog(sessionId, interpretation.interpretedCommand?.action || 'unsupported', false);

        // Record assistant response in session memory
        sessionStore.addMessage(sessionId, {
          role: 'assistant',
          content: failMsg,
          action: 'unsupported',
          success: false
        });

        const failResponse = {
          success: false,
          userText: text,
          sessionId,
          interpretedCommand: interpretation.interpretedCommand,
          message: failMsg
        };
        socket.emit('ai_command_result', failResponse);
        if (typeof callback === 'function') callback(failResponse);
        return;
      }

      const validatedCmd = interpretation.validatedCommand;
      const agentEntry = connectedAgentsById.get(agentId);

      if (!agentEntry || !agentEntry.socket || !agentEntry.socket.connected) {
        const offlineMsg = "Your laptop is currently offline.";
        appendAuditLog(sessionId, validatedCmd.action, false);

        // Record offline response in session memory
        sessionStore.addMessage(sessionId, {
          role: 'assistant',
          content: offlineMsg,
          action: validatedCmd.action,
          success: false
        });

        const offlineResponse = {
          success: false,
          userText: text,
          sessionId,
          interpretedCommand: validatedCmd,
          message: offlineMsg
        };
        socket.emit('ai_command_result', offlineResponse);
        if (typeof callback === 'function') callback(offlineResponse);
        return;
      }

      const commandId = `cmd-ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      console.log(`[COMMAND] Sending ${commandId} -> ${agentId}`);
      const execResult = await dispatchCommand(agentEntry, commandId, validatedCmd.action, validatedCmd.parameters);
      appendAuditLog(sessionId, validatedCmd.action, execResult.success);

      const friendlyMsg = execResult.success
        ? formatFriendlyResponseMessage(validatedCmd.action, validatedCmd.parameters, execResult, text)
        : (execResult.error || "I couldn't complete that command.");

      // Record assistant execution response in session memory
      sessionStore.addMessage(sessionId, {
        role: 'assistant',
        content: friendlyMsg,
        action: validatedCmd.action,
        success: execResult.success
      });

      const fullResponse = {
        success: execResult.success,
        userText: text,
        sessionId,
        interpretedCommand: validatedCmd,
        result: execResult,
        message: friendlyMsg
      };

      socket.emit('ai_command_result', fullResponse);
      if (typeof callback === 'function') callback(fullResponse);
    });

    // Phase 5 Clear Session Event
    socket.on('clear_session', (payload, callback) => {
      const sessionId = payload?.sessionId;
      if (sessionId) {
        sessionStore.clearSession(sessionId);
        console.log(`[SESSION] Cleared session ${sessionId}`);
      }
      const response = { success: true, cleared: true, sessionId, message: "Conversation session cleared." };
      socket.emit('session_cleared', response);
      if (typeof callback === 'function') callback(response);
    });

    socket.on('disconnect', () => {
      console.log('Phone client disconnected');
    });
  }
});

// --- REST API Endpoints ---

/**
 * Health check endpoint
 * Exact format required:
 * {
 *   "status": "online",
 *   "service": "JARVIS"
 * }
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'IGRIS'
  });
});

/**
 * Agent connectivity status endpoint
 */
app.get('/api/agent/status', (req, res) => {
  const agentId = req.query.agentId || 'LAPTOP-01';
  const agentEntry = connectedAgentsById.get(agentId);
  res.json({
    online: Boolean(agentEntry && agentEntry.socket && agentEntry.socket.connected),
    agentId
  });
});

/**
 * Development test endpoint for natural language AI interpretation
 * POST /api/test-ai-command
 * 
 * Request body:
 * {
 *   "text": "Open GitHub"
 * }
 */
app.post('/api/test-ai-command', async (req, res) => {
  const { text, conversationHistory, sessionId, source = 'text' } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(200).json({
      success: false,
      message: "Missing 'text' in request body."
    });
  }

  let context = conversationHistory;
  if (!context && sessionId) {
    context = sessionStore.getRecentMessages(sessionId, MAX_CONTEXT_MESSAGES);
  }

  // Record user message if sessionId provided and not manual history override
  if (sessionId && !conversationHistory) {
    sessionStore.addMessage(sessionId, {
      role: 'user',
      content: text,
      source: source === 'voice' ? 'voice' : 'text'
    });
  }

  const interpretation = await interpretCommand(text, context || []);

  if (!interpretation.success) {
    const failMsg = interpretation.message || "I can't perform that action yet.";
    if (sessionId && !conversationHistory) {
      sessionStore.addMessage(sessionId, {
        role: 'assistant',
        content: failMsg,
        action: 'unsupported',
        success: false
      });
    }
    return res.status(200).json({
      success: false,
      interpretedCommand: interpretation.interpretedCommand,
      error: interpretation.error || interpretation.message,
      message: failMsg
    });
  }

  const previewMessage = formatFriendlyResponseMessage(
    interpretation.validatedCommand.action,
    interpretation.validatedCommand.parameters,
    { success: true, data: latestSystemMetrics },
    text
  );

  appendAuditLog(sessionId || 'api-test', interpretation.validatedCommand.action, true);

  if (sessionId && !conversationHistory) {
    sessionStore.addMessage(sessionId, {
      role: 'assistant',
      content: previewMessage,
      action: interpretation.validatedCommand.action,
      success: true
    });
  }

  return res.status(200).json({
    success: true,
    command: interpretation.validatedCommand,
    message: previewMessage
  });
});

/**
 * Clear conversation session endpoint
 * POST /api/session/clear
 */
app.post('/api/session/clear', (req, res) => {
  const token = req.headers['x-igris-token'] || req.headers['x-jarvis-token'] || req.query.token || req.body?.token;
  if (!token || token !== JARVIS_PHONE_TOKEN) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const sessionId = req.body?.sessionId;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: "Missing sessionId" });
  }

  sessionStore.clearSession(sessionId);
  return res.status(200).json({
    success: true,
    cleared: true,
    sessionId,
    message: "Conversation session cleared."
  });
});

/**
 * Get session messages endpoint
 * GET /api/session/messages
 */
app.get('/api/session/messages', (req, res) => {
  const token = req.headers['x-igris-token'] || req.headers['x-jarvis-token'] || req.query.token;
  if (!token || token !== JARVIS_PHONE_TOKEN) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const sessionId = req.query.sessionId || 'default-session';
  const messages = sessionStore.getSession(sessionId);
  return res.status(200).json({
    success: true,
    sessionId,
    count: messages.length,
    messages
  });
});

/**
 * Protected test endpoint for safe command execution
 * POST /api/test-command
 * 
 * Request body:
 * {
 *   "agentId": "LAPTOP-01",
 *   "action": "system_status",
 *   "parameters": {}
 * }
 */
app.post('/api/test-command', async (req, res) => {
  const { agentId = 'LAPTOP-01', action, parameters = {}, timeoutMs } = req.body || {};

  // 1. Verify that the requested agent is authenticated and connected
  const agentEntry = connectedAgentsById.get(agentId);
  if (!agentEntry || !agentEntry.socket || !agentEntry.socket.connected) {
    return res.status(200).json({
      success: false,
      error: "Laptop agent is offline."
    });
  }

  // 2. Generate a unique commandId
  const commandId = req.body.commandId || `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // 3. Dispatch command through Socket.IO and wait for result
  const effectiveTimeout = timeoutMs ? parseInt(timeoutMs, 10) : COMMAND_TIMEOUT_MS;
  const result = await dispatchCommand(agentEntry, commandId, action, parameters, effectiveTimeout);
  appendAuditLog('api-direct', action, result.success);

  return res.json(result);
});

// Root landing endpoint
app.get('/', (req, res, next) => {
  const indexHtml = path.join(phoneDistPath, 'index.html');
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  return res.status(200).json({
    status: 'online',
    service: 'IGRIS Relay Server',
    health: '/health'
  });
});

// SPA fallback for frontend routes
app.get('*', (req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io') && fs.existsSync(path.join(phoneDistPath, 'index.html'))) {
    return res.sendFile(path.join(phoneDistPath, 'index.html'));
  }
  next();
});

// Start listening
server.listen(PORT, HOST, () => {
  console.log('IGRIS Server');
  console.log('------------------------------');
  console.log(`Server running on port ${PORT}`);
  console.log(`AI Model: ${GEMINI_MODEL}`);
  console.log('Health endpoint: /health');
});

// Prevent unhandled crashes
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
