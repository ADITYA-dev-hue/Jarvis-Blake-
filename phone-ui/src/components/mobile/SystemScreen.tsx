import React from 'react';
import { Cpu } from 'lucide-react';
import SystemDashboard from '../dashboard/SystemDashboard';

interface SystemScreenProps {
  systemData?: any;
  onRefresh?: () => void;
}

export const SystemScreen: React.FC<SystemScreenProps> = () => {
  return (
    <div className="flex flex-col gap-4 pb-28">
      {/* Title */}
      <div className="flex items-center justify-between pb-1 border-b border-red-950/60">
        <div>
          <h2 className="font-mono text-base font-bold text-white tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-red-500" />
            LIVE SYSTEM TELEMETRY
          </h2>
          <p className="font-mono text-[10px] text-slate-400">Real-Time Windows Laptop Telemetry & Diagnostics</p>
        </div>
      </div>

      {/* Phase 7 Live Telemetry Dashboard */}
      <SystemDashboard />
    </div>
  );
};

export default SystemScreen;
