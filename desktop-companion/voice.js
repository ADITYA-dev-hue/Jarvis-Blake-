// IGRIS Desktop Companion - Voice & Wake Word Engine (Reuses Phase 12 & Phase 9.5)

class CompanionVoiceEngine {
  constructor(onStateChange, onCommandRecognized) {
    this.onStateChange = onStateChange || (() => {});
    this.onCommandRecognized = onCommandRecognized || (() => {});
    this.enabled = true;
    this.handsFree = true;
    this.recognition = null;
    this.synth = window.speechSynthesis;
    this.isListening = false;
    this.isSpeaking = false;
    this.selectedVoice = null;

    this.WAKE_WORDS = ['okay igris', 'hello igris', 'hey igris', 'ok igris', 'hi igris', 'igris'];
    this.initSpeechRecognition();
    this.initTtsVoice();
  }

  initTtsVoice() {
    const updateVoices = () => {
      if (!this.synth) return;
      const voices = this.synth.getVoices();
      // Look for preferred male / commanding voices
      this.selectedVoice = voices.find(v => 
        /david|george|mark|microsoft david|google uk english male|male/i.test(v.name)
      ) || voices[0] || null;
    };

    if (this.synth) {
      updateVoices();
      this.synth.onvoiceschanged = updateVoices;
    }
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[VoiceEngine] Web Speech API not supported in this runtime.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event) => {
      const lastIndex = event.results.length - 1;
      const transcript = event.results[lastIndex][0].transcript.trim();
      this.handleTranscript(transcript);
    };

    this.recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.warn('[VoiceEngine] Speech recognition error:', event.error);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.enabled && this.handsFree) {
        // Auto-restart hands-free listener with slight backoff
        setTimeout(() => {
          if (this.enabled && this.handsFree && !this.isListening) {
            try { this.recognition.start(); } catch (_) {}
          }
        }, 600);
      }
    };

    if (this.enabled && this.handsFree) {
      try { this.recognition.start(); } catch (_) {}
    }
  }

  handleTranscript(text) {
    const lower = text.toLowerCase();
    
    // Check for wake word prefix
    let matchedWake = null;
    for (const w of this.WAKE_WORDS) {
      if (lower.startsWith(w)) {
        matchedWake = w;
        break;
      }
    }

    if (matchedWake) {
      this.onStateChange('listening', 'Wake word recognized.');
      const remainder = text.slice(matchedWake.length).replace(/^[\s,.]+/, '').trim();
      if (remainder.length > 0) {
        // Command spoken in single breath
        this.onCommandRecognized(remainder);
      } else {
        // Standalone wake word -> arm listening
        this.onStateChange('listening', 'Awaiting command...');
      }
    } else if (this.isAwaitingCommand) {
      // Direct command after prompt
      this.isAwaitingCommand = false;
      this.onCommandRecognized(text);
    }
  }

  speak(text, onEnd) {
    if (!this.synth || !text) {
      if (onEnd) onEnd();
      return;
    }

    this.stopSpeaking();
    this.isSpeaking = true;
    this.onStateChange('speaking', text);

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) utterance.voice = this.selectedVoice;
    utterance.rate = 0.95; // Steady, calm tempo
    utterance.pitch = 0.85; // Deep male commander resonance (Phase 9.5)

    utterance.onend = () => {
      this.isSpeaking = false;
      this.onStateChange('idle', 'Standing by.');
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.onStateChange('idle', 'Standing by.');
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
    }
  }

  setHandsFree(enabled) {
    this.handsFree = !!enabled;
    if (!this.handsFree && this.isListening && this.recognition) {
      try { this.recognition.stop(); } catch (_) {}
    } else if (this.handsFree && !this.isListening && this.recognition) {
      try { this.recognition.start(); } catch (_) {}
    }
  }

  destroy() {
    this.enabled = false;
    this.stopSpeaking();
    if (this.recognition) {
      try { this.recognition.stop(); } catch (_) {}
    }
  }
}

window.CompanionVoiceEngine = CompanionVoiceEngine;
