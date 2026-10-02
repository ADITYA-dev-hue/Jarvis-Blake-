import React from 'react';
import { ConnectionState, AgentStatusState, AiStatusState } from '../types/command';
import ConnectionStatus from './ConnectionStatus';
import LaptopStatus from './LaptopStatus';

interface JarvisHeaderProps {
  connectionState: ConnectionState;
  agentStatus: AgentStatusState;
  agentId: string;
  aiStatus: AiStatusState;
}

export const JarvisHeader: React.FC<JarvisHeaderProps> = ({
  connectionState,
  agentStatus,
  agentId,
  aiStatus
}) => {
  const getAiBadge = () => {
    switch (aiStatus) {
      case 'AI THINKING':
        return {
          label: 'AI THINKING',
          dotColor: 'bg-cyan-400',
          textColor: 'text-cyan-300',
          borderColor: 'border-cyan-500/40',
          pulse: true
        };
      case 'AI READY':
        return {
          label: 'AI READY',
          dotColor: 'bg-emerald-400',
          textColor: 'text-emerald-300',
          borderColor: 'border-emerald-500/30',
          pulse: false
        };
      case 'AI ERROR':
        return {
          label: 'AI ERROR',
          dotColor: 'bg-rose-500',
          textColor: 'text-rose-400',
          borderColor: 'border-rose-500/30',
          pulse: false
        };
      case 'AI CONNECTING':
      default:
        return {
          label: 'AI CONNECTING',
          dotColor: 'bg-amber-400',
          textColor: 'text-amber-300',
          borderColor: 'border-amber-500/30',
          pulse: true
        };
    }
  };

  const aiBadge = getAiBadge();

  return (
    <header className="relative w-full flex flex-col items-center justify-center pt-4 pb-2 text-center select-none">
      {/* Subtle Arc Reactor HUD ring with Official JARVIS BLAKE Emblem */}
      <div className="relative mb-3 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border border-red-500/60 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse overflow-hidden bg-black p-1">
          <img
            src="/jarvis_blake_round.png"
            alt="JARVIS BLAKE"
            className="w-full h-full object-contain rounded-full shadow-[0_0_10px_rgba(239,68,68,0.7)]"
          />
        </div>
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-blue-500 font-mono drop-shadow-[0_0_12px_rgba(0,229,255,0.4)]">
        J.A.R.V.I.S
      </h1>

      <p className="text-sm text-cyan-200/80 font-medium tracking-wide mt-1">
        &ldquo;How can I help you?&rdquo;
      </p>

      {/* Triple Status Indicators: Server, Laptop, AI */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-3 w-full max-w-sm">
        <ConnectionStatus state={connectionState} />
        <LaptopStatus status={agentStatus} agentId={agentId} />

        {/* AI Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono tracking-wider backdrop-blur-sm bg-slate-950/40 ${aiBadge.borderColor} ${aiBadge.textColor}`}
          title="AI Natural Language Status"
        >
          <span className="relative flex h-2 w-2">
            {aiBadge.pulse && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${aiBadge.dotColor}`} />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${aiBadge.dotColor}`} />
          </span>
          <span>{aiBadge.label}</span>
        </div>
      </div>
    </header>
  );
};

export default JarvisHeader;
