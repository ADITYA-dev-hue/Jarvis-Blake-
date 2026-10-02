import React from 'react';
import { Globe } from 'lucide-react';
import { LanguagePreference } from '../types/command';
import audioFx from '../services/audioFx';

interface LanguageSelectorProps {
  currentPref: LanguagePreference;
  activeLanguage?: string;
  onPrefChange: (pref: LanguagePreference) => void;
  className?: string;
  compact?: boolean;
}

const LANGUAGE_LABELS: Record<LanguagePreference, { label: string; badge: string }> = {
  auto: { label: 'Auto (Detect)', badge: 'AUTO' },
  en: { label: 'English', badge: 'EN' },
  hinglish: { label: 'Hinglish', badge: 'HINGLISH' },
  hi: { label: 'Hindi (हिंदी)', badge: 'HINDI' }
};

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentPref,
  activeLanguage,
  onPrefChange,
  className = '',
  compact = false
}) => {
  const handleChange = (pref: LanguagePreference) => {
    audioFx.playClick();
    onPrefChange(pref);
  };

  const displayLanguage = activeLanguage
    ? (activeLanguage === 'hinglish' ? 'Hinglish' : activeLanguage === 'hi' ? 'Hindi' : 'English')
    : (LANGUAGE_LABELS[currentPref]?.badge || 'AUTO');

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 bg-black/80 backdrop-blur-xl border border-red-950/60 rounded-xl text-xs font-mono shadow-[0_0_15px_rgba(255,30,68,0.15)] ${className}`}
    >
      <div className="flex items-center gap-1.5 text-red-400">
        <Globe className="w-3.5 h-3.5 animate-pulse text-red-500" />
        <span className="hidden sm:inline font-bold text-slate-300">LANG:</span>
        <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-950/90 text-red-300 border border-red-800/60 font-bold uppercase tracking-wider">
          {displayLanguage}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {(['auto', 'en', 'hinglish', 'hi'] as LanguagePreference[]).map((pref) => {
          const isSelected = currentPref === pref;
          return (
            <button
              key={pref}
              onClick={() => handleChange(pref)}
              title={`Switch language preference to ${LANGUAGE_LABELS[pref].label}`}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                isSelected
                  ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(255,30,68,0.6)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              {compact ? LANGUAGE_LABELS[pref].badge : LANGUAGE_LABELS[pref].badge}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LanguageSelector;
