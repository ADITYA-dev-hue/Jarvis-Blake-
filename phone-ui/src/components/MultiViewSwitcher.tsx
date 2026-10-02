import React from 'react';
import { Monitor, Smartphone, Columns } from 'lucide-react';
import audioFx from '../services/audioFx';

export type ViewMode = 'desktop' | 'mobile' | 'dual';

interface MultiViewSwitcherProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  className?: string;
}

export const MultiViewSwitcher: React.FC<MultiViewSwitcherProps> = ({
  currentMode,
  onModeChange,
  className = ''
}) => {
  const handleSelect = (mode: ViewMode) => {
    audioFx.playTabSwitch();
    onModeChange(mode);
  };

  return (
    <div
      className={`inline-flex items-center gap-1 p-1 bg-black/80 backdrop-blur-xl border border-red-900/50 rounded-xl shadow-[0_0_20px_rgba(255,30,68,0.25)] ${className}`}
    >
      {/* Desktop Mode Button */}
      <button
        onClick={() => handleSelect('desktop')}
        title="Desktop Command Dashboard (Alt+1)"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all ${
          currentMode === 'desktop'
            ? 'bg-red-950/80 text-white border border-red-500 shadow-[0_0_12px_rgba(255,30,68,0.5)]'
            : 'text-slate-400 hover:text-white hover:bg-slate-900/60 border border-transparent'
        }`}
      >
        <Monitor className="w-3.5 h-3.5 text-red-400" />
        <span className="hidden sm:inline">DESKTOP</span>
      </button>

      {/* Mobile Phone Mode Button */}
      <button
        onClick={() => handleSelect('mobile')}
        title="Phone Remote Controller (Alt+2)"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all ${
          currentMode === 'mobile'
            ? 'bg-red-950/80 text-white border border-red-500 shadow-[0_0_12px_rgba(255,30,68,0.5)]'
            : 'text-slate-400 hover:text-white hover:bg-slate-900/60 border border-transparent'
        }`}
      >
        <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline">PHONE</span>
      </button>

      {/* Dual Multi-View Mode Button */}
      <button
        onClick={() => handleSelect('dual')}
        title="Side-by-Side Dual Multi-View (Alt+3)"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all ${
          currentMode === 'dual'
            ? 'bg-gradient-to-r from-red-950/90 to-cyan-950/90 text-white border border-red-500 shadow-[0_0_15px_rgba(255,30,68,0.6)]'
            : 'text-slate-400 hover:text-white hover:bg-slate-900/60 border border-transparent'
        }`}
      >
        <Columns className="w-3.5 h-3.5 text-amber-400" />
        <span className="hidden sm:inline">MULTI-VIEW</span>
      </button>
    </div>
  );
};

export default MultiViewSwitcher;
