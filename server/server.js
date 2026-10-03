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
const { validateCommand } = require('./ai/command-validator');
const {
  formatMultilingualResponse,
  formatMultilingualError,
  formatConfirmationPrompt,
  detectLanguage
} = require('./ai/language-engine');
const { sessionStore, DEFAULT_CONTEXT_LIMIT } = require('./memory/session-store');

// Phase 9: Safe Task Confirmation Management
// confirmationId -> { confirmationId, validatedCommand, userText, language, sessionId, createdAt, expiresAt }
const pendingConfirmations = new Map();

// Phase 9: Bounded Task Execution History (Zero credentials, bounded to 50 items)
const MAX_TASK_HISTORY = 50;
const taskExecutionHistory = [];

function addTaskHistory(entry) {
  const sanitized = {
    taskId: String(entry.taskId || `task-${Date.now()}`),
    timestamp: entry.timestamp || new Date().toISOString(),
    originalUserRequest: String(entry.originalUserRequest || ''),
    detectedLanguage: String(entry.detectedLanguage || 'en'),
    status: ['completed', 'failed', 'cancelled'].includes(entry.status) ? entry.status : 'completed',
    steps: typeof entry.steps === 'number' ? entry.steps : 0,
    completedSteps: typeof entry.completedSteps === 'number' ? entry.completedSteps : 0,
    failedStep: entry.failedStep !== undefined ? entry.failedStep : null,
    resultSummary: String(entry.resultSummary || '')
  };

  taskExecutionHistory.unshift(sanitized);
  if (taskExecutionHistory.length > MAX_TASK_HISTORY) {
    taskExecutionHistory.pop();
  }
  return sanitized;
}

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

// State tracking for live desktop media playback (Phase 10)
let latestMediaStatus = {
  active: false,
  playbackState: 'stopped',
  mediaType: 'none',
  title: '',
  artist: '',
  album: '',
  source: ''
};

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
function formatFriendlyResponseMessage(action, parameters = {}, result = {}, userText = '', language = 'en') {
  if (!result || !result.success) {
    return result?.error || formatMultilingualError(result?.error, language);
  }
  return formatMultilingualResponse(action, parameters, result, userText, language);
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

    // Phase 8: Live task progress forwarding to phone clients
    socket.on('task_progress', (progress) => {
      if (progress && typeof progress === 'object') {
        io.to('phones').emit('task_progress', progress);
      }
    });

    // Phase 10: Live media playback status streaming from laptop agent
    socket.on('media_status', (media) => {
      if (!media || typeof media !== 'object') return;
      latestMediaStatus = {
        ...media,
        receivedAt: new Date().toISOString()
      };
      // Forward media telemetry strictly to authenticated phone clients
      io.to('phones').emit('media_status', latestMediaStatus);
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
      latestMediaStatus = {
        active: false,
        playbackState: 'stopped',
        mediaType: 'none',
        title: '',
        artist: '',
        album: '',
        source: ''
      };
      console.log('Laptop agent disconnected');
      console.log(`Agent ID: ${agentId}`);

      // Broadcast laptop offline status and cleared media status to connected phone clients
      io.to('phones').emit('agent_status', {
        agentId,
        status: 'offline'
      });
      io.to('phones').emit('media_status', latestMediaStatus);
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

      // Phase 10: Send latest media status snapshot immediately if available
      if (latestMediaStatus) {
        socket.emit('media_status', latestMediaStatus);
      }
      if (laptopAgent && laptopAgent.socket && laptopAgent.socket.connected) {
        laptopAgent.socket.emit('request_media_status');
      }
    }

    // Phase 7: Handle phone client manual request for metrics refresh
    socket.on('request_system_metrics', () => {
      const laptopAgent = connectedAgentsById.get('LAPTOP-01');
      if (laptopAgent && laptopAgent.socket && laptopAgent.socket.connected) {
        laptopAgent.socket.emit('request_system_metrics');
      }
    });

    // Phase 10: Handle phone client manual request for media status refresh
    socket.on('request_media_status', () => {
      const laptopAgent = connectedAgentsById.get('LAPTOP-01');
      if (laptopAgent && laptopAgent.socket && laptopAgent.socket.connected) {
        laptopAgent.socket.emit('request_media_status');
      } else if (latestMediaStatus) {
        socket.emit('media_status', latestMediaStatus);
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

    // Phase 3, 4, 5, 8 & 9 Natural Language AI Command Event with Multilingual & Workflow Planning
    socket.on('ai_command', async (payload, callback) => {
      const {
        text = '',
        agentId = 'LAPTOP-01',
        sessionId = 'default-session',
        source = 'text',
        languagePreference = 'auto'
      } = payload || {};

      // 1. Retrieve recent conversation context for this session
      const recentContext = sessionStore.getRecentMessages(sessionId, MAX_CONTEXT_MESSAGES);

      // 2. Record current user message in session memory
      sessionStore.addMessage(sessionId, {
        role: 'user',
        content: text,
        source: source === 'voice' ? 'voice' : 'text'
      });

      // 3. Interpret command with conversation context & multilingual language engine
      const interpretation = await interpretCommand(text, recentContext, languagePreference);

      // Phase 9 Language Switch Directives
      if (interpretation.isLanguageSwitch) {
        socket.emit('language_changed', {
          language: interpretation.targetLanguage,
          message: interpretation.message
        });

        sessionStore.addMessage(sessionId, {
          role: 'assistant',
          content: interpretation.message,
          action: 'set_language',
          success: true
        });

        const switchResponse = {
          success: true,
          isLanguageSwitch: true,
          userText: text,
          sessionId,
          language: interpretation.targetLanguage,
          message: interpretation.message
        };
        socket.emit('ai_command_result', switchResponse);
        if (typeof callback === 'function') callback(switchResponse);
        return;
      }

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
          language: interpretation.language,
          interpretedCommand: interpretation.interpretedCommand,
          message: failMsg
        };
        socket.emit('ai_command_result', failResponse);
        if (typeof callback === 'function') callback(failResponse);
        return;
      }

      const validatedCmd = interpretation.validatedCommand;

      // Phase 9 Safe Task Confirmation Check
      if (interpretation.requiresConfirmation) {
        const confirmationId = `conf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        pendingConfirmations.set(confirmationId, {
          confirmationId,
          validatedCommand: validatedCmd,
          userText: text,
          language: interpretation.language,
          sessionId,
          createdAt: Date.now(),
          expiresAt: Date.now() + 120000 // 2 minutes
        });

        const confResponse = {
          success: true,
          requiresConfirmation: true,
          confirmationId,
          userText: text,
          sessionId,
          language: interpretation.language,
          interpretedCommand: interpretation.interpretedCommand,
          validatedCommand: validatedCmd,
          taskSummary: {
            steps: validatedCmd.parameters?.steps?.length || 0,
            stepActions: (validatedCmd.parameters?.steps || []).map((s) => s.action)
          },
          message: interpretation.confirmationPrompt || formatConfirmationPrompt(validatedCmd.parameters?.steps?.length || 0, interpretation.language)
        };

        socket.emit('task_confirmation_required', confResponse);
        socket.emit('ai_command_result', confResponse);
        if (typeof callback === 'function') callback(confResponse);
        return;
      }

      const agentEntry = connectedAgentsById.get(agentId);

      if (!agentEntry || !agentEntry.socket || !agentEntry.socket.connected) {
        const offlineMsg = formatMultilingualError('laptop offline', interpretation.language);
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
          language: interpretation.language,
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
        ? formatFriendlyResponseMessage(validatedCmd.action, validatedCmd.parameters, execResult, text, interpretation.language)
        : (execResult.error || formatMultilingualError(execResult.error, interpretation.language));

      // Record in task history if action was task
      if (validatedCmd.action === 'task') {
        addTaskHistory({
          taskId: commandId,
          timestamp: new Date().toISOString(),
          originalUserRequest: text,
          detectedLanguage: interpretation.language,
          status: execResult.success ? 'completed' : 'failed',
          steps: validatedCmd.parameters?.steps?.length || 0,
          completedSteps: execResult.data?.completed_steps || (execResult.success ? validatedCmd.parameters?.steps?.length : 0),
          failedStep: execResult.success ? null : (execResult.data?.completed_steps !== undefined ? execResult.data.completed_steps + 1 : 1),
          resultSummary: friendlyMsg
        });

        socket.emit(execResult.success ? 'task_completed' : 'task_failed', {
          commandId,
          success: execResult.success,
          result: execResult,
          message: friendlyMsg
        });
      }

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
        language: interpretation.language,
        interpretedCommand: validatedCmd,
        result: execResult,
        message: friendlyMsg
      };

      socket.emit('ai_command_result', fullResponse);
      if (typeof callback === 'function') callback(fullResponse);
    });

    // Phase 9 Task Confirm Event
    socket.on('task_confirm', async (payload, callback) => {
      const { confirmationId } = payload || {};
      if (!confirmationId || !pendingConfirmations.has(confirmationId)) {
        const fail = { success: false, error: "Invalid or expired confirmation ID." };
        if (typeof callback === 'function') callback(fail);
        return;
      }
      const pending = pendingConfirmations.get(confirmationId);
      pendingConfirmations.delete(confirmationId);

      if (Date.now() > pending.expiresAt) {
        const exp = { success: false, error: "Confirmation expired." };
        if (typeof callback === 'function') callback(exp);
        return;
      }

      // CRITICAL SECURITY: SERVER RE-VALIDATES BEFORE EXECUTION
      const revalidation = validateCommand(pending.validatedCommand);
      if (!revalidation.valid) {
        const fail = { success: false, error: `Security re-validation failed: ${revalidation.error}` };
        if (typeof callback === 'function') callback(fail);
        return;
      }

      const agentEntry = connectedAgentsById.get('LAPTOP-01');
      if (!agentEntry || !agentEntry.socket || !agentEntry.socket.connected) {
        const offlineMsg = formatMultilingualError('laptop offline', pending.language);
        const fail = { success: false, error: offlineMsg, message: offlineMsg };
        if (typeof callback === 'function') callback(fail);
        return;
      }

      const commandId = `cmd-task-conf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const execResult = await dispatchCommand(agentEntry, commandId, revalidation.command.action, revalidation.command.parameters);

      const friendlyMsg = execResult.success
        ? formatFriendlyResponseMessage(revalidation.command.action, revalidation.command.parameters, execResult, pending.userText, pending.language)
        : (execResult.error || formatMultilingualError(execResult.error, pending.language));

      // Record in task history
      addTaskHistory({
        taskId: commandId,
        timestamp: new Date().toISOString(),
        originalUserRequest: pending.userText,
        detectedLanguage: pending.language,
        status: execResult.success ? 'completed' : 'failed',
        steps: revalidation.command.parameters?.steps?.length || 0,
        completedSteps: execResult.data?.completed_steps || (execResult.success ? revalidation.command.parameters?.steps?.length : 0),
        failedStep: execResult.success ? null : (execResult.data?.completed_steps !== undefined ? execResult.data.completed_steps + 1 : 1),
        resultSummary: friendlyMsg
      });

      const fullResponse = {
        success: execResult.success,
        commandId,
        userText: pending.userText,
        sessionId: pending.sessionId,
        language: pending.language,
        interpretedCommand: revalidation.command,
        result: execResult,
        message: friendlyMsg
      };

      socket.emit(execResult.success ? 'task_completed' : 'task_failed', fullResponse);
      socket.emit('ai_command_result', fullResponse);
      if (typeof callback === 'function') callback(fullResponse);
    });

    // Phase 9 Task Cancel Event
    socket.on('task_cancel', (payload, callback) => {
      const { confirmationId } = payload || {};
      if (confirmationId && pendingConfirmations.has(confirmationId)) {
        const pending = pendingConfirmations.get(confirmationId);
        pendingConfirmations.delete(confirmationId);
        const cancelMsg = pending.language === 'hinglish'
          ? 'Task cancel kar diya gaya.'
          : (pending.language === 'hi' ? 'कार्य रद्द कर दिया गया।' : 'Task cancelled.');
        const res = { success: true, cancelled: true, message: cancelMsg };
        socket.emit('task_cancelled', res);
        if (typeof callback === 'function') callback(res);
        return;
      }
      const res = { success: true, cancelled: true, message: 'Task cancelled.' };
      if (typeof callback === 'function') callback(res);
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
 * Media playback status endpoint (Phase 10)
 */
app.get('/api/media/status', (req, res) => {
  res.status(200).json({
    success: true,
    data: latestMediaStatus
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
  const { text, conversationHistory, sessionId, source = 'text', languagePreference = 'auto' } = req.body || {};
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

  const interpretation = await interpretCommand(text, context || [], languagePreference);

  // Phase 9 Language Switch Directives
  if (interpretation.isLanguageSwitch) {
    if (sessionId && !conversationHistory) {
      sessionStore.addMessage(sessionId, {
        role: 'assistant',
        content: interpretation.message,
        action: 'set_language',
        success: true
      });
    }
    return res.status(200).json({
      success: true,
      isLanguageSwitch: true,
      targetLanguage: interpretation.targetLanguage,
      language: interpretation.targetLanguage,
      message: interpretation.message
    });
  }

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
      language: interpretation.language,
      interpretedCommand: interpretation.interpretedCommand,
      error: interpretation.error || interpretation.message,
      message: failMsg
    });
  }

  const previewData = interpretation.validatedCommand.action === 'media_status'
    ? latestMediaStatus
    : latestSystemMetrics;

  const previewMessage = formatFriendlyResponseMessage(
    interpretation.validatedCommand.action,
    interpretation.validatedCommand.parameters,
    { success: true, data: previewData },
    text,
    interpretation.language
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

  let confirmationId = undefined;
  if (interpretation.requiresConfirmation) {
    confirmationId = `conf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    pendingConfirmations.set(confirmationId, {
      confirmationId,
      userText: text,
      sessionId,
      language: interpretation.language,
      validatedCommand: interpretation.validatedCommand,
      createdAt: Date.now(),
      expiresAt: Date.now() + 120000
    });
  }

  return res.status(200).json({
    success: true,
    command: interpretation.validatedCommand,
    language: interpretation.language,
    requiresConfirmation: interpretation.requiresConfirmation,
    confirmationId,
    confirmationPrompt: interpretation.confirmationPrompt,
    message: previewMessage
  });
});

/**
 * Task execution history endpoint (Phase 9)
 * GET /api/tasks/history
 */
app.get('/api/tasks/history', (req, res) => {
  res.status(200).json({
    success: true,
    count: taskExecutionHistory.length,
    tasks: taskExecutionHistory
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
