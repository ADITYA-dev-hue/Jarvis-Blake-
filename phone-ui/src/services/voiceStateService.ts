/**
 * JARVIS / IGRIS Phase 12 - Voice State Machine Service
 * 
 * Coordinates hands-free wake word activation, speech capture, timeouts,
 * conversation mode follow-ups, TTS playback, and state transitions.
 * 
 * Strict State Machine:
 *   STANDBY -> LISTENING -> PROCESSING -> EXECUTING -> SPEAKING -> STANDBY
 *                 │                                       │ (Conversation Mode)
 *                 └─── (Timeout / Error) ───> ERROR ──────┴──> LISTENING
 */

import {
  MicPrivacyState,
  VoiceState
} from '../types/voice';
import wakeWordService from './wakeWordService';
import speechRecognition from './speechRecognition';
import ttsService from './textToSpeech';
import audioFx from './audioFx';
import voicePersonalityEngine from './voicePersonality';

export const COMMAND_TIMEOUT_MS = 8000;
export const SILENCE_TIMEOUT_MS = 3000;
export const CONVERSATION_TIMEOUT_MS = 6000;

export type VoiceStateListener = (state: VoiceState, message: string, privacy: MicPrivacyState) => void;

class VoiceStateService {
  private currentState: VoiceState = 'STANDBY';
  private statusMessage: string = 'Say "IGRIS" to talk';
  private privacyState: MicPrivacyState = 'MIC_OFF';
  private listeners: Set<VoiceStateListener> = new Set();

  private commandTimer: any = null;
  private conversationTimer: any = null;
  private errorTimer: any = null;

  private sendCommandFn: ((text: string) => Promise<any>) | null = null;
  private isConversationFollowUp: boolean = false;
  private lastCapturedTranscript: string = '';

  constructor() {
    this.setupWakeWordIntegration();
  }

  /**
   * Bind command dispatcher callback (typically App.tsx handleSendAiCommand)
   */
  public setCommandDispatcher(dispatcher: (text: string) => Promise<any>): void {
    this.sendCommandFn = dispatcher;
  }

  public getState(): VoiceState {
    return this.currentState;
  }

  public getStatusMessage(): string {
    return this.statusMessage;
  }

  public getPrivacyState(): MicPrivacyState {
    return this.privacyState;
  }

  public subscribe(listener: VoiceStateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState, this.statusMessage, this.privacyState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitState(): void {
    this.listeners.forEach((l) => {
      try {
        l(this.currentState, this.statusMessage, this.privacyState);
      } catch (err) {
        console.error('[VoiceState] Listener error:', err);
      }
    });
  }

  private setState(state: VoiceState, message: string, privacy?: MicPrivacyState): void {
    this.currentState = state;
    this.statusMessage = message;

    if (privacy) {
      this.privacyState = privacy;
    } else {
      switch (state) {
        case 'STANDBY':
          this.privacyState = wakeWordService.isListening() ? 'MIC_STANDBY' : 'MIC_OFF';
          break;
        case 'LISTENING':
          this.privacyState = 'MIC_LISTENING';
          break;
        case 'PROCESSING':
        case 'EXECUTING':
          this.privacyState = 'MIC_PROCESSING';
          break;
        case 'SPEAKING':
        case 'ERROR':
          this.privacyState = 'MIC_OFF';
          break;
      }
    }

    this.emitState();
  }

  /**
   * Initialize or update hands-free mode based on current voice settings
   */
  public syncSettings(): void {
    const settings = voicePersonalityEngine.getSettings();
    const handsFree = settings.handsFreeEnabled ?? true;

    if (handsFree && settings.voiceEnabled) {
      if (this.currentState === 'STANDBY') {
        wakeWordService.setLanguage(settings.language || 'en-IN');
        wakeWordService.start();
        this.setState('STANDBY', 'Say "IGRIS" to talk', 'MIC_STANDBY');
      }
    } else {
      wakeWordService.stop();
      if (this.currentState === 'STANDBY') {
        this.setState('STANDBY', 'Tap to speak', 'MIC_OFF');
      }
    }
  }

  /**
   * Manual trigger via push-to-talk button
   */
  public triggerManualListening(): void {
    if (this.currentState === 'SPEAKING') {
      this.interruptSpeaking();
    }

    if (this.currentState === 'LISTENING') {
      this.stopListening();
      this.transitionToStandby();
      return;
    }

    this.startListeningSession();
  }

  /**
   * Safe interruption: stops active speech and transitions immediately to listening
   */
  public interruptSpeaking(): void {
    ttsService.stop();
    this.clearTimers();
    this.startListeningSession();
  }

  private setupWakeWordIntegration(): void {
    wakeWordService.onWakeWord((_detected, remaining) => {
      // Wake word detected locally!
      audioFx.playMicPulse();

      if (remaining && remaining.length > 2) {
        // Command was spoken in one breath: "IGRIS, open Chrome"
        this.processCapturedCommand(remaining);
      } else {
        // Wake word alone: "IGRIS"
        this.startListeningSession();
      }
    });

    wakeWordService.onError((errMsg) => {
      this.setState('ERROR', errMsg, 'MIC_OFF');
      this.scheduleErrorReset();
    });
  }

  /**
   * Enter LISTENING state with bounded command timeout
   */
  public startListeningSession(): void {
    this.clearTimers();
    wakeWordService.stop();

    this.setState('LISTENING', "I'm listening...", 'MIC_LISTENING');
    this.lastCapturedTranscript = '';

    // Command Timeout timer (Section 4 & Section 27)
    this.commandTimer = setTimeout(() => {
      if (this.currentState === 'LISTENING') {
        this.stopListening();
        this.setState('ERROR', "I didn't hear a command.", 'MIC_OFF');
        audioFx.playAlert();
        this.scheduleErrorReset();
      }
    }, COMMAND_TIMEOUT_MS);

    speechRecognition.setCallbacks({
      onStart: () => {
        this.setState('LISTENING', "I'm listening...", 'MIC_LISTENING');
      },
      onResult: (interim) => {
        // Reset command timeout on active speech
        this.resetCommandTimer();
        this.setState('LISTENING', `"${interim}"`, 'MIC_LISTENING');
      },
      onFinalResult: (final) => {
        this.lastCapturedTranscript = final.trim();
        this.stopListening();
        this.processCapturedCommand(this.lastCapturedTranscript);
      },
      onError: (errMsg) => {
        this.stopListening();
        this.setState('ERROR', errMsg, 'MIC_OFF');
        audioFx.playAlert();
        this.scheduleErrorReset();
      },
      onEnd: () => {
        if (this.currentState === 'LISTENING' && this.lastCapturedTranscript) {
          this.processCapturedCommand(this.lastCapturedTranscript);
        } else if (this.currentState === 'LISTENING') {
          this.transitionToStandby();
        }
      }
    });

    speechRecognition.start();
  }

  private stopListening(): void {
    this.clearTimers();
    speechRecognition.stop();
  }

  private resetCommandTimer(): void {
    if (this.commandTimer) clearTimeout(this.commandTimer);
    this.commandTimer = setTimeout(() => {
      if (this.currentState === 'LISTENING') {
        this.stopListening();
        if (this.lastCapturedTranscript) {
          this.processCapturedCommand(this.lastCapturedTranscript);
        } else {
          this.setState('ERROR', "I didn't hear a command.", 'MIC_OFF');
          this.scheduleErrorReset();
        }
      }
    }, SILENCE_TIMEOUT_MS);
  }

  /**
   * Process recognized command transcript
   */
  private async processCapturedCommand(transcript: string): Promise<void> {
    if (!transcript || !transcript.trim()) {
      this.setState('ERROR', "I didn't hear a command.", 'MIC_OFF');
      this.scheduleErrorReset();
      return;
    }

    this.clearTimers();
    const cleanCommand = transcript.trim();

    this.setState('PROCESSING', 'Thinking...', 'MIC_PROCESSING');

    if (!this.sendCommandFn) {
      this.setState('ERROR', 'Assistant dispatcher unavailable.', 'MIC_OFF');
      this.scheduleErrorReset();
      return;
    }

    try {
      this.setState('EXECUTING', 'Executing...', 'MIC_PROCESSING');
      const response = await this.sendCommandFn(cleanCommand);

      const message = response?.message || (response?.success ? 'Done.' : "I couldn't complete that command.");
      const settings = voicePersonalityEngine.getSettings();

      if (settings.voiceEnabled && settings.autoSpeakResponses) {
        this.setState('SPEAKING', message, 'MIC_OFF');

        ttsService.speak(
          message,
          settings.language || 'en-IN',
          response?.success ? 'COMMAND' : 'ERROR',
          () => {
            // Callback when speaking finishes
            this.handleSpeakingFinished(response?.success ?? false);
          }
        );
      } else {
        this.handleSpeakingFinished(response?.success ?? false);
      }
    } catch (err: any) {
      console.error('[VoiceState] Command error:', err);
      this.setState('ERROR', "I couldn't complete that command.", 'MIC_OFF');
      this.scheduleErrorReset();
    }
  }

  /**
   * Handle completion of TTS speaking
   */
  private handleSpeakingFinished(wasSuccess: boolean): void {
    const settings = voicePersonalityEngine.getSettings();
    const conversationMode = settings.conversationMode ?? false;

    if (conversationMode && wasSuccess) {
      // Enter short conversation mode for follow-up (Section 5)
      this.isConversationFollowUp = true;
      this.setState('LISTENING', 'Listening for follow-up...', 'MIC_LISTENING');

      this.conversationTimer = setTimeout(() => {
        if (this.currentState === 'LISTENING' && this.isConversationFollowUp) {
          this.stopListening();
          this.isConversationFollowUp = false;
          this.transitionToStandby();
        }
      }, CONVERSATION_TIMEOUT_MS);

      // Start listening for follow-up command
      this.startListeningSession();
    } else {
      this.isConversationFollowUp = false;
      this.transitionToStandby();
    }
  }

  /**
   * Return to STANDBY and re-arm wake word if hands-free is enabled
   */
  public transitionToStandby(): void {
    this.clearTimers();
    const settings = voicePersonalityEngine.getSettings();
    const handsFree = settings.handsFreeEnabled ?? true;

    if (handsFree && settings.voiceEnabled) {
      this.setState('STANDBY', 'Say "IGRIS" to talk', 'MIC_STANDBY');
      wakeWordService.setLanguage(settings.language || 'en-IN');
      wakeWordService.start();
    } else {
      this.setState('STANDBY', 'Tap to speak', 'MIC_OFF');
      wakeWordService.stop();
    }
  }

  private scheduleErrorReset(): void {
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => {
      this.transitionToStandby();
    }, 2500);
  }

  private clearTimers(): void {
    if (this.commandTimer) {
      clearTimeout(this.commandTimer);
      this.commandTimer = null;
    }
    if (this.conversationTimer) {
      clearTimeout(this.conversationTimer);
      this.conversationTimer = null;
    }
    if (this.errorTimer) {
      clearTimeout(this.errorTimer);
      this.errorTimer = null;
    }
  }

  /**
   * Cleanup all listeners and active audio
   */
  public destroy(): void {
    this.clearTimers();
    wakeWordService.stop();
    speechRecognition.stop();
    ttsService.stop();
    this.listeners.clear();
  }
}

export const voiceStateService = new VoiceStateService();
export default voiceStateService;
