import React, { useState } from 'react';
import { Laptop, Wifi, RefreshCw, Settings } from 'lucide-react';
import { ConnectionState, AgentStatusState } from '../types/command';

interface DeviceCardProps {
  agentId: string;
  agentStatus: AgentStatusState;
  connectionState: ConnectionState;
  serverUrl: string;
  onReconnect: () => void;
  onUpdateServerUrl?: (url: string) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  agentId,
  agentStatus,
  connectionState,
  serverUrl,
  onReconnect,
  onUpdateServerUrl
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [customUrl, setCustomUrl] = useState(serverUrl);

  const isServerOnline = connectionState === 'CONNECTED';
  const isLaptopOnline = agentStatus === 'online';

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim() && onUpdateServerUrl) {
      onUpdateServerUrl(customUrl.trim());
      setIsEditing(false);
    }
  };

  return (
    <div className="w-full bg-slate-900/60 border border-cyan-500/20 rounded-2xl p-4 backdrop-blur-md shadow-lg shadow-black/40 flex flex-col gap-3 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-1.5">
          <Laptop className="w-3.5 h-3.5 text-cyan-400" />
          <h2 className="text-xs font-semibold tracking-wider text-cyan-300 uppercase">
            Device & Connection
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="text-slate-400 hover:text-cyan-400 p-1 transition-colors"
            title="Configure Server URL"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onReconnect}
            className="text-slate-400 hover:text-cyan-400 p-1 transition-colors"
            title="Reconnect Socket"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Device Info Rows */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-2.5 flex flex-col gap-1">
          <span className="text-slate-500">Laptop Agent</span>
          <span className="text-slate-200 font-bold">{agentId}</span>
          <span className={`text-[10px] font-semibold ${isLaptopOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
            ● {isLaptopOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-2.5 flex flex-col gap-1">
          <span className="text-slate-500">Central Server</span>
          <span className="text-slate-200 font-bold">Node Socket.IO</span>
          <span className={`text-[10px] font-semibold ${isServerOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
            ● {connectionState}
          </span>
        </div>
      </div>

      {/* Server URL Row */}
      {isEditing ? (
        <form onSubmit={handleSaveUrl} className="flex flex-col gap-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-cyan-500/30">
          <label className="text-[10px] text-cyan-300/80">Configure Server Endpoint:</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="http://192.168.1.X:3000"
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
            />
            <button
              type="submit"
              className="bg-cyan-600 hover:bg-cyan-500 text-black font-bold px-3 py-1 rounded text-xs select-none"
            >
              Save
            </button>
          </div>
          <span className="text-[10px] text-slate-500">
            For phone on Wi-Fi, use your laptop IPv4 (found via `ipconfig`)
          </span>
        </form>
      ) : (
        <div className="flex items-center justify-between bg-slate-950/40 border border-slate-800/60 rounded-xl px-3 py-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 truncate mr-2">
            <Wifi className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate" title={serverUrl}>{serverUrl}</span>
          </div>
          <span className="text-[10px] text-slate-500 shrink-0">Role: phone</span>
        </div>
      )}
    </div>
  );
};

export default DeviceCard;
