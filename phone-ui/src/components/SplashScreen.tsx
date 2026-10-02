import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  durationMs = 1400
}) => {
  const [fadeState, setFadeState] = useState<'visible' | 'fading' | 'hidden'>('visible');

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeState('fading');
    }, durationMs - 400);

    const finishTimer = setTimeout(() => {
      setFadeState('hidden');
      if (onFinish) onFinish();
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [durationMs, onFinish]);

  if (fadeState === 'hidden') return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[#050608] flex flex-col items-center justify-center select-none transition-opacity duration-400 ${
        fadeState === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Cinematic Cyber Glow in background */}
      <div className="absolute w-72 h-72 rounded-full bg-red-600/20 blur-[90px] pointer-events-none animate-pulse" />

      {/* Central Circular Emblem */}
      <div className="relative mb-6">
        {/* Animated holographic outer pulse ring */}
        <div className="absolute -inset-3 rounded-full border border-red-500/40 animate-ping opacity-30" />
        <div className="absolute -inset-1.5 rounded-full border border-red-500/60 animate-pulse" />

        {/* Circular Logo Image */}
        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.5)] bg-black">
          <img
            src="/jarvis_blake_logo.png"
            alt="JARVIS BLAKE"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col items-center text-center px-4">
        <h1 className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-white glow-text-red">
          JARVIS
        </h1>
        <h2 className="font-mono text-sm sm:text-base font-bold tracking-[0.35em] text-red-500 mt-1 uppercase">
          B L A K E
        </h2>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent my-2.5 opacity-80" />
        <p className="font-mono text-[10px] sm:text-xs tracking-[0.25em] text-slate-400 uppercase">
          PERSONAL CONTROL SYSTEM
        </p>

        {/* Loading status bar */}
        <div className="w-36 h-1 bg-slate-900 rounded-full mt-6 overflow-hidden border border-slate-800">
          <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full animate-[pulse_1s_infinite] w-full" />
        </div>
        <span className="font-mono text-[9px] text-red-400/80 tracking-widest uppercase mt-2">
          INITIALIZING SECURE LINK...
        </span>
      </div>
    </div>
  );
};

export default SplashScreen;
