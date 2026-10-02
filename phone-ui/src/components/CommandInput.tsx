import React, { useState } from 'react';
import { Mic, Send, Sparkles } from 'lucide-react';
import CommandButton from './CommandButton';

interface CommandInputProps {
  onSendAiCommand: (text: string) => void;
  isLoading: boolean;
  disabled: boolean;
  stepMessage?: string | null;
}

export const CommandInput: React.FC<CommandInputProps> = ({
  onSendAiCommand,
  isLoading,
  disabled,
  stepMessage
}) => {
  const [inputVal, setInputVal] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputVal.trim();
    if (!query) return;

    onSendAiCommand(query);
    setInputVal('');
  };

  return (
    <div className="w-full bg-slate-900/60 border border-cyan-500/20 rounded-2xl p-4 backdrop-blur-md shadow-lg shadow-black/40 flex flex-col gap-3">
      {/* Voice Assistant Pill (Disabled Phase 2/3, coming Phase 4) */}
      <div className="flex items-center justify-between bg-slate-950/40 rounded-xl px-3 py-2 border border-slate-800/80">
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
            <Mic className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            Voice &mdash; Coming in Phase 4
          </span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50">
          Disabled
        </span>
      </div>

      {/* Input Form with AI Natural Language */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <div className="relative">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={disabled || isLoading}
            placeholder="Ask JARVIS anything (e.g. 'Jarvis, open GitHub')..."
            className="w-full bg-slate-950/80 border border-cyan-500/30 rounded-xl pl-4 pr-10 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all font-sans disabled:opacity-50"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400/60 pointer-events-none">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
        </div>

        {/* Live Step Progression Feedback */}
        {stepMessage && (
          <div className="text-xs font-mono text-cyan-300 bg-cyan-950/30 border border-cyan-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2 animate-in fade-in">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>{stepMessage}</span>
          </div>
        )}

        <CommandButton
          label="SEND"
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={disabled || !inputVal.trim()}
          icon={<Send className="w-4 h-4" />}
          className="w-full py-3.5"
        />
      </form>
    </div>
  );
};

export default CommandInput;
