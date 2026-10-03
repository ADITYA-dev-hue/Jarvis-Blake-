import React, { useState, useEffect } from 'react';
import {
  Mic,
  Radio,
  Loader2,
  Volume2,
  AlertCircle,
  Sliders,
  Sparkles,
  Zap,
  MessageSquare
} from 'lucide-react';
import voiceStateService from '../services/voiceStateService';
import voicePersonalityEngine from '../services/voicePersonality';
import { MicPrivacyState, VoiceSettings as VoiceSettingsType, VoiceState } from '../types/voice';

interface VoiceAssistantProps {
  onOpenSettings?: () => void;
  compact?: boolean;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  onOpenSettings,
  compact = false
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>(voiceStateService.getState());
  const [statusText, setStatusText] = useState<string>(voiceStateService.getStatusMessage());
  const [privacyState, setPrivacyState] = useState<MicPrivacyState>(voiceStateService.getPrivacyState());
  const [settings, setSettings] = useState<VoiceSettingsType>(() => voicePersonalityEngine.getSettings());

  useEffect(() => {
    // Subscribe to state machine updates
    const unsub = voiceStateService.subscribe((state, message, privacy) => {
      setVoiceState(state);
      setStatusText(message);
      setPrivacyState(privacy);
    });

    // Subscribe to voice settings changes
    const unsubSettings = voicePersonalityEngine.onSettingsChanged((s) => {
      setSettings(s);
      voiceStateService.syncSettings();
    });

    voiceStateService.syncSettings();

    return () => {
      unsub();
      unsubSettings();
    };
  }, []);

  const handleMicClick = () => {
    voiceStateService.triggerManualListening();
  };

  const handleToggleHandsFree = () => {
    const nextVal = !(settings.handsFreeEnabled ?? true);
    voicePersonalityEngine.updateSettings({ handsFreeEnabled: nextVal });
    setSettings(voicePersonalityEngine.getSettings());
    voiceStateService.syncSettings();
  };

  const handleToggleConversation = () => {
    const nextVal = !(settings.conversationMode ?? false);
    voicePersonalityEngine.updateSettings({ conversationMode: nextVal });
    setSettings(voicePersonalityEngine.getSettings());
  };

  // State visuals mapping
  const getStateColor = () => {
    switch (voiceState) {
      case 'LISTENING':
        return 'text-red-400 border-red-500/80 shadow-[0_0_20px_rgba(255,30,68,0.4)] bg-red-950/40';
      case 'PROCESSING':
      case 'EXECUTING':
        return 'text-amber-400 border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.3)] bg-amber-950/40';
      case 'SPEAKING':
        return 'text-cyan-400 border-cyan-500/80 shadow-[0_0_20px_rgba(6,182,212,0.3)] bg-cyan-950/40';
      case 'ERROR':
        return 'text-rose-400 border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.3)] bg-rose-950/40';
      case 'STANDBY':
      default:
        return 'text-slate-400 border-red-950/60 bg-[#040814]/90';
    }
  };

  const getPrivacyBadge = () => {
    switch (privacyState) {
      case 'MIC_LISTENING':
        return {
          label: 'MIC LISTENING',
          dotClass: 'bg-red-500 animate-pulse',
          badgeClass: 'text-red-400 bg-red-950/60 border-red-800/80'
        };
      case 'MIC_PROCESSING':
        return {
          label: 'MIC PROCESSING',
          dotClass: 'bg-amber-400 animate-ping',
          badgeClass: 'text-amber-300 bg-amber-950/60 border-amber-800/80'
        };
      case 'MIC_STANDBY':
        return {
          label: 'MIC STANDBY',
          dotClass: 'bg-emerald-500',
          badgeClass: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60'
        };
      case 'MIC_OFF':
      default:
        return {
          label: 'MIC OFF / STANDBY',
          dotClass: 'bg-slate-600',
          badgeClass: 'text-slate-400 bg-slate-900/60 border-slate-800'
        };
    }
  };

  const privacyBadge = getPrivacyBadge();

  return (
    <div
      className={`cyber-glass-panel rounded-2xl border transition-all duration-300 p-4 sm:p-5 flex flex-col gap-3 font-mono ${getStateColor()} ${
        compact ? 'max-w-md w-full' : 'w-full'
      }`}
    >
      {/* Top Bar: Title & Privacy Badge */}
      <div className="flex items-center justify-between pb-2 border-b border-red-950/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-950/80 border border-red-700/60 flex items-center justify-center text-red-400">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <span className="font-bold text-white text-xs tracking-wider glow-text-red">
              IGRIS VOICE ASSISTANT
            </span>
            <span className="text-[10px] text-red-400/80 block uppercase tracking-wider">
              {settings.handsFreeEnabled ? 'Hands-Free (Say "IGRIS")' : 'Manual Push-to-Talk'}
            </span>
          </div>
        </div>

        {/* Microphone Privacy Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold tracking-wider ${privacyBadge.badgeClass}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${privacyBadge.dotClass}`} />
          <span>{privacyBadge.label}</span>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="flex items-center justify-between gap-4 py-2">
        {/* Left: State Description & Status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">
              ● {voiceState}
            </span>
            {voiceState === 'LISTENING' && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            )}
            {voiceState === 'PROCESSING' && (
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
            )}
            {voiceState === 'EXECUTING' && (
              <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
            )}
            {voiceState === 'SPEAKING' && (
              <Volume2 className="w-3 h-3 text-cyan-400 animate-bounce" />
            )}
          </div>
          <p className="text-sm font-sans text-slate-200 truncate font-medium">
            {statusText}
          </p>
        </div>

        {/* Right: Big Pulse Push-to-Talk Mic Button */}
        <button
          onClick={handleMicClick}
          aria-label="Voice Activation"
          className={`w-13 h-13 rounded-2xl flex items-center justify-center border transition-all duration-300 relative group ${
            voiceState === 'LISTENING'
              ? 'bg-red-600 border-red-400 text-white shadow-[0_0_25px_rgba(255,30,68,0.7)] animate-pulse'
              : voiceState === 'SPEAKING'
              ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 hover:bg-cyan-900'
              : 'bg-red-950/60 border-red-800/80 text-red-300 hover:bg-red-900/60 hover:border-red-600'
          }`}
        >
          {voiceState === 'LISTENING' ? (
            <Radio className="w-6 h-6 animate-spin text-white" />
          ) : voiceState === 'PROCESSING' || voiceState === 'EXECUTING' ? (
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          ) : voiceState === 'SPEAKING' ? (
            <Volume2 className="w-6 h-6 text-cyan-300" />
          ) : voiceState === 'ERROR' ? (
            <AlertCircle className="w-6 h-6 text-rose-400" />
          ) : (
            <Mic className="w-6 h-6 group-hover:scale-110 transition-transform" />
          )}
        </button>
      </div>

      {/* Bottom Controls Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-red-950/40 text-[10px]">
        <div className="flex items-center gap-2">
          {/* Hands-free toggle */}
          <button
            onClick={handleToggleHandsFree}
            className={`px-2 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
              settings.handsFreeEnabled
                ? 'bg-red-950/60 border-red-700/80 text-red-200'
                : 'bg-black/40 border-slate-800 text-slate-500'
            }`}
          >
            <span>Hands-Free:</span>
            <span className="font-bold">{settings.handsFreeEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Conversation mode toggle */}
          <button
            onClick={handleToggleConversation}
            className={`px-2 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
              settings.conversationMode
                ? 'bg-cyan-950/60 border-cyan-700/80 text-cyan-200'
                : 'bg-black/40 border-slate-800 text-slate-500'
            }`}
          >
            <MessageSquare className="w-2.5 h-2.5" />
            <span>Conversation:</span>
            <span className="font-bold">{settings.conversationMode ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-red-950/40 transition-colors"
            title="Voice Personality Settings"
          >
            <Sliders className="w-3.5 h-3.5 text-red-400" />
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceAssistant;
