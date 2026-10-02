import React from 'react';
import { ConnectionState } from '../types/command';

interface ConnectionStatusProps {
  state: ConnectionState;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ state }) => {
  const getBadgeConfig = () => {
    switch (state) {
      case 'CONNECTED':
        return {
          label: 'SERVER ONLINE',
          dotColor: 'bg-emerald-400',
          textColor: 'text-emerald-400',
          borderColor: 'border-emerald-500/30',
          bgColor: 'bg-emerald-950/20',
          pulse: false
        };
      case 'CONNECTING':
        return {
          label: 'CONNECTING',
          dotColor: 'bg-amber-400',
          textColor: 'text-amber-300',
          borderColor: 'border-amber-500/30',
          bgColor: 'bg-amber-950/20',
          pulse: true
        };
      case 'RECONNECTING':
        return {
          label: 'RECONNECTING',
          dotColor: 'bg-amber-400',
          textColor: 'text-amber-300',
          borderColor: 'border-amber-500/30',
          bgColor: 'bg-amber-950/20',
          pulse: true
        };
      case 'ERROR':
        return {
          label: 'SERVER ERROR',
          dotColor: 'bg-rose-500',
          textColor: 'text-rose-400',
          borderColor: 'border-rose-500/30',
          bgColor: 'bg-rose-950/20',
          pulse: false
        };
      case 'DISCONNECTED':
      default:
        return {
          label: 'SERVER OFFLINE',
          dotColor: 'bg-rose-500',
          textColor: 'text-rose-400',
          borderColor: 'border-rose-500/30',
          bgColor: 'bg-rose-950/20',
          pulse: false
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono tracking-wider backdrop-blur-sm ${config.bgColor} ${config.borderColor} ${config.textColor}`}
      title={`Server State: ${state}`}
    >
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dotColor}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
      </span>
      <span>{config.label}</span>
    </div>
  );
};

export default ConnectionStatus;
