/**
 * JARVIS Phase 4 - Speech Recognition Service
 * 
 * Typed wrapper around browser native SpeechRecognition / webkitSpeechRecognition.
 * 
 * Features:
 * - Cross-browser detection (SpeechRecognition / webkitSpeechRecognition)
 * - Single-utterance mode (continuous = false, explicit tap only)
 * - Interim & final transcript separation
 * - Graceful error classification (permission denied, no-speech, network, etc.)
 * - Zero background listening
 */

import {
  ISpeechRecognition,
  ISpeechRecognitionConstructor,
  SpeechRecognitionCallbacks,
  SpeechRecognitionErrorEvent,
  SpeechRecognitionEvent
} from '../types/voice';

export class SpeechRecognitionService {
  private recognition: ISpeechRecognition | null = null;
  private lang: string = 'en-IN';
  private callbacks: SpeechRecognitionCallbacks = {};
  private active: boolean = false;
  private finalTranscriptAccumulator: string = '';

  constructor(lang: string = 'en-IN') {
    this.lang = lang;
  }

  /**
   * Check if browser supports either SpeechRecognition or webkitSpeechRecognition
   */
  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Set callback listeners for speech recognition events
   */
  public setCallbacks(callbacks: SpeechRecognitionCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Configure spoken language tag (e.g. 'en-IN', 'en-US')
   */
  public setLanguage(lang: string): void {
    this.lang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public getLanguage(): string {
    return this.lang;
  }

  public isListening(): boolean {
    return this.active;
  }

  /**
   * Start speech recognition explicitly upon user interaction
   */
  public start(): void {
    if (!this.isSupported()) {
      this.callbacks.onError?.(
        'Voice input is not supported in this browser.',
        'not-supported'
      );
      return;
    }

    // Stop and clean up any previous instance
    this.abort();

    const SpeechRecCtor: ISpeechRecognitionConstructor | undefined =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecCtor) {
      this.callbacks.onError?.(
        'Voice input is not supported in this browser.',
        'not-supported'
      );
      return;
    }

    try {
      this.recognition = new SpeechRecCtor();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = this.lang;
      this.recognition.maxAlternatives = 1;
      this.finalTranscriptAccumulator = '';

      this.recognition.onstart = () => {
        this.active = true;
        this.callbacks.onStart?.();
      };

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        if (finalTranscript.trim()) {
          this.finalTranscriptAccumulator = finalTranscript.trim();
          this.callbacks.onFinalResult?.(this.finalTranscriptAccumulator);
        } else if (interimTranscript.trim()) {
          this.callbacks.onResult?.(interimTranscript.trim());
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        this.active = false;
        const code = event.error;

        // User intentional abort is not an error
        if (code === 'aborted') {
          return;
        }

        let userMessage = 'Speech recognition error.';
        switch (code) {
          case 'not-allowed':
          case 'permission-denied':
            userMessage = 'Microphone permission is required for voice commands.';
            break;
          case 'no-speech':
            userMessage = 'No speech detected. Tap the microphone to try again.';
            break;
          case 'audio-capture':
            userMessage = 'Microphone is unavailable or busy.';
            break;
          case 'network':
            userMessage = 'Network error during speech recognition.';
            break;
          case 'language-not-supported':
            userMessage = `Language '${this.lang}' is not supported by this browser.`;
            break;
          default:
            userMessage = event.message || `Speech recognition failed (${code}).`;
            break;
        }

        this.callbacks.onError?.(userMessage, code);
      };

      this.recognition.onend = () => {
        this.active = false;
        this.callbacks.onEnd?.();
      };

      this.recognition.start();
    } catch (err: any) {
      this.active = false;
      const msg = err?.message || 'Failed to start microphone.';
      this.callbacks.onError?.(msg, 'exception');
    }
  }

  /**
   * Stop recognition normally (process remaining buffer)
   */
  public stop(): void {
    if (this.recognition && this.active) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore already stopped error
      }
    }
    this.active = false;
  }

  /**
   * Forcefully abort recognition without processing
   */
  public abort(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore
      }
      this.recognition = null;
    }
    this.active = false;
  }
}

export const speechService = new SpeechRecognitionService('en-IN');
export default speechService;
