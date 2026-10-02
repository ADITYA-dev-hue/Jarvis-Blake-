import React, { useState, useEffect } from 'react';
import {
  Mic,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import audioFx from '../../services/audioFx';
import speechRecognition from '../../services/speechRecognition';
import ttsService from '../../services/textToSpeech';

type BlakeState = 'LISTENING' | 'PROCESSING' | 'EXECUTING' | 'COMPLETE';

interface AskBlakeScreenProps {
  onClose: () => void;
  onSendAiCommand: (text: string, source: 'text' | 'voice') => Promise<any>;
  isExecuting: boolean;
  stepMessage: string | null;
}

export const AskBlakeScreen: React.FC<AskBlakeScreenProps> = ({
  onClose,
  onSendAiCommand,
  isExecuting,
  stepMessage
}) => {
  const [blakeState, setBlakeState] = useState<BlakeState>('LISTENING');
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [speakResponses, setSpeakResponses] = useState(true);

  const [conversation, setConversation] = useState<{ role: 'user' | 'blake'; text: string; time: string }[]>([
    {
      role: 'blake',
      text: "Systems synchronized. Speak or input your directive, and I shall enforce your will.",
      time: 'Just now'
    }
  ]);

  const [eqBars, setEqBars] = useState<number[]>([40, 70, 30, 85, 95, 60, 80, 50, 90, 65, 45, 75]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isRecording || isExecuting) {
        setEqBars((prev) => prev.map(() => Math.floor(Math.random() * 70) + 25));
      }
    }, 150);
    return () => clearInterval(timer);
  }, [isRecording, isExecuting]);

  // Synchronize execution state with visual state
  useEffect(() => {
    if (isExecuting) {
      setBlakeState('EXECUTING');
    }
  }, [isExecuting]);

  const handleStartVoice = () => {
    audioFx.playMicPulse();
    setIsRecording(true);
    setBlakeState('LISTENING');

    speechRecognition.setCallbacks({
      onFinalResult: (transcript: string) => {
        setIsRecording(false);
        handleSendPrompt(transcript, 'voice');
      },
      onError: () => {
        setIsRecording(false);
        audioFx.playAlert();
      },
      onEnd: () => {
        setIsRecording(false);
      }
    });

    speechRecognition.start();
  };

  const handleStopVoice = () => {
    speechRecognition.stop();
    setIsRecording(false);
  };

  const handleSendPrompt = async (promptText: string, source: 'text' | 'voice' = 'text') => {
    if (!promptText.trim()) return;
    const text = promptText.trim();
    setInputText('');
    audioFx.playClick();

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setConversation((prev) => [...prev, { role: 'user', text, time: timeStr }]);
    setBlakeState('PROCESSING');

    try {
      const res = await onSendAiCommand(text, source);
      setBlakeState('COMPLETE');

      if (res && res.success === false) {
        audioFx.playAlert();
        const failReply = res.message || `Security or validation failure on request: "${text}". Protocol halted.`;
        setConversation((prev) => [...prev, { role: 'blake', text: failReply, time: timeStr }]);
        if (speakResponses) {
          ttsService.speak(failReply, 'en-IN');
        }
      } else {
        audioFx.playSuccess();
        const blakeReply = res?.message || `Directive acknowledged. Protocol executed successfully for "${text}".`;
        setConversation((prev) => [...prev, { role: 'blake', text: blakeReply, time: timeStr }]);

        if (speakResponses) {
          ttsService.speak(blakeReply, 'en-IN');
        }
      }
    } catch {
      setBlakeState('COMPLETE');
      audioFx.playAlert();
      const failReply = `Security or validation failure on request: "${text}". Protocol halted.`;
      setConversation((prev) => [...prev, { role: 'blake', text: failReply, time: timeStr }]);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#03060c]/98 backdrop-blur-2xl z-50 flex flex-col justify-between p-4 font-sans select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-red-950/60 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-950/60 border border-red-700/60 flex items-center justify-center text-red-400">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="font-mono text-sm font-bold tracking-widest text-white glow-text-red">
              ASK BLAKE
            </h2>
            <span className="font-mono text-[9px] text-red-400">AI COMMAND ASSISTANT</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSpeakResponses(!speakResponses)}
            className="p-2 rounded-lg bg-black/60 border border-slate-800 text-slate-400 hover:text-white"
            title={speakResponses ? "Voice Output: Active" : "Voice Output: Muted"}
          >
            {speakResponses ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-red-950/40 border border-red-900/60 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Central Holographic Core & State Indicator */}
      <div className="my-auto flex flex-col items-center justify-center py-4 relative z-10">
        <div className="relative w-48 h-48 flex items-center justify-center">
          <div
            className={`absolute inset-0 rounded-full border-2 border-dashed transition-all duration-700 ${
              blakeState === 'LISTENING'
                ? 'border-red-500 animate-spin-medium shadow-[0_0_25px_rgba(239,68,68,0.5)]'
                : blakeState === 'PROCESSING'
                ? 'border-cyan-400 animate-spin-reverse-fast shadow-[0_0_30px_rgba(6,182,212,0.6)]'
                : blakeState === 'EXECUTING'
                ? 'border-amber-400 animate-spin-slow shadow-[0_0_30px_rgba(245,158,11,0.6)]'
                : 'border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.5)]'
            }`}
          />

          <div className="absolute inset-3 rounded-full border border-dotted border-red-400/60 animate-spin-reverse-slow" />

          <div
            onClick={isRecording ? handleStopVoice : handleStartVoice}
            className={`w-28 h-28 rounded-full bg-black/90 border-2 flex flex-col items-center justify-center cursor-pointer transition-all ${
              blakeState === 'LISTENING'
                ? 'border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.8)]'
                : blakeState === 'PROCESSING'
                ? 'border-cyan-400 shadow-[0_0_35px_rgba(6,182,212,0.8)]'
                : blakeState === 'EXECUTING'
                ? 'border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.8)]'
                : 'border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.8)]'
            }`}
          >
            <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse drop-shadow-[0_0_12px_rgba(6,182,212,0.9)]" />
            <span className="font-mono text-xs font-bold text-white mt-1 tracking-wider glow-text-red">
              IGRIS
            </span>
            <span className="font-mono text-[8px] text-red-400 uppercase tracking-widest mt-0.5">
              BLAKE
            </span>
          </div>
        </div>

        {/* Current State Label Badge */}
        <div className="mt-4 flex flex-col items-center gap-1.5">
          <div
            className={`px-3 py-1 rounded-full border font-mono text-xs font-bold tracking-widest flex items-center gap-2 ${
              blakeState === 'LISTENING'
                ? 'bg-red-950/80 border-red-600 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                : blakeState === 'PROCESSING'
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                : blakeState === 'EXECUTING'
                ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                : 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-ping" />
            <span>STATE: {blakeState}</span>
          </div>

          {stepMessage && (
            <span className="font-mono text-[10px] text-amber-400 animate-pulse mt-0.5">
              {stepMessage}
            </span>
          )}

          <div className="flex items-end gap-1 h-6 mt-1">
            {eqBars.map((h, i) => (
              <div
                key={i}
                className="w-1 bg-gradient-to-t from-red-600 to-cyan-400 rounded-t transition-all duration-200"
                style={{ height: `${(h / 100) * 24}px` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Conversation History Stream */}
      <div className="flex-1 max-h-48 overflow-y-auto flex flex-col gap-2 p-2 rounded-xl bg-black/60 border border-slate-900 my-2 text-xs font-mono">
        {conversation.map((msg, idx) => (
          <div
            key={idx}
            className={`p-2.5 rounded-xl max-w-[85%] ${
              msg.role === 'user'
                ? 'self-end bg-red-950/70 border border-red-800 text-white'
                : 'self-start bg-slate-900/90 border border-slate-800 text-slate-200'
            }`}
          >
            <span className="text-[9px] text-red-400 font-bold block mb-0.5">
              {msg.role === 'user' ? 'YOU' : 'BLAKE'}
            </span>
            <span>{msg.text}</span>
          </div>
        ))}
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
        {[
          'Open Chrome',
          'Check laptop status',
          'Lock my PC',
          'Open VS Code',
          'Set volume to 50%'
        ].map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSendPrompt(chip, 'text')}
            className="px-2.5 py-1 rounded-full bg-black/60 hover:bg-red-950 border border-slate-800 hover:border-red-600 text-[10px] font-mono text-slate-300 hover:text-white shrink-0 transition-colors"
          >
            "{chip}"
          </button>
        ))}
      </div>

      {/* Bottom Input Console */}
      <div className="flex items-center gap-2 pt-2 border-t border-red-950/60 z-10">
        <button
          onClick={isRecording ? handleStopVoice : handleStartVoice}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
            isRecording
              ? 'bg-red-600 text-white animate-pulse shadow-[0_0_20px_#ef4444]'
              : 'bg-red-950/60 text-red-400 hover:bg-red-900/60 hover:text-white border border-red-700/60'
          }`}
          title={isRecording ? "Stop Listening" : "Tap to Speak"}
        >
          <Mic className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt(inputText, 'text')}
          placeholder="Ask Blake... (e.g. 'Open GitHub')"
          className="flex-1 bg-black/70 border border-slate-800 rounded-xl px-3 py-2.5 font-mono text-xs text-white placeholder-slate-500 outline-none focus:border-red-500"
        />

        <button
          onClick={() => handleSendPrompt(inputText, 'text')}
          disabled={!inputText.trim()}
          className="w-11 h-11 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.5)] transition-all"
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </div>
    </div>
  );
};

export default AskBlakeScreen;
