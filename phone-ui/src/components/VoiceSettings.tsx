import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Play,
  RotateCcw,
  Sliders,
  ShieldAlert,
  Info
} from 'lucide-react';
import voicePersonalityEngine from '../services/voicePersonality';
import { VoiceSettings as VoiceSettingsType, VoiceTone, VoiceStyle } from '../types/voice';

interface VoiceSettingsProps {
  onClose?: () => void;
  compact?: boolean;
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({ onClose, compact = false }) => {
  const [settings, setSettings] = useState<VoiceSettingsType>(() =>
    voicePersonalityEngine.getSettings()
  );
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const isFallbackVoice = voicePersonalityEngine.isUsingFallbackVoice();

  // Load and subscribe to voices
  useEffect(() => {
    if (!isSupported) return;

    const updateVoiceList = () => {
      const voices = voicePersonalityEngine.getVoices();
      setAvailableVoices(voices);
    };

    updateVoiceList();
    const unsubVoices = voicePersonalityEngine.onVoicesChanged(updateVoiceList);
    const unsubSettings = voicePersonalityEngine.onSettingsChanged((newSettings) => {
      setSettings(newSettings);
    });

    return () => {
      unsubVoices();
      unsubSettings();
    };
  }, [isSupported]);

  const handleUpdate = (partial: Partial<VoiceSettingsType>) => {
    voicePersonalityEngine.updateSettings(partial);
    setSettings(voicePersonalityEngine.getSettings());
  };

  const handleReset = () => {
    voicePersonalityEngine.resetSettings();
    setSettings(voicePersonalityEngine.getSettings());
  };

  const handleTestVoice = () => {
    if (!isSupported) return;
    setIsPlayingTest(true);
    voicePersonalityEngine.previewVoice();
    setTimeout(() => {
      setIsPlayingTest(false);
    }, 3000);
  };

  if (!isSupported) {
    return (
      <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/60 text-xs font-mono text-red-300 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span>Voice output is unavailable in this browser.</span>
      </div>
    );
  }

  return (
    <div
      className={`cyber-glass-panel rounded-2xl border border-red-950/80 bg-[#040812]/95 backdrop-blur-xl p-4 sm:p-5 flex flex-col gap-4 text-xs font-mono text-slate-300 shadow-2xl shadow-red-950/20 ${
        compact ? 'max-w-md' : 'w-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-red-950/70">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-950/80 border border-red-700/60 flex items-center justify-center text-red-400">
            <Sliders className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div>
            <span className="font-bold text-white tracking-wider block text-xs glow-text-red">
              IGRIS VOICE PERSONALITY
            </span>
            <span className="text-[10px] text-red-400/90 tracking-widest uppercase">
              Male • Commander • Deep Persona
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Fallback voice indicator if applicable */}
      {isFallbackVoice && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/30 border border-amber-800/50 text-[11px] text-amber-300">
          <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span>Preferred male voice unavailable — using fallback voice.</span>
        </div>
      )}

      {/* Master Toggles */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleUpdate({ voiceEnabled: !settings.voiceEnabled })}
          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
            settings.voiceEnabled
              ? 'bg-red-950/50 border-red-600/70 text-red-200 shadow-[0_0_15px_rgba(255,30,68,0.2)]'
              : 'bg-black/50 border-slate-800 text-slate-500'
          }`}
        >
          <span className="text-[11px] font-semibold">Voice Output</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 font-bold">
            {settings.voiceEnabled ? 'ON' : 'OFF'}
          </span>
        </button>

        <button
          onClick={() => handleUpdate({ autoSpeakResponses: !settings.autoSpeakResponses })}
          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
            settings.autoSpeakResponses
              ? 'bg-red-950/50 border-red-600/70 text-red-200 shadow-[0_0_15px_rgba(255,30,68,0.2)]'
              : 'bg-black/50 border-slate-800 text-slate-500'
          }`}
        >
          <span className="text-[11px] font-semibold">Auto Speak</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 font-bold">
            {settings.autoSpeakResponses ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Phase 12 Hands-Free & Conversation Mode Toggles */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleUpdate({ handsFreeEnabled: !(settings.handsFreeEnabled ?? true) })}
          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
            (settings.handsFreeEnabled ?? true)
              ? 'bg-red-950/50 border-red-600/70 text-red-200 shadow-[0_0_15px_rgba(255,30,68,0.2)]'
              : 'bg-black/50 border-slate-800 text-slate-500'
          }`}
        >
          <div className="text-left">
            <span className="text-[11px] font-semibold block">Hands-Free</span>
            <span className="text-[9px] text-red-400">Wake Word: IGRIS</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 font-bold">
            {(settings.handsFreeEnabled ?? true) ? 'ON' : 'OFF'}
          </span>
        </button>

        <button
          onClick={() => handleUpdate({ conversationMode: !(settings.conversationMode ?? false) })}
          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
            settings.conversationMode
              ? 'bg-cyan-950/50 border-cyan-600/70 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
              : 'bg-black/50 border-slate-800 text-slate-500'
          }`}
        >
          <div className="text-left">
            <span className="text-[11px] font-semibold block">Conversation</span>
            <span className="text-[9px] text-cyan-400">Follow-up Window</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 font-bold">
            {settings.conversationMode ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Voice Selection */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] text-slate-400 flex items-center justify-between">
          <span>Synthesizer Voice</span>
          <span className="text-[10px] text-red-400">
            {settings.selectedVoice === 'auto' ? 'Auto Dynamic Male' : 'Manual'}
          </span>
        </label>
        <select
          value={settings.selectedVoice || 'auto'}
          onChange={(e) => handleUpdate({ selectedVoice: e.target.value })}
          className="bg-black/80 border border-slate-800 focus:border-red-600 rounded-lg p-2 text-slate-200 text-xs focus:outline-none"
        >
          <option value="auto">Auto Male Commander (Recommended)</option>
          {availableVoices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>

      {/* Tone & Style Presets */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-slate-400">Tone</label>
          <select
            value={settings.tone || 'calm'}
            onChange={(e) => handleUpdate({ tone: e.target.value as VoiceTone })}
            className="bg-black/80 border border-slate-800 focus:border-red-600 rounded-lg p-2 text-slate-200 text-xs focus:outline-none"
          >
            <option value="calm">Calm (Deep & Mature)</option>
            <option value="commanding">Commanding (Authoritative)</option>
            <option value="balanced">Balanced</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-slate-400">Persona Style</label>
          <select
            value={settings.style || 'commander'}
            onChange={(e) => handleUpdate({ style: e.target.value as VoiceStyle })}
            className="bg-black/80 border border-slate-800 focus:border-red-600 rounded-lg p-2 text-slate-200 text-xs focus:outline-none"
          >
            <option value="commander">IGRIS Commander</option>
            <option value="standard">Standard</option>
          </select>
        </div>
      </div>

      {/* Sliders: Rate, Pitch, Volume */}
      <div className="space-y-3 pt-2 border-t border-red-950/60">
        {/* Speed / Rate */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Speed (Rate)</span>
            <span className="text-red-400 font-bold">{(settings.rate ?? 0.9).toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.02"
            value={settings.rate ?? 0.9}
            onChange={(e) => handleUpdate({ rate: parseFloat(e.target.value) })}
            className="accent-red-500 w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Pitch */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Pitch (Depth)</span>
            <span className="text-red-400 font-bold">{(settings.pitch ?? 0.85).toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.02"
            value={settings.pitch ?? 0.85}
            onChange={(e) => handleUpdate({ pitch: parseFloat(e.target.value) })}
            className="accent-red-500 w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Volume */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Volume</span>
            <span className="text-red-400 font-bold">
              {Math.round((settings.volume ?? 1.0) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={settings.volume ?? 1.0}
            onChange={(e) => handleUpdate({ volume: parseFloat(e.target.value) })}
            className="accent-red-500 w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Action Buttons: Test Voice & Reset */}
      <div className="flex items-center justify-between pt-2 border-t border-red-950/60 gap-2">
        <button
          onClick={handleTestVoice}
          disabled={isPlayingTest}
          className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-red-950 to-red-900 border border-red-600/70 hover:border-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(255,30,68,0.3)] active:scale-95 disabled:opacity-50"
        >
          {isPlayingTest ? (
            <Volume2 className="w-3.5 h-3.5 text-red-300 animate-pulse" />
          ) : (
            <Play className="w-3.5 h-3.5 text-red-300" />
          )}
          <span>{isPlayingTest ? 'Speaking...' : 'Test Voice'}</span>
        </button>

        <button
          onClick={handleReset}
          title="Reset to IGRIS Defaults"
          className="py-2 px-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};

export default VoiceSettings;
