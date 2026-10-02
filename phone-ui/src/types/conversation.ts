/**
 * JARVIS Phase 5 - Conversation Context Types
 * 
 * Typed interfaces for conversation messages, roles, and session tracking.
 */

export type ConversationRole = 'user' | 'assistant' | 'system';

export type MessageSource = 'text' | 'voice';

export interface ConversationMessage {
  id: string;
  role: ConversationRole;
  content: string;
  timestamp: number;
  source?: MessageSource;
  action?: string;
  success?: boolean;
}

export interface SessionClearResponse {
  success: boolean;
  message?: string;
}
