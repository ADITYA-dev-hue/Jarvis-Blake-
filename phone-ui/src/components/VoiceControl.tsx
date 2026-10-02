import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Settings2
} from 'lucide-react';
import speechService from '../services/speechRecognition';
import ttsService from '../services/textToSpeech';
import { MicState, VoiceSettings } from '../types/voice';

interface VoiceControlProps {
  onSendVoiceCommand: (transcript: string) => Promise<void>;
  isProcessing: boolean;
  disabled: boolean;
  lastResponse?: {
    userText?: string;
    message?: string;
    success?: boolean;
  } | null;
  settings: VoiceSettings;
  onUpdateSettings: (newSettings: Partial<VoiceSettings>) => void;
}

export const VoiceControl: React.FC<VoiceControlProps> = ({
  onSendVoiceCommand,
  isProcessing,
  disabled,
  lastResponse,
  settings,
  onUpdateSettings
}) => {
  const [micState, setMicState] = useState<MicState>('IDLE');
  const [interimText, setInterimText] = useState<string>('');
  const [finalText, setFinalText] = useState<string>('');
  const [statusText, setStatusText] = useState<string>('Tap to speak');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  // Reference to prevent stale closures in recognition callbacks
  const isProcessingRef = useRef(isProcessing);
  useEffect(() => {
    isProcessingRef.current = isProcessing;
    if (isProcessing) {
      setMicState('PROCESSING');
      setStatusText('Processing command...');
    } else if (micState === 'PROCESSING') {
      if (lastResponse) {
        if (lastResponse.success !== false) {
          setMicState('SUCCESS');
          setStatusText('Command completed ✓');
        } else {
          setMicState('ERROR');
          setStatusText('Could not complete command');
        }
      } else {
        setMicState('IDLE');
        setStatusText('Tap to speak');
      }
      const resetTimer = setTimeout(() => {
        setMicState('IDLE');
        setStatusText('Tap to speak');
      }, 2500);
      return () => clearTimeout(resetTimer);
    }
  }, [isProcessing, lastResponse]);

  // Check Web Speech API support
  useEffect(() => {
    const supported = speechService.isSupported();
    setIsSupported(supported);
    if (!supported) {
      setStatusText('Voice input is not supported in this browser.');
    }
  }, []);

  // Update speech service language when settings change
  useEffect(() => {
    speechService.setLanguage(settings.language);
  }, [settings.language]);

  // Set up speech recognition callbacks
  useEffect(() => {
    speechService.setCallbacks({
      onStart: () => {
        setMicState('LISTENING');
        setStatusText('Listening...');
        setErrorMessage(null);
        setInterimText('');
        setFinalText('');
      },
      onResult: (interim) => {
        setInterimText(interim);
      },
      onFinalResult: (final) => {
        setFinalText(final);
        setInterimText('');
      },
      onEnd: () => {
        // Recognition completed
        setMicState((prev) => {
          if (prev === 'LISTENING') {
            return 'IDLE';
          }
          return prev;
        });

        // If we captured a final transcript and are not already processing, dispatch it
        setFinalText((capturedFinal) => {
          if (capturedFinal.trim() && !isProcessingRef.current) {
            setMicState('PROCESSING');
            setStatusText('Understanding...');
            onSendVoiceCommand(capturedFinal.trim()).catch((err) => {
              console.error('[Voice] Command dispatch error:', err);
              setMicState('ERROR');
              setErrorMessage('Failed to send command.');
            });
          } else if (!capturedFinal.trim()) {
            setStatusText('Tap to speak');
          }
          return capturedFinal;
        });
      },
      onError: (errMsg) => {
        setMicState('ERROR');
        setStatusText('Speech recognition error');
        setErrorMessage(errMsg);
        const timer = setTimeout(() => {
          setMicState('IDLE');
          setStatusText('Tap to speak');
          setErrorMessage(null);
        }, 4000);
        return () => clearTimeout(timer);
      }
    });
  }, [onSendVoiceCommand]);

  // Handle Microphone Button Click
  const handleToggleMic = () => {
    if (!isSupported) {
      setErrorMessage('Voice input is not supported in this browser.');
      return;
    }

    if (!settings.voiceEnabled) {
      setErrorMessage('Voice input is disabled in settings.');
      return;
    }

    if (disabled) {
      setErrorMessage('IGRIS server is offline.');
      return;
    }

    // Section 26: Voice interruption
    // If JARVIS is currently speaking, stop speech immediately
    ttsService.stop();

    if (micState === 'LISTENING') {
      // User tapped again to stop listening
      speechService.stop();
    } else if (micState !== 'PROCESSING') {
      setErrorMessage(null);
      setInterimText('');
      setFinalText('');
      speechService.start();
    }
  };

  const getStatusIndicator = () => {
    switch (micState) {
      case 'LISTENING':
        return (
          <div className="flex items-center gap-2 text-rose-400 font-mono text-xs tracking-wider">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span className="animate-pulse">LISTENING...</span>
          </div>
        );
      case 'PROCESSING':
        return (
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs tracking-wider">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            <span>PROCESSING...</span>
          </div>
        );
      case 'SUCCESS':
        return (
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>COMPLETED</span>
          </div>
        );
      case 'ERROR':
        return (
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs tracking-wider">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>ERROR</span>
          </div>
        );
      case 'IDLE':
      default:
        return (
          <div className="flex items-center gap-2 text-slate-400 font-mono text-xs tracking-wider">
            <Radio className="w-3.5 h-3.5 text-cyan-500/70" />
            <span>IGRIS VOICE READY</span>
          </div>
        );
    }
  };

  return (
    <div className="w-full bg-[#070d19]/90 backdrop-blur-md rounded-2xl border border-cyan-950/70 shadow-lg shadow-cyan-950/20 p-5 flex flex-col items-center relative overflow-hidden transition-all duration-300">
      {/* Background cyber grid & glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 via-transparent to-blue-950/20 pointer-events-none" />
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top Bar: Title & Settings Toggle */}
      <div className="w-full flex items-center justify-between z-10 mb-2">
        <div className="flex items-center gap-2">
          {getStatusIndicator()}
        </div>
        <button
          onClick={() => setShowSettings((prev) => !prev)}
          className={`p-1.5 rounded-lg border transition-colors ${
            showSettings
              ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
              : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Voice Settings"
          aria-label="Voice Settings"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Voice Settings Dropdown / Panel */}
      {showSettings && (
        <div className="w-full bg-[#0a1324] border border-cyan-900/60 rounded-xl p-3 mb-4 z-10 text-xs font-mono text-slate-300 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-300">
              {settings.voiceEnabled ? <Mic className="w-3.5 h-3.5 text-cyan-400" /> : <MicOff className="w-3.5 h-3.5 text-slate-500" />}
              Voice Input
            </span>
            <button
              onClick={() => onUpdateSettings({ voiceEnabled: !settings.voiceEnabled })}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                settings.voiceEnabled
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {settings.voiceEnabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-300">
              {settings.autoSpeakResponses ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
              Auto Speak Responses
            </span>
            <button
              onClick={() => onUpdateSettings({ autoSpeakResponses: !settings.autoSpeakResponses })}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                settings.autoSpeakResponses
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {settings.autoSpeakResponses ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="text-slate-400">Language</span>
            <select
              value={settings.language}
              onChange={(e) => onUpdateSettings({ language: e.target.value })}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
            >
              <option value="en-IN">English (India) [en-IN]</option>
              <option value="en-US">English (US) [en-US]</option>
              <option value="en-GB">English (UK) [en-GB]</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Circular Futuristic Microphone Button */}
      <div className="relative my-4 flex items-center justify-center z-10">
        {/* Animated pulse rings during listening */}
        {micState === 'LISTENING' && (
          <>
            <div className="absolute w-28 h-28 rounded-full border border-rose-500/40 animate-ping pointer-events-none" />
            <div className="absolute w-36 h-36 rounded-full border border-rose-500/20 animate-pulse pointer-events-none" />
          </>
        )}

        {/* Processing orbital glow */}
        {micState === 'PROCESSING' && (
          <div className="absolute w-28 h-28 rounded-full border border-cyan-400/50 border-t-transparent animate-spin pointer-events-none" />
        )}

        <button
          onClick={handleToggleMic}
          disabled={!isSupported || disabled || !settings.voiceEnabled}
          className={`relative group w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl focus:outline-none ${
            !isSupported || disabled || !settings.voiceEnabled
              ? 'bg-slate-900 border-2 border-slate-800 text-slate-600 cursor-not-allowed'
              : micState === 'LISTENING'
              ? 'bg-gradient-to-b from-rose-950 to-red-900 border-2 border-rose-400 text-white shadow-[0_0_35px_rgba(244,63,94,0.4)] scale-105'
              : micState === 'PROCESSING'
              ? 'bg-gradient-to-b from-cyan-950 to-blue-900 border-2 border-cyan-400 text-cyan-200 shadow-[0_0_35px_rgba(0,243,255,0.3)] animate-pulse'
              : micState === 'SUCCESS'
              ? 'bg-gradient-to-b from-emerald-950 to-green-900 border-2 border-emerald-400 text-emerald-200 shadow-[0_0_30px_rgba(52,211,153,0.3)]'
              : micState === 'ERROR'
              ? 'bg-gradient-to-b from-amber-950 to-amber-900 border-2 border-amber-400 text-amber-200 shadow-[0_0_30px_rgba(251,191,36,0.3)]'
              : 'bg-gradient-to-b from-slate-900 via-[#0a172e] to-[#040e21] border-2 border-cyan-500/40 text-cyan-400 hover:border-cyan-400 hover:shadow-[0_0_30px_rgba(0,243,255,0.3)] active:scale-95'
          }`}
          aria-label={micState === 'LISTENING' ? 'Stop listening' : 'Start speaking'}
        >
          {/* Inner core reflection */}
          <div className="absolute inset-1 rounded-full bg-gradient-to-t from-transparent via-cyan-400/5 to-white/10 pointer-events-none" />

          {/* Central Icon */}
          {micState === 'LISTENING' ? (
            <Mic className="w-10 h-10 text-rose-200 animate-bounce" />
          ) : micState === 'PROCESSING' ? (
            <Loader2 className="w-9 h-9 text-cyan-300 animate-spin" />
          ) : micState === 'SUCCESS' ? (
            <CheckCircle2 className="w-10 h-10 text-emerald-300" />
          ) : micState === 'ERROR' ? (
            <AlertCircle className="w-10 h-10 text-amber-300" />
          ) : (
            <Mic className="w-9 h-9 text-cyan-400 group-hover:scale-110 transition-transform duration-200" />
          )}
        </button>
      </div>

      {/* Primary Status & Subtitle */}
      <div className="text-center z-10 max-w-xs">
        <p className="text-sm font-medium text-slate-200 tracking-wide">
          {statusText}
        </p>

        {/* Browser Unsupported Warning */}
        {!isSupported && (
          <p className="text-xs text-amber-400/90 mt-1 font-mono">
            Voice input is not supported in this browser.
          </p>
        )}

        {/* Error message */}
        {errorMessage && (
          <p className="text-xs text-rose-400/95 mt-1 font-mono">
            {errorMessage}
          </p>
        )}
      </div>

      {/* Transcript & Response Display Area */}
      {(interimText || finalText || lastResponse) && (
        <div className="w-full mt-4 bg-[#040914]/80 border border-cyan-950/90 rounded-xl p-3 z-10 text-left space-y-2">
          {/* Live speech transcription */}
          {(interimText || finalText) && (
            <div className="border-b border-cyan-950/60 pb-2">
              <span className="text-[10px] font-mono tracking-wider uppercase text-cyan-500/80 block">
                You (Voice):
              </span>
              <p className="text-sm text-slate-100 font-sans mt-0.5">
                {finalText}
                {interimText && (
                  <span className="text-cyan-400/60 italic ml-1">
                    {interimText}...
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Last JARVIS spoken response preview */}
          {lastResponse?.message && (
            <div>
              <span className="text-[10px] font-mono tracking-wider uppercase text-cyan-400 block flex items-center justify-between">
                <span>IGRIS:</span>
                {settings.autoSpeakResponses && (
                  <button
                    onClick={() => ttsService.speak(lastResponse.message || '', settings.language)}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[10px]"
                    title="Replay Voice"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Replay</span>
                  </button>
                )}
              </span>
              <p className="text-xs text-slate-300 font-sans mt-0.5 leading-relaxed">
                {lastResponse.message}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Quick Settings Bar Summary (Section 27) */}
      <div className="w-full mt-3 pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] font-mono text-slate-500 z-10 px-1">
        <span>Voice: {settings.voiceEnabled ? 'ON' : 'OFF'}</span>
        <span>Auto Speak: {settings.autoSpeakResponses ? 'ON' : 'OFF'}</span>
        <span>Lang: {settings.language}</span>
      </div>
    </div>
  );
};

export default VoiceControl;
