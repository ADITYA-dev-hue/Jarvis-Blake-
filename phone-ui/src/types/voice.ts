/**
 * JARVIS / IGRIS Phase 4 & Phase 9.5 - Voice Interaction & Personality Types
 * 
 * Defines typed interfaces for Web Speech API (SpeechRecognition, SpeechSynthesis),
 * microphone states, voice personality profiles, emotional modes, and TTS providers.
 */

export type MicState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';

export type CommandSource = 'text' | 'voice';

export type VoiceGender = 'male' | 'female' | 'auto';
export type VoiceTone = 'calm' | 'balanced' | 'commanding';
export type VoiceStyle = 'commander' | 'standard';

export type EmotionalMode =
  | 'NORMAL'
  | 'COMMAND'
  | 'SUCCESS'
  | 'WARNING'
  | 'ERROR'
  | 'SYSTEM_STATUS'
  | 'GREETING';

/**
 * High-level personality configuration profile
 */
export interface VoicePersonalityProfile {
  gender: 'male';
  tone: 'calm';
  authority: 'high';
  friendliness: 'low_to_medium';
  darkness: 'medium';
  mystery: 'medium';
  emotion: 'controlled';
  energy: 'low_to_medium';
  speaking_style: 'commander';
}

/**
 * Complete Voice Settings interface with full Phase 4 backward compatibility
 * and Phase 9.5 personality tuning parameters.
 */
export interface VoiceSettings {
  voiceEnabled: boolean;
  autoSpeakResponses: boolean;
  language: string;
  // Phase 9.5 extensions (optional for backwards compatibility)
  selectedVoice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  tone?: VoiceTone;
  style?: VoiceStyle;
  emotionalMode?: EmotionalMode;
}

/**
 * Standard TTS provider abstraction for modular engine support
 */
export interface TTSProvider {
  speak(text: string, settings: VoiceSettings, onEnd?: () => void): void | Promise<void>;
  stop(): void;
  pause(): void;
  resume(): void;
  getVoices(): SpeechSynthesisVoice[];
  isSupported(): boolean;
}

export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

export interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onaudiostart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onnomatch: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onsoundend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onsoundstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onspeechstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  abort(): void;
  start(): void;
  stop(): void;
}

export interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: ISpeechRecognitionConstructor;
    webkitSpeechRecognition?: ISpeechRecognitionConstructor;
  }
}

export interface SpeechRecognitionCallbacks {
  onStart?: () => void;
  onResult?: (interimTranscript: string) => void;
  onFinalResult?: (finalTranscript: string) => void;
  onEnd?: () => void;
  onError?: (errorMessage: string, rawCode?: string) => void;
}
