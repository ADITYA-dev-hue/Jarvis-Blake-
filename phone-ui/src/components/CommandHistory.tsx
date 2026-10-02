import React from 'react';
import { CheckCircle2, XCircle, Trash2, Clock } from 'lucide-react';
import { HistoryItem } from '../types/command';

interface CommandHistoryProps {
  history: HistoryItem[];
  onClear: () => void;
}

export const CommandHistory: React.FC<CommandHistoryProps> = ({ history, onClear }) => {
  return (
    <div className="w-full bg-slate-900/60 border border-cyan-500/20 rounded-2xl p-4 backdrop-blur-md shadow-lg shadow-black/40 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <h2 className="text-xs font-mono font-semibold tracking-wider text-cyan-300 uppercase">
            Recent Commands
          </h2>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-mono text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
            title="Clear history"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* History Items List */}
      {history.length === 0 ? (
        <div className="py-6 text-center text-slate-500 font-mono text-xs">
          No commands yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
          {history.map((item) => (
            <div
              key={item.id}
              className={`flex items-start justify-between p-2.5 rounded-xl border backdrop-blur-sm font-mono text-xs transition-colors ${
                item.success
                  ? 'bg-slate-950/40 border-slate-800/80 hover:border-cyan-500/30'
                  : 'bg-rose-950/20 border-rose-900/30 hover:border-rose-700/40'
              }`}
            >
              <div className="flex items-start gap-2">
                {item.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="flex flex-col">
                  {/* User Request or Label */}
                  <span className={`font-medium ${item.success ? 'text-slate-200' : 'text-rose-300'}`}>
                    {item.userText ? `"${item.userText}"` : item.label}
                  </span>

                  {/* Interpreted Action Pill & Source */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {item.source === 'voice' ? (
                      <span className="text-[9px] text-cyan-300 bg-cyan-950/80 px-1 py-0.2 rounded border border-cyan-700/60 font-semibold tracking-wider flex items-center gap-0.5">
                        🎙️ VOICE
                      </span>
                    ) : item.source === 'text' ? (
                      <span className="text-[9px] text-slate-400 bg-slate-900 px-1 py-0.2 rounded border border-slate-700 font-semibold tracking-wider flex items-center gap-0.5">
                        ⌨️ TEXT
                      </span>
                    ) : null}

                    <span className="text-[10px] text-cyan-400/80 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-800/40">
                      {item.interpretedAction || item.action}
                    </span>
                    {!item.success && (
                      <span className="text-[10px] text-rose-400 font-semibold">
                        Blocked
                      </span>
                    )}
                  </div>

                  {item.error && (
                    <span className="text-[10px] text-rose-400/90 max-w-[200px] truncate mt-0.5" title={item.error}>
                      {item.error}
                    </span>
                  )}
                </div>
              </div>

              <span className="text-[10px] text-slate-500 shrink-0 mt-0.5">
                {item.timestamp}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommandHistory;
