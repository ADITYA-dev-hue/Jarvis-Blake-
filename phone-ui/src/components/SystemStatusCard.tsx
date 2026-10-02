import React from 'react';
import { Cpu, HardDrive, Server, RefreshCw } from 'lucide-react';
import { SystemStatusData } from '../types/command';

interface SystemStatusCardProps {
  data: SystemStatusData | null;
  onRefresh: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export const SystemStatusCard: React.FC<SystemStatusCardProps> = ({
  data,
  onRefresh,
  isLoading,
  disabled
}) => {
  const getPercentColor = (percent: number) => {
    if (percent < 60) return 'from-cyan-400 to-blue-500';
    if (percent < 85) return 'from-amber-400 to-amber-500';
    return 'from-rose-500 to-red-600';
  };

  return (
    <div className="w-full bg-slate-900/60 border border-cyan-500/20 rounded-2xl p-4 backdrop-blur-md shadow-lg shadow-black/40 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <h2 className="text-xs font-mono font-semibold tracking-wider text-cyan-300 uppercase">
            System Telemetry
          </h2>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={disabled || isLoading}
          className="text-slate-400 hover:text-cyan-300 p-1 rounded-lg hover:bg-slate-800/50 transition-colors disabled:opacity-50"
          title="Refresh system metrics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {data ? (
        <div className="flex flex-col gap-3">
          {/* 3 Metric Gauges Grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* CPU */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 mb-1">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>CPU</span>
              </div>
              <div className="text-lg font-mono font-bold text-cyan-200">
                {Math.round(data.cpu)}%
              </div>
              <div className="w-full bg-slate-800/60 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getPercentColor(data.cpu)} transition-all duration-500`}
                  style={{ width: `${Math.min(100, Math.max(0, data.cpu))}%` }}
                />
              </div>
            </div>

            {/* RAM */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 mb-1">
                <Server className="w-3.5 h-3.5 text-sky-400" />
                <span>RAM</span>
              </div>
              <div className="text-lg font-mono font-bold text-sky-200">
                {Math.round(data.ram)}%
              </div>
              <div className="w-full bg-slate-800/60 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getPercentColor(data.ram)} transition-all duration-500`}
                  style={{ width: `${Math.min(100, Math.max(0, data.ram))}%` }}
                />
              </div>
            </div>

            {/* DISK */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 mb-1">
                <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                <span>DISK</span>
              </div>
              <div className="text-lg font-mono font-bold text-blue-200">
                {data.disk ? `${Math.round(data.disk.percent)}%` : '--'}
              </div>
              <div className="w-full bg-slate-800/60 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getPercentColor(data.disk?.percent || 0)} transition-all duration-500`}
                  style={{ width: `${Math.min(100, Math.max(0, data.disk?.percent || 0))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Details Bar */}
          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-y-1">
            <div>
              <span className="text-slate-500">OS: </span>
              <span className="text-slate-200">{data.os || 'Windows'}</span>
            </div>
            <div>
              <span className="text-slate-500">HOST: </span>
              <span className="text-slate-200">{data.hostname || 'Unknown'}</span>
            </div>
            {data.os_details?.uptime && (
              <div>
                <span className="text-slate-500">UPTIME: </span>
                <span className="text-slate-200">{data.os_details.uptime}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="py-6 flex flex-col items-center justify-center text-center text-slate-500 font-mono text-xs">
          <span>Tap &ldquo;System Status&rdquo; to fetch live telemetry</span>
        </div>
      )}
    </div>
  );
};

export default SystemStatusCard;
