import React from 'react';
import { Monitor, Clock } from 'lucide-react';

interface SystemInfoCardProps {
  platform: string;
  architecture: string;
  uptimeSeconds: number;
  isStale?: boolean;
}

export function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (d > 0) {
    return `${d}d ${h}h ${m}m`;
  }
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

export const SystemInfoCard: React.FC<SystemInfoCardProps> = ({
  platform,
  architecture,
  uptimeSeconds,
  isStale = false
}) => {
  return (
    <div className={`relative bg-slate-900/60 border ${isStale ? 'border-slate-800' : 'border-purple-500/20'} rounded-2xl p-4 backdrop-blur-md shadow-lg shadow-black/40 flex flex-col justify-between overflow-hidden group transition-all duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${isStale ? 'bg-slate-800/80 text-slate-400' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">Environment</div>
            <div className="text-sm font-semibold text-white tracking-wide">Host Architecture</div>
          </div>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800/80 text-purple-300 border border-slate-700/50">
          {architecture}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 my-2 bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/60">
        <div>
          <div className="text-[10px] font-mono text-slate-400 uppercase">OS Platform</div>
          <div className="text-sm font-semibold text-white font-mono mt-0.5">{platform}</div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 uppercase">
            <Clock className="w-3 h-3 text-purple-400" />
            <span>Uptime</span>
          </div>
          <div className="text-sm font-semibold text-purple-200 font-mono mt-0.5">
            {formatUptime(uptimeSeconds)}
          </div>
        </div>
      </div>

      <div className="w-full bg-slate-950/80 h-2 rounded-full overflow-hidden border border-slate-800/60">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
};

export default SystemInfoCard;
