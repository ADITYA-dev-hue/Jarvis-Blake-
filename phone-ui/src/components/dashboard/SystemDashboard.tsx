import React, { useState } from 'react';
import { useSystemMetrics } from '../../services/systemMetricsStore';
import { AgentStatusCard } from './AgentStatusCard';
import { CpuCard } from './CpuCard';
import { MemoryCard } from './MemoryCard';
import { DiskCard } from './DiskCard';
import { BatteryCard } from './BatteryCard';
import { NetworkCard } from './NetworkCard';
import { SystemInfoCard } from './SystemInfoCard';
import { AlertCircle, WifiOff } from 'lucide-react';

export const SystemDashboard: React.FC = () => {
  const { metrics, status, lastUpdated, agentId, refresh } = useSystemMetrics();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const isStale = status === 'STALE' || status === 'UNAVAILABLE';

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Top Agent Status Banner */}
      <AgentStatusCard
        agentId={agentId}
        status={status}
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Warning/Alert Banners for Stale or Unavailable */}
      {status === 'STALE' && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Telemetry stale: No updates from agent in past 5 seconds. Displaying last cached metrics.</span>
        </div>
      )}

      {status === 'UNAVAILABLE' && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>Laptop data unavailable: Telemetry timeout exceeded 15 seconds. Reconnecting...</span>
        </div>
      )}

      {status === 'OFFLINE' && !metrics && (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center gap-3">
          <div className="p-3 rounded-full bg-slate-800/80 text-slate-500 border border-slate-700/50">
            <WifiOff className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Laptop Agent Offline</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Start the Python agent on your Windows laptop. Live telemetry will stream automatically once connected.
            </p>
          </div>
        </div>
      )}

      {/* Live Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <CpuCard
            usagePercent={metrics.cpu.usagePercent}
            coreCount={metrics.cpu.coreCount}
            isStale={isStale}
          />

          <MemoryCard
            usagePercent={metrics.memory.usagePercent}
            usedBytes={metrics.memory.usedBytes}
            totalBytes={metrics.memory.totalBytes}
            isStale={isStale}
          />

          <DiskCard
            usagePercent={metrics.disk.usagePercent}
            usedBytes={metrics.disk.usedBytes}
            totalBytes={metrics.disk.totalBytes}
            isStale={isStale}
          />

          <BatteryCard
            available={metrics.battery.available}
            percent={metrics.battery.percent}
            charging={metrics.battery.charging}
            isStale={isStale}
          />

          <NetworkCard
            connected={metrics.network.connected}
            isStale={isStale}
          />

          <SystemInfoCard
            platform={metrics.system.platform}
            architecture={metrics.system.architecture}
            uptimeSeconds={metrics.system.uptimeSeconds}
            isStale={isStale}
          />
        </div>
      )}
    </div>
  );
};

export default SystemDashboard;
