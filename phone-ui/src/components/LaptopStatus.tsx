import React from 'react';
import { AgentStatusState } from '../types/command';

interface LaptopStatusProps {
  status: AgentStatusState;
  agentId: string;
}

export const LaptopStatus: React.FC<LaptopStatusProps> = ({ status, agentId }) => {
  const isOnline = status === 'online';

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono tracking-wider backdrop-blur-sm transition-colors duration-300 ${
        isOnline
          ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-300'
          : 'bg-rose-950/20 border-rose-500/30 text-rose-400'
      }`}
      title={`Laptop Agent (${agentId}): ${status.toUpperCase()}`}
    >
      <span className="relative flex h-2 w-2">
        {isOnline && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isOnline ? 'bg-cyan-400' : 'bg-rose-500'
          }`}
        />
      </span>
      <span>{isOnline ? 'LAPTOP ONLINE' : 'LAPTOP OFFLINE'}</span>
    </div>
  );
};

export default LaptopStatus;
