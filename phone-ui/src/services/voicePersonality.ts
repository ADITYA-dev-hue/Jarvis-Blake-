/**
 * JARVIS / IGRIS Phase 9.5 - Voice Personality Engine
 * 
 * Target Personality:
 * - Male
 * - Calm
 * - Deep / mature
 * - Commanding
 * - Slightly friendly
 * - Dark & mysterious undertone
 * - Powerful but controlled
 * - Futuristic & professional
 * - Loyal / helpful
 * 
 * Architectural Guarantees:
 * 1. Strict separation of concerns (Voice != Language != Authorization != Command Execution).
 * 2. Pluggable TTS Provider interface (BrowserSpeechSynthesisProvider today, external engines tomorrow).
 * 3. Dynamic voice discovery with graceful fallback when male voice is unavailable.
 * 4. Safe local storage under 'igris_voice_settings' with zero secrets/token leakage.
 */

import {
  VoiceSettings,
  VoicePersonalityProfile,
  TTSProvider,
  EmotionalMode,
  VoiceTone
} from '../types/voice';

export const STORAGE_KEY_VOICE = 'igris_voice_settings';
export const LEGACY_STORAGE_KEY_VOICE = 'jarvis_voice_settings_v1';

export const TEST_VOICE_PHRASE = 'Systems online. I am IGRIS. How may I assist you?';

export const IGRIS_DEFAULT_VOICE_PROFILE: VoicePersonalityProfile = {
  gender: 'male',
  tone: 'calm',
  authority: 'high',
  friendliness: 'low_to_medium',
  darkness: 'medium',
  mystery: 'medium',
  emotion: 'controlled',
  energy: 'low_to_medium',
  speaking_style: 'commander'
};

export const IGRIS_DEFAULT_VOICE_SETTINGS: Required<Omit<VoiceSettings, 'emotionalMode'>> & {
  emotionalMode: EmotionalMode;
} = {
  voiceEnabled: true,
  autoSpeakResponses: true,
  language: 'en-IN',
  selectedVoice: 'auto',
  rate: 0.90, // Calibrated for deep, deliberate, commanding speech
  pitch: 0.85, // Calibrated for mature male resonance
  volume: 1.0,
  tone: 'calm',
  style: 'commander',
  emotionalMode: 'NORMAL'
};

// Known keywords indicating masculine/deep voices in browser synthesizers
const MALE_VOICE_KEYWORDS = [
  'male',
  'david',
  'guy',
  'mark',
  'george',
  'james',
  'daniel',
  'ravi',
  'rishi',
  'alex',
  'fred',
  'bruce',
  'ralph',
  'oliver',
  'thomas',
  'nathan',
  'microsoft david',
  'microsoft mark',
  'microsoft george',
  'google uk english male',
  'google us english male'
];

// Known keywords indicating feminine voices to de-prioritize for IGRIS male persona
const FEMALE_VOICE_KEYWORDS = [
  'female',
  'zira',
  'susan',
  'hazel',
  'heera',
  'kalpana',
  'catherine',
  'samantha',
  'victoria',
  'karen',
  'linda',
  'siri female',
  'google uk english female'
];

/**
 * Native Browser SpeechSynthesis Provider implementing TTSProvider interface
 */
export class BrowserSpeechSynthesisProvider implements TTSProvider {
  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      'SpeechSynthesisUtterance' in window
    );
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.isSupported()) return [];
    try {
      return window.speechSynthesis.getVoices() || [];
    } catch {
      return [];
    }
  }

  public stop(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {
        console.warn('[TTSProvider] Failed to stop synthesis:', err);
      }
    }
  }

  public pause(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.pause();
      } catch (err) {
        console.warn('[TTSProvider] Failed to pause synthesis:', err);
      }
    }
  }

  public resume(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.resume();
      } catch (err) {
        console.warn('[TTSProvider] Failed to resume synthesis:', err);
      }
    }
  }

  public speak(
    text: string,
    settings: VoiceSettings,
    onEnd?: () => void
  ): void {
    if (!this.isSupported()) {
      console.warn('[TTSProvider] SpeechSynthesis is not supported in this browser.');
      return;
    }

    if (!text || typeof text !== 'string') return;

    try {
      // Duplicate speech cancellation prior to speaking
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = settings.language || 'en-IN';
      utterance.rate = settings.rate ?? 0.90;
      utterance.pitch = settings.pitch ?? 0.85;
      utterance.volume = settings.volume ?? 1.0;

      // Select voice via engine logic
      const voices = this.getVoices();
      const chosenVoice = voicePersonalityEngine.selectBestVoice(voices, settings);
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }

      utterance.onend = () => {
        if (onEnd) onEnd();
      };

      utterance.onerror = (ev) => {
        if (ev.error !== 'interrupted' && ev.error !== 'canceled') {
          console.warn('[TTSProvider] Speech utterance error:', ev.error);
        }
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('[TTSProvider] Synthesis invocation error:', err);
      if (onEnd) onEnd();
    }
  }
}

/**
 * IGRIS Voice Personality Engine
 */
export class VoicePersonalityEngine {
  private provider: TTSProvider;
  private settings: Required<Omit<VoiceSettings, 'emotionalMode'>> & {
    emotionalMode: EmotionalMode;
  };
  private voiceChangeListeners: Array<(voices: SpeechSynthesisVoice[]) => void> = [];
  private settingsChangeListeners: Array<(settings: VoiceSettings) => void> = [];
  private lastSpokenText: string | null = null;
  private lastSpokenTime: number = 0;
  private fallbackVoiceInUse: boolean = false;

  constructor(provider?: TTSProvider) {
    this.provider = provider || new BrowserSpeechSynthesisProvider();
    this.settings = this.loadPersistedSettings();

    // Hook into browser voiceschanged event safely
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.onvoiceschanged = () => {
          const voices = this.provider.getVoices();
          this.voiceChangeListeners.forEach((listener) => {
            try {
              listener(voices);
            } catch (err) {
              console.warn('[VoicePersonality] Error in voiceChange listener:', err);
            }
          });
        };
      } catch {}
    }
  }

  /**
   * Safe persistence loader. Ensures NO tokens or sensitive data are loaded.
   */
  public loadPersistedSettings(): Required<Omit<VoiceSettings, 'emotionalMode'>> & {
    emotionalMode: EmotionalMode;
  } {
    if (typeof localStorage === 'undefined') {
      return { ...IGRIS_DEFAULT_VOICE_SETTINGS };
    }

    try {
      const raw =
        localStorage.getItem(STORAGE_KEY_VOICE) ||
        localStorage.getItem(LEGACY_STORAGE_KEY_VOICE);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          voiceEnabled: typeof parsed.voiceEnabled === 'boolean' ? parsed.voiceEnabled : true,
          autoSpeakResponses: typeof parsed.autoSpeakResponses === 'boolean' ? parsed.autoSpeakResponses : true,
          language: typeof parsed.language === 'string' ? parsed.language : 'en-IN',
          selectedVoice: typeof parsed.selectedVoice === 'string' ? parsed.selectedVoice : 'auto',
          rate: typeof parsed.rate === 'number' ? Math.max(0.5, Math.min(1.5, parsed.rate)) : 0.90,
          pitch: typeof parsed.pitch === 'number' ? Math.max(0.5, Math.min(1.5, parsed.pitch)) : 0.85,
          volume: typeof parsed.volume === 'number' ? Math.max(0.0, Math.min(1.0, parsed.volume)) : 1.0,
          tone: ['calm', 'balanced', 'commanding'].includes(parsed.tone) ? parsed.tone : 'calm',
          style: ['commander', 'standard'].includes(parsed.style) ? parsed.style : 'commander',
          emotionalMode: [
            'NORMAL',
            'COMMAND',
            'SUCCESS',
            'WARNING',
            'ERROR',
            'SYSTEM_STATUS',
            'GREETING'
          ].includes(parsed.emotionalMode)
            ? parsed.emotionalMode
            : 'NORMAL'
        };
      }
    } catch (err) {
      console.warn('[VoicePersonality] Could not load persisted settings:', err);
    }

    return { ...IGRIS_DEFAULT_VOICE_SETTINGS };
  }

  /**
   * Save non-sensitive settings to localStorage.
   */
  public persistSettings(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const sanitized: VoiceSettings = {
        voiceEnabled: this.settings.voiceEnabled,
        autoSpeakResponses: this.settings.autoSpeakResponses,
        language: this.settings.language,
        selectedVoice: this.settings.selectedVoice,
        rate: this.settings.rate,
        pitch: this.settings.pitch,
        volume: this.settings.volume,
        tone: this.settings.tone,
        style: this.settings.style,
        emotionalMode: this.settings.emotionalMode
      };
      localStorage.setItem(STORAGE_KEY_VOICE, JSON.stringify(sanitized));
    } catch (err) {
      console.warn('[VoicePersonality] Could not persist settings:', err);
    }
  }

  public getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  public isUsingFallbackVoice(): boolean {
    return this.fallbackVoiceInUse;
  }

  public updateSettings(partial: Partial<VoiceSettings>): void {
    this.settings = {
      ...this.settings,
      ...partial
    };
    this.persistSettings();
    this.settingsChangeListeners.forEach((listener) => {
      try {
        listener(this.getSettings());
      } catch {}
    });
  }

  public resetSettings(): void {
    this.settings = { ...IGRIS_DEFAULT_VOICE_SETTINGS };
    this.persistSettings();
    this.settingsChangeListeners.forEach((listener) => {
      try {
        listener(this.getSettings());
      } catch {}
    });
  }

  public onVoicesChanged(listener: (voices: SpeechSynthesisVoice[]) => void): () => void {
    this.voiceChangeListeners.push(listener);
    return () => {
      this.voiceChangeListeners = this.voiceChangeListeners.filter((l) => l !== listener);
    };
  }

  public onSettingsChanged(listener: (settings: VoiceSettings) => void): () => void {
    this.settingsChangeListeners.push(listener);
    return () => {
      this.settingsChangeListeners = this.settingsChangeListeners.filter((l) => l !== listener);
    };
  }

  public getVoices(): SpeechSynthesisVoice[] {
    return this.provider.getVoices();
  }

  /**
   * Dynamic Male Voice Discovery and Selection Algorithm
   * 
   * Priority:
   * 1. Explicit user-selected voice name (if specified and exists)
   * 2. Matching language male voice
   * 3. English male voice (David, Mark, Guy, Google UK Male, etc.)
   * 4. High-quality natural English voice
   * 5. Safe fallback to best available voice
   */
  public selectBestVoice(
    voices: SpeechSynthesisVoice[],
    settings: VoiceSettings
  ): SpeechSynthesisVoice | null {
    if (!voices || voices.length === 0) {
      this.fallbackVoiceInUse = true;
      return null;
    }

    const requestedName = settings.selectedVoice;
    if (requestedName && requestedName !== 'auto') {
      const exactMatch = voices.find((v) => v.name === requestedName || v.voiceURI === requestedName);
      if (exactMatch) {
        this.fallbackVoiceInUse = false;
        return exactMatch;
      }
    }

    const lang = settings.language || 'en-IN';

    // Helper: test if name indicates male
    const isMale = (name: string): boolean => {
      const lower = name.toLowerCase();
      const hasFemale = FEMALE_VOICE_KEYWORDS.some((kw) => lower.includes(kw));
      if (hasFemale) return false;
      return MALE_VOICE_KEYWORDS.some((kw) => lower.includes(kw));
    };

    // 1. Language-matched male voice
    const langMale = voices.find(
      (v) => (v.lang === lang || v.lang.startsWith(lang.slice(0, 2))) && isMale(v.name)
    );
    if (langMale) {
      this.fallbackVoiceInUse = false;
      return langMale;
    }

    // 2. English male voice (any region: en-US, en-GB, en-IN, en-AU)
    const englishMale = voices.find((v) => v.lang.startsWith('en') && isMale(v.name));
    if (englishMale) {
      this.fallbackVoiceInUse = false;
      return englishMale;
    }

    // 3. Any male voice across all languages
    const anyMale = voices.find((v) => isMale(v.name));
    if (anyMale) {
      this.fallbackVoiceInUse = false;
      return anyMale;
    }

    // 4. Fallback: English voice non-female
    const neutralEnglish = voices.find((v) => {
      const lower = v.name.toLowerCase();
      return v.lang.startsWith('en') && !FEMALE_VOICE_KEYWORDS.some((kw) => lower.includes(kw));
    });
    if (neutralEnglish) {
      this.fallbackVoiceInUse = true;
      return neutralEnglish;
    }

    // 5. Fallback: Preferred language voice
    const langVoice = voices.find((v) => v.lang === lang || v.lang.startsWith('en'));
    if (langVoice) {
      this.fallbackVoiceInUse = true;
      return langVoice;
    }

    // 6. Absolute fallback: first available voice
    this.fallbackVoiceInUse = true;
    return voices[0] || null;
  }

  /**
   * Compute dynamic rate and pitch based on emotional mode and tone
   */
  public getEffectiveParameters(
    mode?: EmotionalMode,
    tone?: VoiceTone
  ): { rate: number; pitch: number; volume: number } {
    let baseRate = this.settings.rate;
    let basePitch = this.settings.pitch;
    const baseVolume = this.settings.volume;

    const currentTone = tone || this.settings.tone;
    const currentMode = mode || this.settings.emotionalMode || 'NORMAL';

    // Tone modifiers
    if (currentTone === 'commanding') {
      baseRate = Math.max(0.5, baseRate - 0.02);
      basePitch = Math.max(0.5, basePitch - 0.05);
    } else if (currentTone === 'balanced') {
      baseRate = Math.min(1.5, baseRate + 0.02);
      basePitch = Math.min(1.5, basePitch + 0.03);
    }

    // Emotional mode tuning (preserves calm, commanding, non-exaggerated nature)
    switch (currentMode) {
      case 'COMMAND':
        return {
          rate: Math.max(0.5, baseRate - 0.02),
          pitch: Math.max(0.5, basePitch - 0.05),
          volume: baseVolume
        };
      case 'SUCCESS':
        return {
          rate: Math.min(1.5, baseRate + 0.02),
          pitch: Math.min(1.5, basePitch + 0.03),
          volume: baseVolume
        };
      case 'WARNING':
        return {
          rate: Math.max(0.5, baseRate - 0.05),
          pitch: Math.max(0.5, basePitch - 0.10), // Deeper, slower, serious
          volume: baseVolume
        };
      case 'ERROR':
        return {
          rate: baseRate,
          pitch: basePitch,
          volume: baseVolume
        };
      case 'SYSTEM_STATUS':
        return {
          rate: baseRate,
          pitch: Math.max(0.5, basePitch - 0.03), // Precise, authoritative
          volume: baseVolume
        };
      case 'GREETING':
        return {
          rate: Math.min(1.5, baseRate + 0.02),
          pitch: Math.min(1.5, basePitch + 0.03),
          volume: baseVolume
        };
      case 'NORMAL':
      default:
        return {
          rate: baseRate,
          pitch: basePitch,
          volume: baseVolume
        };
    }
  }

  /**
   * Natural speech sanitization & rhythm cadence
   */
  public formatForSpeech(text: string): string {
    if (!text || typeof text !== 'string') return '';

    return text
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/`([^`]+)`/g, '$1') // remove inline code marks
      .replace(/\{[\s\S]*?\}/g, '') // strip raw JSON objects
      .replace(/https?:\/\/(?:www\.)?([^\s/]+)[^\s]*/gi, '$1') // domains instead of URLs
      .replace(/[#*_~[\]()]/g, ' ') // strip markdown characters
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Speak a phrase using the active personality engine
   */
  public speak(
    text: string,
    options?: {
      language?: string;
      mode?: EmotionalMode;
      tone?: VoiceTone;
      onEnd?: () => void;
    }
  ): void {
    if (!this.settings.voiceEnabled) return;

    const cleaned = this.formatForSpeech(text);
    if (!cleaned) return;

    // Duplicate speech prevention within 1 second
    const now = Date.now();
    if (this.lastSpokenText === cleaned && now - this.lastSpokenTime < 1000) {
      return;
    }
    this.lastSpokenText = cleaned;
    this.lastSpokenTime = now;

    const params = this.getEffectiveParameters(options?.mode, options?.tone);

    const mergedSettings: VoiceSettings = {
      ...this.settings,
      language: options?.language || this.settings.language,
      rate: params.rate,
      pitch: params.pitch,
      volume: params.volume,
      emotionalMode: options?.mode || this.settings.emotionalMode
    };

    this.provider.speak(cleaned, mergedSettings, options?.onEnd);
  }

  /**
   * Stop active speech
   */
  public stop(): void {
    this.provider.stop();
  }

  /**
   * Preview active voice locally without hitting network/server
   */
  public previewVoice(customPhrase?: string): void {
    const phrase = customPhrase || TEST_VOICE_PHRASE;
    this.speak(phrase, { mode: 'GREETING' });
  }
}

export const voicePersonalityEngine = new VoicePersonalityEngine();
export default voicePersonalityEngine;
