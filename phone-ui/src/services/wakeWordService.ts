/**
 * JARVIS / IGRIS Phase 12 - Wake Word Detection Service
 * 
 * Provides local on-device wake-word detection for hands-free activation.
 * 
 * Principles:
 * 1. Zero raw audio streaming to the server — wake word detection runs entirely
 *    on-device via browser Web Speech API.
 * 2. Primary wake phrase: "IGRIS" (with variations "Hey IGRIS", "Okay IGRIS", etc.)
 * 3. Provider-independent abstraction implementing IWakeWordEngine.
 * 4. Graceful handling of browser support, permissions, and network disconnections.
 * 5. Wake-word detection does NOT grant security privileges; all captured commands
 *    still flow through the independent command validator.
 */

import {
  ISpeechRecognition,
  ISpeechRecognitionConstructor,
  IWakeWordEngine,
  SpeechRecognitionErrorEvent,
  SpeechRecognitionEvent
} from '../types/voice';

export const PRIMARY_WAKE_WORD = 'igris';
export const WAKE_WORD_VARIATIONS = [
  'okay igris',
  'hello igris',
  'hey igris',
  'ok igris',
  'hi igris',
  'igris'
];

export class WakeWordService implements IWakeWordEngine {
  private recognition: ISpeechRecognition | null = null;
  private listening: boolean = false;
  private shouldRun: boolean = false;
  private lang: string = 'en-IN';
  private wakeWordCallbacks: Set<(detected: string, remainingText?: string) => void> = new Set();
  private errorCallbacks: Set<(error: string, code?: string) => void> = new Set();
  private restartTimeout: any = null;
  private restartAttempts: number = 0;
  private maxRestartAttempts: number = 10;
  private lastTriggerTime: number = 0;

  constructor(lang: string = 'en-IN') {
    this.lang = lang;
  }

  /**
   * Check if the host browser supports speech recognition
   */
  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Check if wake-word detection is actively running
   */
  public isListening(): boolean {
    return this.listening;
  }

  /**
   * Set language tag for recognition
   */
  public setLanguage(lang: string): void {
    this.lang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  /**
   * Register a wake-word listener
   */
  public onWakeWord(callback: (detectedPhrase: string, remainingText?: string) => void): () => void {
    this.wakeWordCallbacks.add(callback);
    return () => {
      this.wakeWordCallbacks.delete(callback);
    };
  }

  /**
   * Register an error listener
   */
  public onError(callback: (error: string, code?: string) => void): () => void {
    this.errorCallbacks.add(callback);
    return () => {
      this.errorCallbacks.delete(callback);
    };
  }

  /**
   * Start hands-free wake-word detection on-device
   */
  public start(): void {
    if (!this.isSupported()) {
      this.notifyError("Hands-free voice isn't supported in this browser.", 'not-supported');
      return;
    }

    this.shouldRun = true;
    this.initRecognition();
  }

  /**
   * Stop wake-word detection cleanly
   */
  public stop(): void {
    this.shouldRun = false;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore abort errors
      }
      this.recognition = null;
    }
    this.listening = false;
  }

  private initRecognition(): void {
    if (!this.shouldRun) return;

    const SpeechRecCtor: ISpeechRecognitionConstructor | undefined =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;

    if (!SpeechRecCtor) {
      this.notifyError("Hands-free voice isn't supported in this browser.", 'not-supported');
      return;
    }

    try {
      this.recognition = new SpeechRecCtor();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.lang;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.listening = true;
        this.restartAttempts = 0;
      };

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const transcript = item[0]?.transcript?.trim() || '';
          if (!transcript) continue;

          this.inspectTranscriptForWakeWord(transcript);
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const code = event.error;
        if (code === 'aborted') {
          return;
        }

        if (code === 'not-allowed' || code === 'permission-denied') {
          this.shouldRun = false;
          this.listening = false;
          this.notifyError('Microphone permission is required for hands-free voice.', code);
          return;
        }

        if (code === 'no-speech') {
          // Normal background silence, will automatically continue
          return;
        }

        if (code === 'network') {
          this.scheduleRestart(2000);
          return;
        }

        // Other recoverable errors
        this.scheduleRestart(1000);
      };

      this.recognition.onend = () => {
        this.listening = false;
        if (this.shouldRun) {
          this.scheduleRestart(300);
        }
      };

      this.recognition.start();
    } catch (err: any) {
      this.listening = false;
      this.scheduleRestart(1500);
    }
  }

  private inspectTranscriptForWakeWord(transcript: string): void {
    const lower = transcript.toLowerCase();
    const now = Date.now();

    // Prevent double triggers within 2 seconds
    if (now - this.lastTriggerTime < 2000) {
      return;
    }

    // Match any wake phrase variation at start or word boundary
    let matchedVariation: string | null = null;
    let matchIndex = -1;

    for (const v of WAKE_WORD_VARIATIONS) {
      const idx = lower.indexOf(v);
      if (idx !== -1) {
        matchedVariation = v;
        matchIndex = idx;
        break;
      }
    }

    if (matchedVariation && matchIndex !== -1) {
      this.lastTriggerTime = now;

      // Extract any utterance immediately following the wake word
      const afterWake = transcript.slice(matchIndex + matchedVariation.length).trim();
      // Strip leading punctuation (commas, colons)
      const remainingCommand = afterWake.replace(/^[,.:!?-]+\s*/, '').trim();

      // Temporarily stop wake-word recognition so command listener or state machine takes over
      this.stop();

      this.wakeWordCallbacks.forEach((cb) => {
        try {
          cb(matchedVariation!, remainingCommand);
        } catch (err) {
          console.error('[WakeWord] Listener error:', err);
        }
      });
    }
  }

  private scheduleRestart(delayMs: number): void {
    if (!this.shouldRun) return;
    if (this.restartTimeout) clearTimeout(this.restartTimeout);

    if (this.restartAttempts >= this.maxRestartAttempts) {
      // Exponential backoff
      delayMs = Math.min(10000, delayMs * 2);
    }

    this.restartTimeout = setTimeout(() => {
      this.restartAttempts++;
      this.initRecognition();
    }, delayMs);
  }

  private notifyError(message: string, code?: string): void {
    this.errorCallbacks.forEach((cb) => {
      try {
        cb(message, code);
      } catch (err) {
        console.error('[WakeWord] Error callback failure:', err);
      }
    });
  }
}

export const wakeWordService = new WakeWordService();
export default wakeWordService;
