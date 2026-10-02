export type CommandAction = 'system_status' | 'open_url' | 'create_folder' | 'open_app' | 'unsupported';

export interface CommandPayload {
  commandId?: string;
  action: CommandAction | string;
  parameters: Record<string, any>;
  agentId?: string;
}

export interface SystemStatusData {
  cpu: number;
  ram: number;
  os: string;
  hostname: string;
  cpu_details?: {
    usage_percent: number;
    logical_cores: number;
    physical_cores: number;
    frequency_mhz: number | null;
  };
  memory?: {
    total: string;
    available: string;
    used: string;
    percent: number;
  };
  disk?: {
    drive: string;
    total: string;
    free: string;
    used: string;
    percent: number;
  } | null;
  os_details?: {
    platform: string;
    release: string;
    version: string;
    machine: string;
    hostname: string;
    boot_time: string;
    uptime: string;
    uptime_seconds: number;
  };
  battery?: {
    percent: number;
    power_plugged: boolean;
    seconds_left: number | null;
  } | null;
  timestamp?: string;
}

export interface CommandResult {
  commandId: string;
  success: boolean;
  action: string;
  data: any;
  error: string | null;
}

export interface AiCommandResponse {
  success: boolean;
  userText: string;
  interpretedCommand?: {
    action: string;
    parameters: Record<string, any>;
  };
  result?: CommandResult;
  message?: string;
}

export type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'ERROR';

export type AgentStatusState = 'online' | 'offline';

export type AiStatusState = 'AI CONNECTING' | 'AI READY' | 'AI THINKING' | 'AI ERROR';

export interface AgentStatusEvent {
  agentId: string;
  status: AgentStatusState;
}

export interface HistoryItem {
  id: string;
  commandId: string;
  action: string;
  label: string;
  userText?: string;
  interpretedAction?: string;
  source?: 'text' | 'voice';
  timestamp: string;
  success: boolean;
  error?: string | null;
  data?: any;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
