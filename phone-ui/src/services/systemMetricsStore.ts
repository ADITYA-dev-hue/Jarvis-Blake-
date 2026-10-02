import { useState, useEffect } from 'react';
import socketService from './socket';
import { SystemMetrics, SystemDashboardState, DashboardStatus } from '../types/system';

const STALE_THRESHOLD_MS = 5000;       // 5 seconds -> STALE
const UNAVAILABLE_THRESHOLD_MS = 15000; // 15 seconds -> UNAVAILABLE

class SystemMetricsStore {
  private state: SystemDashboardState = {
    metrics: null,
    status: 'OFFLINE',
    lastUpdated: null,
    agentId: 'LAPTOP-01'
  };

  private listeners: Set<(state: SystemDashboardState) => void> = new Set();
  private timer: any = null;

  constructor() {
    this.init();
  }

  private init() {
    // Listen to metrics from socket
    socketService.onSystemMetrics((metrics: SystemMetrics) => {
      this.handleMetrics(metrics);
    });

    // Listen to agent status
    socketService.onAgentStatusChange((status, agentId) => {
      if (agentId) this.state.agentId = agentId;
      if (status === 'offline') {
        this.updateStatus('OFFLINE');
      } else if (status === 'online' && !this.state.metrics) {
        this.updateStatus('ONLINE');
        socketService.requestSystemMetrics();
      }
    });

    // Listen to socket connection state
    socketService.onConnectionChange((connState) => {
      if (connState === 'RECONNECTING') {
        this.updateStatus('RECONNECTING');
      } else if (connState === 'DISCONNECTED') {
        this.updateStatus('OFFLINE');
      }
    });

    // Start freshness / staleness check loop (every 1s)
    this.timer = setInterval(() => {
      this.checkFreshness();
    }, 1000);
  }

  private handleMetrics(metrics: SystemMetrics) {
    if (!metrics || !metrics.cpu || !metrics.memory) return;
    
    this.state = {
      metrics,
      status: 'ONLINE',
      lastUpdated: Date.now(),
      agentId: metrics.agent?.agentId || this.state.agentId
    };
    this.notify();
  }

  private checkFreshness() {
    if (!this.state.lastUpdated) return;
    if (this.state.status === 'OFFLINE') return;

    const elapsed = Date.now() - this.state.lastUpdated;
    if (elapsed >= UNAVAILABLE_THRESHOLD_MS) {
      if (this.state.status !== 'UNAVAILABLE') {
        this.updateStatus('UNAVAILABLE');
      }
    } else if (elapsed >= STALE_THRESHOLD_MS) {
      if (this.state.status === 'ONLINE') {
        this.updateStatus('STALE');
      }
    }
  }

  private updateStatus(newStatus: DashboardStatus) {
    if (this.state.status !== newStatus) {
      this.state = {
        ...this.state,
        status: newStatus
      };
      this.notify();
    }
  }

  public getState(): SystemDashboardState {
    return this.state;
  }

  public requestRefresh(): void {
    socketService.requestSystemMetrics();
  }

  public subscribe(listener: (state: SystemDashboardState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  public destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const systemMetricsStore = new SystemMetricsStore();

/**
 * Custom React hook for consuming real-time system metrics
 */
export function useSystemMetrics() {
  const [dashboardState, setDashboardState] = useState<SystemDashboardState>(
    systemMetricsStore.getState()
  );

  useEffect(() => {
    const unsubscribe = systemMetricsStore.subscribe((state) => {
      setDashboardState(state);
    });
    return unsubscribe;
  }, []);

  const refresh = () => systemMetricsStore.requestRefresh();

  return {
    ...dashboardState,
    refresh
  };
}

export default systemMetricsStore;
