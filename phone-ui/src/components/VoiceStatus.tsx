import React, { useState, useEffect } from 'react';
import { Mic, Radio, Loader2, Volume2, AlertCircle } from 'lucide-react';
import voiceStateService from '../services/voiceStateService';
import { MicPrivacyState, VoiceState } from '../types/voice';

interface VoiceStatusProps {
  onTap?: () => void;
  className?: string;
}

export const VoiceStatus: React.FC<VoiceStatusProps> = ({ onTap, className = '' }) => {
  const [voiceState, setVoiceState] = useState<VoiceState>(voiceStateService.getState());
  const [statusText, setStatusText] = useState<string>(voiceStateService.getStatusMessage());
  const [privacyState, setPrivacyState] = useState<MicPrivacyState>(voiceStateService.getPrivacyState());

  useEffect(() => {
    return voiceStateService.subscribe((state, message, privacy) => {
      setVoiceState(state);
      setStatusText(message);
      setPrivacyState(privacy);
    });
  }, []);

  const getPillStyle = () => {
    switch (voiceState) {
      case 'LISTENING':
        return 'border-red-600 bg-red-950/70 text-red-300 shadow-[0_0_12px_rgba(255,30,68,0.4)] animate-pulse';
      case 'PROCESSING':
      case 'EXECUTING':
        return 'border-amber-600 bg-amber-950/70 text-amber-300';
      case 'SPEAKING':
        return 'border-cyan-600 bg-cyan-950/70 text-cyan-300';
      case 'ERROR':
        return 'border-rose-600 bg-rose-950/70 text-rose-300';
      case 'STANDBY':
      default:
        return 'border-red-950/80 bg-black/70 text-slate-400';
    }
  };

  return (
    <button
      onClick={onTap || (() => voiceStateService.triggerManualListening())}
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono transition-all select-none ${getPillStyle()} ${className}`}
      title="Click to activate voice"
    >
      {voiceState === 'LISTENING' ? (
        <Radio className="w-3.5 h-3.5 text-red-400 animate-spin" />
      ) : voiceState === 'PROCESSING' || voiceState === 'EXECUTING' ? (
        <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
      ) : voiceState === 'SPEAKING' ? (
        <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
      ) : voiceState === 'ERROR' ? (
        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
      ) : (
        <Mic className="w-3.5 h-3.5 text-slate-400" />
      )}
      <span className="font-semibold text-[11px] truncate max-w-[180px] sm:max-w-xs">
        {voiceState === 'STANDBY' ? 'Say "IGRIS"' : statusText}
      </span>
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          privacyState === 'MIC_LISTENING'
            ? 'bg-red-500 animate-ping'
            : privacyState === 'MIC_STANDBY'
            ? 'bg-emerald-500'
            : 'bg-slate-600'
        }`}
      />
    </button>
  );
};

export default VoiceStatus;
