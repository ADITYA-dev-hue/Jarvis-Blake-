/**
 * JARVIS Phase 5 - Frontend Conversation Manager
 * 
 * Central coordinator for conversation history, session state,
 * and synchronization between localStorage and server session memory.
 * 
 * Features:
 * - Single entry point for both voice and text messages
 * - Synchronizes with browser localStorage via conversationStorage
 * - Coordinates server-side session memory clearance via socketService
 * - Clean abstractions decoupled from UI rendering
 */

import { ConversationMessage, MessageSource } from '../types/conversation';
import conversationStorage from './conversationStorage';
import socketService from './socket';

class ConversationManager {
  private sessionId: string;
  private listeners: Set<(messages: ConversationMessage[]) => void> = new Set();
  private messages: ConversationMessage[] = [];

  constructor() {
    this.sessionId = conversationStorage.getSessionId();
    this.messages = conversationStorage.getMessages();
  }

  /**
   * Current active session ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Subscribe to conversation message changes
   */
  public subscribe(listener: (messages: ConversationMessage[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.messages]);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const copy = [...this.messages];
    for (const listener of this.listeners) {
      try {
        listener(copy);
      } catch (err) {
        console.error('[ConversationManager] Listener error:', err);
      }
    }
  }

  /**
   * Add a user-originated message (Voice or Text)
   */
  public addUserMessage(content: string, source: MessageSource = 'text'): ConversationMessage {
    const msg: ConversationMessage = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      source
    };

    this.messages.push(msg);
    conversationStorage.saveMessage(msg);
    this.notify();
    return msg;
  }

  /**
   * Add an assistant-originated response
   */
  public addAssistantMessage(
    content: string,
    action?: string,
    success?: boolean
  ): ConversationMessage {
    const msg: ConversationMessage = {
      id: `ast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role: 'assistant',
      content: content.trim(),
      timestamp: Date.now(),
      action,
      success: success !== undefined ? Boolean(success) : true
    };

    this.messages.push(msg);
    conversationStorage.saveMessage(msg);
    this.notify();
    return msg;
  }

  /**
   * Retrieve all messages in current conversation history
   */
  public getHistory(): ConversationMessage[] {
    return [...this.messages];
  }

  /**
   * Retrieve recent conversation messages
   */
  public getRecentHistory(limit: number = 20): ConversationMessage[] {
    return this.messages.slice(-limit);
  }

  /**
   * Clear all conversation history:
   * 1. Clear local in-memory messages
   * 2. Clear browser localStorage
   * 3. Request server session memory clear
   * 4. Regenerate a clean session ID
   */
  public async clearHistory(): Promise<void> {
    const oldSessionId = this.sessionId;

    // 1. Reset in-memory messages
    this.messages = [];
    this.notify();

    // 2. Clear localStorage
    conversationStorage.clearMessages();

    // 3. Request server clear
    try {
      await socketService.clearSession(oldSessionId);
    } catch (err) {
      console.warn('[ConversationManager] Failed to clear server session:', err);
    }

    // 4. Generate new session ID
    this.sessionId = conversationStorage.resetSessionId();
  }
}

export const conversationManager = new ConversationManager();
export default conversationManager;
