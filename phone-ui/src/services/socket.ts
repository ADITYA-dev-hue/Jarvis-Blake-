import { io, Socket } from 'socket.io-client';
import {
  CommandPayload,
  CommandResult,
  AiCommandResponse,
  ConnectionState,
  AgentStatusState,
  AgentStatusEvent
} from '../types/command';
import { SystemMetrics } from '../types/system';

// Default configuration from environment variables
const SERVER_URL = import.meta.env.VITE_JARVIS_SERVER_URL || 
  (typeof window !== 'undefined' ? `http://${window.location.hostname}:3000` : 'http://localhost:3000');

const PHONE_TOKEN = import.meta.env.VITE_JARVIS_PHONE_TOKEN || 'jarvis_phone_dev_token_884192';

class JarvisSocketService {
  private socket: Socket | null = null;
  private connectionState: ConnectionState = 'DISCONNECTED';
  private agentStatus: AgentStatusState = 'offline';
  private agentId: string = 'LAPTOP-01';
  private serverUrl: string = SERVER_URL;

  private connectionListeners: Set<(state: ConnectionState) => void> = new Set();
  private agentStatusListeners: Set<(status: AgentStatusState, agentId: string) => void> = new Set();
  private systemMetricsListeners: Set<(metrics: SystemMetrics) => void> = new Set();

  constructor() {
    this.initSocket();
  }

  public initSocket(customUrl?: string, customToken?: string) {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    if (customUrl) {
      this.serverUrl = customUrl;
    }

    const token = customToken || PHONE_TOKEN;

    this.updateConnectionState('CONNECTING');

    this.socket = io(this.serverUrl, {
      auth: {
        role: 'phone',
        token: token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 8000
    });

    this.setupListeners();
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.updateConnectionState('CONNECTED');
    });

    this.socket.on('disconnect', (reason) => {
      this.updateConnectionState('DISCONNECTED');
      this.updateAgentStatus('offline');
      if (reason === 'io server disconnect') {
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.updateConnectionState('ERROR');
      if (error.message.includes('Authentication failed')) {
        console.error('[Socket] Phone authentication failed:', error.message);
      }
    });

    this.socket.io.on('reconnect_attempt', () => {
      this.updateConnectionState('RECONNECTING');
    });

    // Laptop Agent status events broadcast by server
    this.socket.on('agent_status', (data: AgentStatusEvent) => {
      if (data && data.status) {
        this.agentId = data.agentId || this.agentId;
        this.updateAgentStatus(data.status, this.agentId);
      }
    });

    // Phase 7 Real-time System Metrics streaming
    this.socket.on('system_metrics', (data: SystemMetrics) => {
      if (data) {
        this.systemMetricsListeners.forEach((listener) => listener(data));
      }
    });
  }

  private updateConnectionState(state: ConnectionState) {
    this.connectionState = state;
    this.connectionListeners.forEach((listener) => listener(state));
  }

  private updateAgentStatus(status: AgentStatusState, agentId = this.agentId) {
    this.agentStatus = status;
    this.agentStatusListeners.forEach((listener) => listener(status, agentId));
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public getAgentStatus(): AgentStatusState {
    return this.agentStatus;
  }

  public getAgentId(): string {
    return this.agentId;
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  public onConnectionChange(listener: (state: ConnectionState) => void): () => void {
    this.connectionListeners.add(listener);
    listener(this.connectionState);
    return () => this.connectionListeners.delete(listener);
  }

  public onAgentStatusChange(listener: (status: AgentStatusState, agentId: string) => void): () => void {
    this.agentStatusListeners.add(listener);
    listener(this.agentStatus, this.agentId);
    return () => this.agentStatusListeners.delete(listener);
  }

  public onSystemMetrics(listener: (metrics: SystemMetrics) => void): () => void {
    this.systemMetricsListeners.add(listener);
    return () => this.systemMetricsListeners.delete(listener);
  }

  public requestSystemMetrics(): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('request_system_metrics');
    }
  }

  /**
   * Send a direct safe command through Socket.IO
   */
  public async sendCommand(
    action: string,
    parameters: Record<string, any> = {},
    customCommandId?: string
  ): Promise<CommandResult> {
    if (!this.socket || !this.socket.connected) {
      throw new Error('JARVIS server is unavailable.');
    }

    if (this.agentStatus === 'offline') {
      throw new Error('Your laptop is currently offline.');
    }

    const commandId = customCommandId || `cmd-phone-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const payload: CommandPayload = {
      commandId,
      action,
      parameters: parameters || {},
      agentId: this.agentId
    };

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({
          commandId,
          success: false,
          action,
          data: null,
          error: 'The laptop did not respond in time.'
        });
      }, 7000);

      const resultHandler = (result: CommandResult) => {
        if (result && result.commandId === commandId) {
          clearTimeout(timer);
          this.socket?.off('command_result', resultHandler);
          resolve(result);
        }
      };

      this.socket?.on('command_result', resultHandler);

      this.socket?.emit('execute_command', payload, (ackResult?: CommandResult) => {
        if (ackResult && ackResult.commandId === commandId) {
          clearTimeout(timer);
          this.socket?.off('command_result', resultHandler);
          resolve(ackResult);
        }
      });
    });
  }

  /**
   * Send a natural-language AI command through Socket.IO with session tracking
   */
  public async sendAiCommand(
    text: string,
    sessionId?: string,
    source?: 'text' | 'voice'
  ): Promise<AiCommandResponse> {
    if (!this.socket || !this.socket.connected) {
      throw new Error('JARVIS server is unavailable.');
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({
          success: false,
          userText: text,
          message: 'JARVIS AI is temporarily unavailable.'
        });
      }, 10000);

      const resultHandler = (response: AiCommandResponse) => {
        if (response && response.userText === text) {
          clearTimeout(timer);
          this.socket?.off('ai_command_result', resultHandler);
          resolve(response);
        }
      };

      this.socket?.on('ai_command_result', resultHandler);

      this.socket?.emit(
        'ai_command',
        { text, agentId: this.agentId, sessionId, source },
        (ackResponse?: AiCommandResponse) => {
          if (ackResponse) {
            clearTimeout(timer);
            this.socket?.off('ai_command_result', resultHandler);
            resolve(ackResponse);
          }
        }
      );
    });
  }

  /**
   * Request server-side session memory to be cleared
   */
  public async clearSession(sessionId: string): Promise<boolean> {
    if (!this.socket || !this.socket.connected) {
      return false;
    }

    return new Promise((resolve) => {
      this.socket?.emit('clear_session', { sessionId }, () => {
        resolve(true);
      });
      setTimeout(() => resolve(true), 1500);
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  public reconnect() {
    if (this.socket) {
      this.socket.connect();
    } else {
      this.initSocket();
    }
  }
}

export const socketService = new JarvisSocketService();
export default socketService;
