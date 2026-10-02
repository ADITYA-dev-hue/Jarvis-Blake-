import React from 'react';
import { Cpu } from 'lucide-react';

interface CpuCardProps {
  usagePercent: number;
  coreCount: number;
  isStale?: boolean;
}

export const CpuCard: React.FC<CpuCardProps> = ({
  usagePercent,
  coreCount,
  isStale = false
}) => {
  const percent = Math.min(100, Math.max(0, Math.round(usagePercent)));

  const getGradient = () => {
    if (isStale) return 'from-slate-600 to-slate-500';
    if (percent < 60) return 'from-cyan-500 to-blue-500';
    if (percent < 85) return 'from-amber-500 to-orange-500';
    return 'from-rose-500 to-red-600';
  };

  const getTextColor = () => {
    if (isStale) return 'text-slate-400';
    if (percent < 60) return 'text-cyan-300';
    if (percent < 85) return 'text-amber-300';
    return 'text-rose-400';
  };

  return (
    <div className={`relative bg-slate-900/60 border ${isStale ? 'border-slate-800' : 'border-cyan-500/20'} rounded-2xl p-4 backdrop-blur-md shadow-lg shadow-black/40 flex flex-col justify-between overflow-hidden group transition-all duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${isStale ? 'bg-slate-800/80 text-slate-400' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}`}>
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">Processor</div>
            <div className="text-sm font-semibold text-white tracking-wide">CPU Activity</div>
          </div>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/50">
          {coreCount} Cores
        </span>
      </div>

      <div className="flex items-baseline justify-between my-2">
        <span className={`text-3xl font-bold font-mono tracking-tight ${getTextColor()}`}>
          {percent}%
        </span>
        <span className="text-xs font-mono text-slate-400">
          Load
        </span>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-slate-950/80 h-2 rounded-full overflow-hidden border border-slate-800/60">
        <div
          className={`h-full bg-gradient-to-r ${getGradient()} transition-all duration-500 rounded-full`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default CpuCard;
