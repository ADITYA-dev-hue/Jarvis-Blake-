import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface NetworkCardProps {
  connected: boolean;
  isStale?: boolean;
}

export const NetworkCard: React.FC<NetworkCardProps> = ({
  connected,
  isStale = false
}) => {
  return (
    <div className={`relative bg-slate-900/60 border ${isStale ? 'border-slate-800' : connected ? 'border-teal-500/20' : 'border-rose-500/20'} rounded-2xl p-4 backdrop-blur-md shadow-lg shadow-black/40 flex flex-col justify-between overflow-hidden group transition-all duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${isStale ? 'bg-slate-800/80 text-slate-400' : connected ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
            {connected ? (
              <Wifi className="w-5 h-5 text-teal-300" />
            ) : (
              <WifiOff className="w-5 h-5 text-rose-400" />
            )}
          </div>
          <div>
            <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">Connectivity</div>
            <div className="text-sm font-semibold text-white tracking-wide">Network Link</div>
          </div>
        </div>
        <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${connected ? 'bg-teal-500/10 text-teal-300 border-teal-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'}`}>
          {connected ? '● ONLINE' : '○ DISCONNECTED'}
        </span>
      </div>

      <div className="flex items-baseline justify-between my-2">
        <span className={`text-2xl font-bold font-mono tracking-tight ${connected ? 'text-teal-300' : 'text-rose-400'}`}>
          {connected ? 'Active Interface' : 'No Link'}
        </span>
        <span className="text-xs font-mono text-slate-400">
          TLS Secure
        </span>
      </div>

      <div className="w-full bg-slate-950/80 h-2 rounded-full overflow-hidden border border-slate-800/60">
        <div
          className={`h-full ${connected ? 'bg-gradient-to-r from-teal-500 to-cyan-500' : 'bg-rose-500'} transition-all duration-500 rounded-full`}
          style={{ width: connected ? '100%' : '0%' }}
        />
      </div>
    </div>
  );
};

export default NetworkCard;
