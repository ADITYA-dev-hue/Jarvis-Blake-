import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { DashboardStatus } from '../../types/system';

interface AgentStatusCardProps {
  agentId: string;
  status: DashboardStatus;
  lastUpdated: number | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const AgentStatusCard: React.FC<AgentStatusCardProps> = ({
  agentId,
  status,
  lastUpdated,
  onRefresh,
  isRefreshing = false
}) => {
  const [timeAgoText, setTimeAgoText] = useState<string>('Never');

  useEffect(() => {
    const updateTimeAgo = () => {
      if (!lastUpdated) {
        setTimeAgoText('Never');
        return;
      }
      const diffSec = Math.floor((Date.now() - lastUpdated) / 1000);
      if (diffSec < 2) {
        setTimeAgoText('Just now');
      } else if (diffSec < 60) {
        setTimeAgoText(`${diffSec}s ago`);
      } else {
        const diffMin = Math.floor(diffSec / 60);
        setTimeAgoText(`${diffMin}m ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const getStatusBadge = () => {
    switch (status) {
      case 'ONLINE':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
            ONLINE
          </span>
        );
      case 'STALE':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            STALE
          </span>
        );
      case 'UNAVAILABLE':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono font-semibold">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            DATA UNAVAILABLE
          </span>
        );
      case 'RECONNECTING':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-semibold">
            <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            RECONNECTING
          </span>
        );
      case 'OFFLINE':
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-mono font-semibold">
            <XCircle className="w-3.5 h-3.5 text-slate-500" />
            OFFLINE
          </span>
        );
    }
  };

  return (
    <div className="w-full bg-slate-900/60 border border-cyan-500/20 rounded-2xl p-4 backdrop-blur-md shadow-lg shadow-black/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <Radio className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">Authenticated Agent</div>
          <div className="text-lg font-bold text-white font-mono tracking-wide flex items-center gap-2">
            {agentId}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 self-end md:self-center">
        {getStatusBadge()}

        <div className="text-right">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Last Telemetry</div>
          <div className="text-xs font-mono text-slate-200">{timeAgoText}</div>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing || status === 'OFFLINE'}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-50"
            title="Request immediate telemetry snapshot"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        )}
      </div>
    </div>
  );
};

export default AgentStatusCard;
