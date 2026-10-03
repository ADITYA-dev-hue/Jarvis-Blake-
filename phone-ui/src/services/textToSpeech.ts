/**
 * JARVIS / IGRIS Phase 4 & Phase 9.5 - Text-to-Speech Service
 * 
 * Provides typed, clean audio feedback using native browser window.speechSynthesis
 * backed by the IGRIS Voice Personality Engine.
 * 
 * Features:
 * - Duplicate speech prevention (cancels prior speech before speaking)
 * - Voice interruption support
 * - Text sanitization (strips JSON/code artifacts for natural speech)
 * - Deep, commanding, calm male voice prioritization
 * - Emotional mode calibration
 * - Full backward compatibility with Phase 4 API and tests
 */

import voicePersonalityEngine from './voicePersonality';
import { EmotionalMode } from '../types/voice';

class TextToSpeechService {
  private lastSpokenText: string | null = null;
  private lastSpokenTime: number = 0;

  /**
   * Check if speech synthesis is supported in the current browser
   */
  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      'SpeechSynthesisUtterance' in window
    );
  }

  /**
   * Stop any active or queued speech immediately
   */
  public stop(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {
        console.warn('[TTS] Failed to stop speech:', err);
      }
    }
  }

  /**
   * Speak a human-readable text string aloud using the IGRIS Voice Personality
   * 
   * @param text Natural language sentence to speak
   * @param lang BCP 47 language tag (default: 'en-IN')
   * @param mode Optional emotional mode (e.g. NORMAL, COMMAND, WARNING, ERROR)
   * @param onEnd Optional completion callback when utterance finishes speaking
   */
  public speak(
    text: string,
    lang: string = 'en-IN',
    mode?: EmotionalMode,
    onEnd?: () => void
  ): void {
    if (!this.isSupported()) {
      console.warn('[TTS] SpeechSynthesis is not supported in this browser.');
      onEnd?.();
      return;
    }

    if (!text || typeof text !== 'string') {
      onEnd?.();
      return;
    }

    const settings = voicePersonalityEngine.getSettings();
    if (!settings.voiceEnabled) {
      onEnd?.();
      return;
    }

    // Clean text: strip code blocks, markdown, or JSON traces
    const cleaned = this.sanitizeTextForSpeech(text);
    if (!cleaned) {
      onEnd?.();
      return;
    }

    // Duplicate speech prevention within 1 second
    const now = Date.now();
    if (this.lastSpokenText === cleaned && now - this.lastSpokenTime < 1000) {
      console.log('[TTS] Duplicate speech prevented.');
      onEnd?.();
      return;
    }

    this.lastSpokenText = cleaned;
    this.lastSpokenTime = now;

    try {
      // Section 25: cancel active speech before starting new speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = lang || settings.language || 'en-IN';

      // Retrieve calibrated personality parameters (rate, pitch, volume)
      const params = voicePersonalityEngine.getEffectiveParameters(mode);
      utterance.rate = params.rate;
      utterance.pitch = params.pitch;
      utterance.volume = params.volume;

      // Select prioritized male/commander voice
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const preferredVoice = voicePersonalityEngine.selectBestVoice(voices, {
          ...settings,
          language: lang
        });
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      utterance.onend = () => {
        onEnd?.();
      };

      utterance.onerror = (ev) => {
        // 'interrupted' and 'canceled' are normal when stop() is called
        if (ev.error !== 'interrupted' && ev.error !== 'canceled') {
          console.warn('[TTS] Speech utterance error:', ev.error);
        }
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('[TTS] Error invoking speech synthesis:', err);
      onEnd?.();
    }
  }

  /**
   * Sanitize text to sound natural and clear over speech synthesis
   */
  public sanitizeTextForSpeech(text: string): string {
    return voicePersonalityEngine.formatForSpeech(text);
  }
}

export const ttsService = new TextToSpeechService();
export default ttsService;
