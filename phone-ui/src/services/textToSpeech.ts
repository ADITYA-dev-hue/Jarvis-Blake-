/**
 * JARVIS Phase 4 - Text-to-Speech Service
 * 
 * Provides typed, clean audio feedback using native browser window.speechSynthesis.
 * 
 * Features:
 * - Duplicate speech prevention (cancels prior speech before speaking)
 * - Voice interruption support
 * - Text sanitization (strips JSON/code artifacts for natural speech)
 * - Safe detection of browser compatibility
 */

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
   * Speak a human-readable text string aloud
   * 
   * @param text Natural language sentence to speak
   * @param lang BCP 47 language tag (default: 'en-IN')
   */
  public speak(text: string, lang: string = 'en-IN'): void {
    if (!this.isSupported()) {
      console.warn('[TTS] SpeechSynthesis is not supported in this browser.');
      return;
    }

    if (!text || typeof text !== 'string') {
      return;
    }

    // Clean text: strip code blocks, markdown, or JSON traces
    const cleaned = this.sanitizeTextForSpeech(text);
    if (!cleaned) return;

    // Duplicate speech prevention within 1 second
    const now = Date.now();
    if (this.lastSpokenText === cleaned && now - this.lastSpokenTime < 1000) {
      console.log('[TTS] Duplicate speech prevented.');
      return;
    }

    this.lastSpokenText = cleaned;
    this.lastSpokenTime = now;

    try {
      // Section 25: cancel active speech before starting new speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = lang;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select an appropriate English voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const matchingVoice =
          voices.find((v) => v.lang === lang) ||
          voices.find((v) => v.lang.startsWith('en-IN')) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          voices[0];
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }
      }

      utterance.onerror = (ev) => {
        // 'interrupted' and 'canceled' are normal when stop() is called
        if (ev.error !== 'interrupted' && ev.error !== 'canceled') {
          console.warn('[TTS] Speech utterance error:', ev.error);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('[TTS] Error invoking speech synthesis:', err);
    }
  }

  /**
   * Sanitize text to sound natural and clear over speech synthesis
   */
  private sanitizeTextForSpeech(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, '') // remove code fences
      .replace(/`([^`]+)`/g, '$1') // remove inline code marks
      .replace(/\{[\s\S]*?\}/g, '') // strip raw JSON objects
      .replace(/https?:\/\/(?:www\.)?([^\s/]+)[^\s]*/gi, '$1') // read domain instead of full URL
      .replace(/[#*_~[\]()]/g, ' ') // strip markdown characters
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const ttsService = new TextToSpeechService();
export default ttsService;
