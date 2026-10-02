import React from 'react';
import { Layers } from 'lucide-react';

interface MemoryCardProps {
  usagePercent: number;
  usedBytes: number;
  totalBytes: number;
  isStale?: boolean;
}

export const MemoryCard: React.FC<MemoryCardProps> = ({
  usagePercent,
  usedBytes,
  totalBytes,
  isStale = false
}) => {
  const percent = Math.min(100, Math.max(0, Math.round(usagePercent)));
  const usedGb = (usedBytes / (1024 ** 3)).toFixed(1);
  const totalGb = (totalBytes / (1024 ** 3)).toFixed(1);

  const getGradient = () => {
    if (isStale) return 'from-slate-600 to-slate-500';
    if (percent < 60) return 'from-sky-500 to-cyan-500';
    if (percent < 85) return 'from-amber-500 to-orange-500';
    return 'from-rose-500 to-red-600';
  };

  const getTextColor = () => {
    if (isStale) return 'text-slate-400';
    if (percent < 60) return 'text-sky-300';
    if (percent < 85) return 'text-amber-300';
    return 'text-rose-400';
  };

  return (
    <div className={`relative bg-slate-900/60 border ${isStale ? 'border-slate-800' : 'border-sky-500/20'} rounded-2xl p-4 backdrop-blur-md shadow-lg shadow-black/40 flex flex-col justify-between overflow-hidden group transition-all duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${isStale ? 'bg-slate-800/80 text-slate-400' : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'}`}>
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">Memory</div>
            <div className="text-sm font-semibold text-white tracking-wide">RAM Allocation</div>
          </div>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {usedGb} / {totalGb} GB
        </span>
      </div>

      <div className="flex items-baseline justify-between my-2">
        <span className={`text-3xl font-bold font-mono tracking-tight ${getTextColor()}`}>
          {percent}%
        </span>
        <span className="text-xs font-mono text-slate-400">
          Utilized
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

export default MemoryCard;
