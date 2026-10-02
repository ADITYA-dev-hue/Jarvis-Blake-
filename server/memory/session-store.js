/**
 * JARVIS Phase 5 - Server-Side Session Memory Store
 * 
 * In-memory conversation session store on the Node.js server.
 * 
 * Responsibilities:
 * - Maintains short-term session conversation history
 * - Maps sessionId -> ConversationMessage[]
 * - Enforces bounded memory limits (never allows unlimited growth)
 * - Safe retrieval of recent context messages
 * - Clean session clearing
 * - Zero disk persistence (in-memory only, resets safely on server restart)
 */

const crypto = require('crypto');

// Maximum messages kept in memory per session (capped at MAX_CONTEXT_MESSAGES)
const MAX_MESSAGES_PER_SESSION = parseInt(process.env.MAX_CONTEXT_MESSAGES, 10) || 20;
const DEFAULT_CONTEXT_LIMIT = MAX_MESSAGES_PER_SESSION;

class SessionStore {
  constructor() {
    /** @type {Map<string, Array<object>>} */
    this.sessions = new Map();
  }

  /**
   * Ensure a session exists
   * @param {string} sessionId
   * @returns {Array<object>}
   */
  createSession(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      sessionId = `session-${crypto.randomBytes(8).toString('hex')}`;
    }
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
    }
    return this.sessions.get(sessionId);
  }

  /**
   * Check if a session exists
   * @param {string} sessionId
   * @returns {boolean}
   */
  hasSession(sessionId) {
    return Boolean(sessionId && this.sessions.has(sessionId));
  }

  /**
   * Retrieve all messages for a session
   * @param {string} sessionId
   * @returns {Array<object>}
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || [];
  }

  /**
   * Add a message to a session history
   * 
   * @param {string} sessionId
   * @param {object} message
   * @param {"user"|"assistant"|"system"} message.role
   * @param {string} message.content
   * @param {number} [message.timestamp]
   * @param {"text"|"voice"} [message.source]
   * @param {string} [message.action]
   * @param {boolean} [message.success]
   * @returns {object} The stored message
   */
  addMessage(sessionId, message) {
    if (!sessionId) {
      sessionId = 'default-session';
    }

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
    }

    const sessionMessages = this.sessions.get(sessionId);

    const safeMessage = {
      id: message.id || `msg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      role: message.role || 'user',
      content: typeof message.content === 'string' ? message.content.trim() : String(message.content || ''),
      timestamp: message.timestamp || Date.now(),
      source: message.source || 'text',
      action: message.action || undefined,
      success: message.success !== undefined ? Boolean(message.success) : undefined
    };

    sessionMessages.push(safeMessage);

    // Enforce memory limit: cap stored messages per session
    if (sessionMessages.length > MAX_MESSAGES_PER_SESSION) {
      sessionMessages.splice(0, sessionMessages.length - MAX_MESSAGES_PER_SESSION);
    }

    return safeMessage;
  }

  /**
   * Get recent messages for AI context injection
   * 
   * @param {string} sessionId
   * @param {number} limit Maximum messages to retrieve (defaults to MAX_CONTEXT_MESSAGES = 20)
   * @returns {Array<object>}
   */
  getRecentMessages(sessionId, limit = DEFAULT_CONTEXT_LIMIT) {
    if (!sessionId || !this.sessions.has(sessionId)) {
      return [];
    }

    const messages = this.sessions.get(sessionId);
    const effectiveLimit = Math.min(limit, DEFAULT_CONTEXT_LIMIT);
    return messages.slice(-effectiveLimit);
  }

  /**
   * Clear session history
   * @param {string} sessionId
   * @returns {boolean}
   */
  clearSession(sessionId) {
    if (!sessionId) return false;
    if (this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
      return true;
    }
    return false;
  }

  /**
   * Clear all active sessions (e.g. for testing)
   */
  clearAll() {
    this.sessions.clear();
  }

  /**
   * Total number of active sessions
   */
  get sessionCount() {
    return this.sessions.size;
  }
}

const sessionStore = new SessionStore();

module.exports = {
  SessionStore,
  sessionStore,
  DEFAULT_CONTEXT_LIMIT
};
