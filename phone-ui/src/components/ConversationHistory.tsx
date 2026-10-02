import React, { useState } from 'react';
import {
  MessageSquare,
  Trash2,
  Mic,
  Keyboard,
  Bot,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { ConversationMessage } from '../types/conversation';

interface ConversationHistoryProps {
  messages: ConversationMessage[];
  onClear: () => Promise<void>;
  isLoading?: boolean;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  messages,
  onClear,
  isLoading
}) => {
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      await onClear();
    } finally {
      setIsClearing(false);
      setShowConfirm(false);
    }
  };

  const formatTime = (ts: number): string => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full bg-[#070d19]/90 backdrop-blur-md rounded-2xl border border-cyan-950/70 shadow-lg shadow-black/40 p-4 flex flex-col gap-3 transition-all duration-300">
      {/* Header with Title and Clear Action */}
      <div className="flex items-center justify-between border-b border-cyan-950/60 pb-2.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-mono font-semibold tracking-wider text-cyan-300 uppercase">
            Conversation Context
          </h2>
          {messages.length > 0 && (
            <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
              {messages.length} msg{messages.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {messages.length > 0 && (
          <div className="relative">
            {!showConfirm ? (
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={isLoading || isClearing}
                className="text-[11px] font-mono text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-rose-950/20"
                title="Clear Conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-rose-950/40 border border-rose-800/60 rounded-lg p-1 animate-in fade-in duration-150">
                <AlertTriangle className="w-3 h-3 text-rose-400 ml-1" />
                <button
                  type="button"
                  onClick={handleConfirmClear}
                  disabled={isClearing}
                  className="text-[10px] font-mono text-rose-300 font-semibold hover:text-white px-1.5 py-0.5 rounded bg-rose-900/60 hover:bg-rose-800 transition-colors"
                >
                  {isClearing ? 'Clearing...' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  disabled={isClearing}
                  className="text-[10px] font-mono text-slate-400 hover:text-slate-200 px-1 py-0.5"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages List Area */}
      {messages.length === 0 ? (
        <div className="py-8 text-center text-slate-500 font-mono text-xs flex flex-col items-center gap-2">
          <Bot className="w-8 h-8 text-cyan-900" />
          <span>No conversation yet.</span>
          <span className="text-[11px] text-slate-600">
            Speak or type a command to start a dialogue with IGRIS.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1 select-text">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1 w-full`}
              >
                {/* Role and Source Badge */}
                <div className="flex items-center gap-1.5 px-1 text-[10px] font-mono">
                  {isUser ? (
                    <>
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <User className="w-3 h-3 text-cyan-400" />
                        YOU
                      </span>
                      <span className="text-slate-600">&bull;</span>
                      {msg.source === 'voice' ? (
                        <span className="text-cyan-300 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-800/60 font-semibold tracking-wider flex items-center gap-0.5">
                          <Mic className="w-2.5 h-2.5" /> VOICE
                        </span>
                      ) : (
                        <span className="text-slate-400 bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800 font-semibold tracking-wider flex items-center gap-0.5">
                          <Keyboard className="w-2.5 h-2.5" /> TEXT
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-cyan-400 font-medium flex items-center gap-1">
                        <Bot className="w-3 h-3 text-cyan-400" />
                        IGRIS
                      </span>
                      {msg.action && (
                        <>
                          <span className="text-slate-600">&bull;</span>
                          <span className="text-[9px] text-cyan-400/80 bg-cyan-950/50 px-1 py-0.2 rounded border border-cyan-800/40">
                            {msg.action}
                          </span>
                        </>
                      )}
                    </>
                  )}
                  <span className="text-slate-600 ml-1">{formatTime(msg.timestamp)}</span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs font-sans leading-relaxed transition-colors ${
                    isUser
                      ? 'bg-gradient-to-r from-cyan-950/70 to-blue-950/70 border border-cyan-500/30 text-slate-100 rounded-tr-sm shadow-md shadow-cyan-950/30'
                      : msg.success === false
                      ? 'bg-rose-950/30 border border-rose-900/50 text-rose-200 rounded-tl-sm shadow-md shadow-rose-950/20'
                      : 'bg-slate-900/80 border border-slate-800 text-slate-200 rounded-tl-sm shadow-md shadow-black/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!isUser && msg.success === false && (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    {!isUser && msg.success === true && msg.action && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConversationHistory;
