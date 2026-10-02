/**
 * JARVIS Phase 5 - Local Conversation Storage Service
 * 
 * Manages persistent conversation history in browser localStorage.
 * 
 * Features:
 * - Persistent across page refreshes
 * - Graceful corruption recovery (clears invalid JSON and resets to empty)
 * - Persistent secure session ID generation (jarvisSessionId)
 * - Safe limits (caps messages to prevent storage bloat)
 * - Zero storage of API keys or authentication secrets
 */

import { ConversationMessage } from '../types/conversation';

const STORAGE_KEY_HISTORY = 'jarvisConversationHistory';
const STORAGE_KEY_SESSION_ID = 'jarvisSessionId';
const MAX_LOCAL_MESSAGES = 100;

class ConversationStorageService {
  /**
   * Get or generate a secure random session identifier for this client.
   * Stored in localStorage under 'jarvisSessionId'.
   */
  public getSessionId(): string {
    try {
      let sessionId = localStorage.getItem(STORAGE_KEY_SESSION_ID);
      if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 8) {
        sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        localStorage.setItem(STORAGE_KEY_SESSION_ID, sessionId);
      }
      return sessionId;
    } catch {
      return `sess-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    }
  }

  /**
   * Reset session ID (e.g. when conversation is explicitly cleared)
   */
  public resetSessionId(): string {
    const newSessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    try {
      localStorage.setItem(STORAGE_KEY_SESSION_ID, newSessionId);
    } catch {
      // Ignore
    }
    return newSessionId;
  }

  /**
   * Retrieve all saved conversation messages.
   * Gracefully handles JSON corruption by clearing and resetting.
   */
  public getMessages(): ConversationMessage[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        console.warn('[ConversationStorage] Malformed history in localStorage, resetting.');
        this.clearMessages();
        return [];
      }

      // Filter and validate items
      const validMessages = parsed.filter(
        (m) => m && typeof m === 'object' && typeof m.content === 'string' && m.role
      );

      return validMessages;
    } catch (err) {
      console.warn('[ConversationStorage] Corrupted localStorage, resetting conversation:', err);
      this.clearMessages();
      return [];
    }
  }

  /**
   * Save a new message to local conversation history.
   */
  public saveMessage(message: ConversationMessage): void {
    try {
      const messages = this.getMessages();
      messages.push(message);

      // Enforce storage boundary
      const trimmed = messages.slice(-MAX_LOCAL_MESSAGES);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(trimmed));
    } catch (err) {
      console.warn('[ConversationStorage] Failed to save message:', err);
    }
  }

  /**
   * Clear local conversation history.
   */
  public clearMessages(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    } catch {
      // Ignore
    }
  }

  /**
   * Retrieve recent conversation messages up to the requested limit.
   */
  public getRecentMessages(limit: number = 20): ConversationMessage[] {
    const all = this.getMessages();
    return all.slice(-limit);
  }
}

export const conversationStorage = new ConversationStorageService();
export default conversationStorage;
