export type MobileTab = 'home' | 'control' | 'apps' | 'files' | 'system' | 'automation' | 'security' | 'ask_blake';

export interface AppItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  command: string;
  isUrl?: boolean;
  status: 'running' | 'stopped';
  cpu?: string;
  ram?: string;
  lastUsed: string;
}

export interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file' | 'code' | 'image' | 'video' | 'archive';
  path: string;
  size?: string;
  modified: string;
}

export interface AutomationRule {
  id: string;
  title: string;
  trigger: string;
  action: string;
  active: boolean;
  lastRun?: string;
}

export interface SecurityLog {
  id: string;
  timestamp: string;
  event: string;
  status: 'allowed' | 'blocked' | 'verified';
  details: string;
}
