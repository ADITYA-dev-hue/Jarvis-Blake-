export interface CpuMetrics {
  usagePercent: number;
  coreCount: number;
}

export interface MemoryMetrics {
  usagePercent: number;
  usedBytes: number;
  totalBytes: number;
}

export interface DiskMetrics {
  usagePercent: number;
  usedBytes: number;
  totalBytes: number;
}

export interface BatteryMetrics {
  available: boolean;
  percent?: number;
  charging?: boolean;
}

export interface NetworkMetrics {
  connected: boolean;
}

export interface SystemInfoMetrics {
  platform: 'Windows' | string;
  architecture: string;
  uptimeSeconds: number;
}

export interface AgentMetricsInfo {
  agentId: string;
  status: 'ONLINE' | 'OFFLINE' | 'STALE' | 'RECONNECTING' | 'UNAVAILABLE';
}

export interface SystemMetrics {
  timestamp: number;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  battery: BatteryMetrics;
  network: NetworkMetrics;
  system: SystemInfoMetrics;
  agent: AgentMetricsInfo;
}

export type DashboardStatus = 'ONLINE' | 'OFFLINE' | 'STALE' | 'RECONNECTING' | 'UNAVAILABLE';

export interface SystemDashboardState {
  metrics: SystemMetrics | null;
  status: DashboardStatus;
  lastUpdated: number | null;
  agentId: string;
}
