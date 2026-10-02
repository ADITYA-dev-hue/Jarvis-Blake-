import React, { useEffect } from 'react';
import { ToastMessage } from '../types/command';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-11/12 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const getStyles = () => {
    switch (toast.type) {
      case 'error':
        return 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.3)]';
      case 'success':
        return 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
      case 'info':
      default:
        return 'bg-cyan-950/90 border-cyan-500/50 text-cyan-200 shadow-glow-cyan';
    }
  };

  return (
    <div
      className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-2 text-xs font-mono leading-relaxed ${getStyles()}`}
    >
      <div className="flex items-center gap-2">
        {toast.type === 'error' && <span className="text-rose-400 font-bold">✕</span>}
        {toast.type === 'success' && <span className="text-emerald-400 font-bold">✓</span>}
        {toast.type === 'info' && <span className="text-cyan-400 font-bold">ℹ</span>}
        <span className="break-words">{toast.message}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="opacity-70 hover:opacity-100 text-sm px-1 leading-none select-none"
        aria-label="Dismiss toast"
      >
        ×
      </button>
    </div>
  );
};

export default Toast;
