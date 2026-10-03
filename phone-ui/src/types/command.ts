export type CommandAction =
  | 'system_status'
  | 'open_url'
  | 'create_folder'
  | 'open_app'
  | 'open_folder'
  | 'list_folder'
  | 'get_file_info'
  | 'create_text_file'
  | 'open_file'
  | 'type_text'
  | 'wait'
  | 'search_web'
  | 'task'
  | 'list_windows'
  | 'focus_window'
  | 'minimize_window'
  | 'maximize_window'
  | 'restore_window'
  | 'media_status'
  | 'search_files'
  | 'read_file'
  | 'search_file_content'
  | 'analyze_file'
  | 'summarize_file'
  | 'analyze_folder'
  | 'workspace_insights'
  | 'list_supported_files'
  | 'unsupported';

export interface WindowItem {
  app: string;
  title: string;
}

export interface ListWindowsData {
  count: number;
  windows: WindowItem[];
}

export interface MediaStatusData {
  active: boolean;
  playbackState: 'playing' | 'paused' | 'stopped' | string;
  mediaType: 'music' | 'video' | 'audio' | 'none' | string;
  title: string;
  artist: string;
  album: string;
  source: string;
  receivedAt?: string;
}

export interface TaskProgressEvent {
  commandId: string;
  step: number;
  total: number;
  action: string;
}

export interface WorkspaceFileMetadata {
  filename: string;
  relative_path: string;
  size_bytes: number;
  size_formatted: string;
  extension: string;
  category: 'code' | 'document' | 'data' | 'other' | string;
  modified: string;
  is_sensitive?: boolean;
}

export interface SearchFilesResult {
  count: number;
  files: WorkspaceFileMetadata[];
  limited: boolean;
}

export interface ReadFileResult {
  filename: string;
  relative_path: string;
  total_lines: number;
  start_line: number;
  end_line: number;
  lines_returned: number;
  content: string;
  truncated: boolean;
}

export interface SearchContentExcerpt {
  file: string;
  line?: number;
  page?: number;
  excerpt: string;
}

export interface SearchContentResult {
  query: string;
  files_searched: number;
  total_matches: number;
  excerpts: SearchContentExcerpt[];
}

export interface WorkspaceInsightsResult {
  total_files: number;
  total_code_files: number;
  total_code_lines: number;
  total_comment_lines: number;
  total_blank_lines: number;
  comment_ratio_pct: number;
  total_todos: number;
  languages: Record<string, any>;
  top_largest_files: Array<{ name: string; relative_path: string; size_formatted: string }>;
  top_complex_files: Array<{ name: string; relative_path: string; language: string; total_lines: number }>;
}

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

export type LanguagePreference = 'auto' | 'en' | 'hinglish' | 'hi';

export interface TaskConfirmationRequiredEvent {
  success: boolean;
  requiresConfirmation: boolean;
  confirmationId: string;
  userText: string;
  sessionId?: string;
  language: string;
  interpretedCommand?: {
    action: string;
    parameters: Record<string, any>;
  };
  validatedCommand?: {
    action: string;
    parameters: Record<string, any>;
  };
  taskSummary: {
    steps: number;
    stepActions: string[];
  };
  message: string;
}

export interface TaskHistoryItem {
  taskId: string;
  timestamp: string;
  originalUserRequest: string;
  detectedLanguage: string;
  status: 'completed' | 'failed' | 'cancelled';
  steps: number;
  completedSteps: number;
  failedStep: number | null;
  resultSummary: string;
}

export interface AiCommandResponse {
  success: boolean;
  userText: string;
  language?: string;
  isLanguageSwitch?: boolean;
  targetLanguage?: string;
  requiresConfirmation?: boolean;
  confirmationId?: string;
  taskSummary?: {
    steps: number;
    stepActions: string[];
  };
  interpretedCommand?: {
    action: string;
    parameters: Record<string, any>;
  };
  validatedCommand?: {
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
