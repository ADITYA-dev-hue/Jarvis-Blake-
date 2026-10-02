import React from 'react';
import { Battery, BatteryCharging, Zap } from 'lucide-react';

interface BatteryCardProps {
  available: boolean;
  percent?: number;
  charging?: boolean;
  isStale?: boolean;
}

export const BatteryCard: React.FC<BatteryCardProps> = ({
  available,
  percent,
  charging,
  isStale = false
}) => {
  const displayPercent = available && typeof percent === 'number'
    ? Math.min(100, Math.max(0, Math.round(percent)))
    : null;

  const getGradient = () => {
    if (isStale || displayPercent === null) return 'from-slate-600 to-slate-500';
    if (displayPercent > 30) return 'from-emerald-500 to-teal-500';
    if (displayPercent > 15) return 'from-amber-500 to-orange-500';
    return 'from-rose-500 to-red-600';
  };

  const getTextColor = () => {
    if (isStale || displayPercent === null) return 'text-slate-400';
    if (displayPercent > 30) return 'text-emerald-300';
    if (displayPercent > 15) return 'text-amber-300';
    return 'text-rose-400';
  };

  return (
    <div className={`relative bg-slate-900/60 border ${isStale ? 'border-slate-800' : 'border-emerald-500/20'} rounded-2xl p-4 backdrop-blur-md shadow-lg shadow-black/40 flex flex-col justify-between overflow-hidden group transition-all duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${isStale ? 'bg-slate-800/80 text-slate-400' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
            {charging ? (
              <BatteryCharging className="w-5 h-5 text-emerald-300 animate-pulse" />
            ) : available ? (
              <Battery className="w-5 h-5" />
            ) : (
              <Zap className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div>
            <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">Power Source</div>
            <div className="text-sm font-semibold text-white tracking-wide">Battery Status</div>
          </div>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/50">
          {charging ? '⚡ Charging' : available ? 'On Battery' : 'A/C Main'}
        </span>
      </div>

      <div className="flex items-baseline justify-between my-2">
        <span className={`text-3xl font-bold font-mono tracking-tight ${getTextColor()}`}>
          {displayPercent !== null ? `${displayPercent}%` : 'A/C Power'}
        </span>
        <span className="text-xs font-mono text-slate-400">
          {displayPercent !== null ? (charging ? 'Charging' : 'Remaining') : 'Desktop Mode'}
        </span>
      </div>

      {/* Progress Track or Constant Line */}
      <div className="w-full bg-slate-950/80 h-2 rounded-full overflow-hidden border border-slate-800/60">
        <div
          className={`h-full bg-gradient-to-r ${getGradient()} transition-all duration-500 rounded-full`}
          style={{ width: `${displayPercent !== null ? displayPercent : 100}%` }}
        />
      </div>
    </div>
  );
};

export default BatteryCard;
