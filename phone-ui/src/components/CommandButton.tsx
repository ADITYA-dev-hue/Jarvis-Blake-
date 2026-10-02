import React from 'react';

interface CommandButtonProps {
  label: string;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  sublabel?: string;
}

export const CommandButton: React.FC<CommandButtonProps> = ({
  label,
  onClick,
  isLoading = false,
  disabled = false,
  icon,
  variant = 'primary',
  className = '',
  sublabel
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-slate-900/60 border-slate-700/60 text-slate-200 hover:border-cyan-500/40 hover:bg-slate-800/60 hover:text-cyan-300';
      case 'danger':
        return 'bg-rose-950/40 border-rose-600/40 text-rose-300 hover:border-rose-500 hover:bg-rose-900/50';
      case 'primary':
      default:
        return 'bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border-cyan-500/30 text-cyan-200 hover:border-cyan-400 hover:text-white hover:shadow-glow-cyan';
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`relative group flex items-center justify-center gap-2 px-4 py-3 rounded-xl border backdrop-blur-md transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none font-medium tracking-wide text-sm ${getVariantStyles()} ${className}`}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-cyan-300">
          <svg
            className="animate-spin h-4 w-4 text-cyan-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span className="font-mono text-xs tracking-wider uppercase">Executing...</span>
        </div>
      ) : (
        <>
          {icon && <span className="text-cyan-400 group-hover:scale-110 transition-transform">{icon}</span>}
          <div className="flex flex-col items-center">
            <span>{label}</span>
            {sublabel && <span className="text-[10px] text-cyan-400/60 font-mono">{sublabel}</span>}
          </div>
        </>
      )}
    </button>
  );
};

export default CommandButton;
