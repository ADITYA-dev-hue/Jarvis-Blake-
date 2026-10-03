# JARVIS / IGRIS Phase 9.5: Voice Personality Engine

## 1. Overview & Architectural Scope
Phase 9.5 introduces a dedicated **Voice Personality Engine** that endows IGRIS with a consistent, commanding, mature persona while maintaining strict architectural isolation and zero security regressions.

### Target Personality Impression
> **"A calm, powerful male commander with a mysterious dark presence who is always in control."**
- **Gender**: Male
- **Tone**: Calm, deliberate, steady
- **Authority**: High, commanding
- **Friendliness**: Subtle, controlled (low to medium)
- **Presence**: Dark, mysterious undertone with a futuristic edge
- **Attitude**: Professional, loyal, composed — never an exaggerated or theatrical villain.

```
                  User Speech / Text Command
                             ↓
              Gemini / Command Pipeline & Validator
                             ↓
                    IGRIS Response Text
                             ↓
                  Voice Personality Engine
                 - Dynamic Male Discovery
                 - Emotional Mode Tuning
                 - Natural Pause & Punctuation Cadence
                             ↓
                TTSProvider Interface Adapter
               (BrowserSpeechSynthesisProvider)
                             ↓
               Native Browser SpeechSynthesis
                             ↓
                   IGRIS Spoken Output
```

---

## 2. Core Architectural Principles & Separation of Concerns

Phase 9.5 strictly maintains independent boundaries across six distinct system layers:
1. **Language Layer** (`server/ai/language-engine.js`): Detects and formats text in English, Hinglish, or Hindi.
2. **Response Style Layer** (`server/ai/prompt.js`): Generates concise, confident, calm text responses (no cheesy cheerfulness).
3. **Voice Personality Layer** (`phone-ui/src/services/voicePersonality.ts`): Modulates pitch, speech rate, volume, tone, and emotional mode.
4. **TTS Provider Layer** (`TTSProvider` interface): Abstracts the speech synthesis engine for easy future pluggability (browser Web Speech API today; cloud neural TTS tomorrow).
5. **Authorization Layer** (`server/server.js`): Validates tokens (`IGRIS_AUTH_TOKEN`, `IGRIS_PHONE_TOKEN`). Voice personality settings never grant or modify authorization.
6. **Command Execution Layer** (`laptop-agent/command_registry.py`): Safe command engine executing allowed actions on the Windows laptop.

---

## 3. Dynamic Voice Discovery Algorithm

The browser Web Speech API lacks a standardized gender property across all operating systems and browsers. IGRIS discovers and selects the optimal male voice using prioritized heuristic matching:

1. **Explicit User Preference**: If a specific voice is selected in settings, it is used immediately.
2. **Language-Matched Male Voice**: Scans available browser voices matching the active language (`en-IN`, `en-US`, `en-GB`, etc.) for known masculine keywords (`david`, `george`, `mark`, `guy`, `ravi`, `rishi`, `james`, `daniel`, `male`, etc.) while excluding feminine markers (`female`, `zira`, `susan`, `hazel`, `heera`, etc.).
3. **English Male Voice**: Scans across all English locales (`en-*`) for masculine voice profiles.
4. **Any Male Voice**: Scans globally across all installed synthesizers.
5. **Neutral English Voice**: High-quality natural English voice fallback.
6. **Safe Fallback**: If no male voice exists on the client device, falls back safely to the primary system voice without crashing, alerting the UI with `usingFallbackVoice = true`.

---

## 4. Voice Personality Parameters & Emotional Modes

### Default Parameters
- **Speech Rate (`rate`)**: `0.90` (calibrated between `0.88 – 0.95` for measured, commanding delivery)
- **Voice Pitch (`pitch`)**: `0.85` (calibrated between `0.75 – 0.95` for deep male resonance)
- **Volume (`volume`)**: `1.0` (full clarity)

### Emotional Modes
| Mode | Rate | Pitch | Description |
|---|---|---|---|
| `NORMAL` | `0.90` | `0.85` | Balanced calm commander; steady, confident, slightly friendly |
| `COMMAND` | `0.88` | `0.80` | Slower, deeper, authoritative; higher control |
| `SUCCESS` | `0.92` | `0.88` | Slightly warmer and affirmative |
| `WARNING` | `0.85` | `0.75` | Slower, deep resonance, serious; never aggressive |
| `ERROR` | `0.90` | `0.85` | Calm, professional, neutral feedback |
| `SYSTEM_STATUS`| `0.90` | `0.82` | Precise, telemetric, authoritative cadence |
| `GREETING` | `0.92` | `0.88` | Confident with subtle warmth |

---

## 5. UI Controls & Persistence

- **`VoiceSettings.tsx`**:
  - Synthesizer selector (Auto Male Commander or manually selectable device voices).
  - Tone selector (`Calm`, `Balanced`, `Commanding`).
  - Style selector (`IGRIS Commander`, `Standard`).
  - Sliders for Speed (`0.5x – 1.5x`), Pitch (`0.5 – 1.5`), and Volume (`0% – 100%`).
  - **Test Voice** button: Plays the preview phrase locally:
    > *"Systems online. I am IGRIS. How may I assist you?"*
    *(Runs purely on the browser client without server or Gemini calls).*
  - **Reset** button: Restores default IGRIS Commander parameters.
- **Persistence**: Saved under localStorage key `igris_voice_settings` (with backwards compatibility for `jarvis_voice_settings_v1`). **Zero tokens or secrets are ever stored.**
- **Access Points**:
  - Modal button in top navigation bar (`VOICE` button).
  - Settings panel inside `VoiceControl.tsx`.
  - System Configuration tab in `DesktopDashboard.tsx`.

---

## 6. Natural Language Voice Style Commands

Users can modify their voice preference via natural language in English or Hinglish without altering permissions or invoking laptop commands:
- *"Speak more calmly."* $\rightarrow$ Sets tone to `calm`.
- *"Use a deeper voice."* $\rightarrow$ Lowers pitch to `0.78` and tone to `commanding`.
- *"Talk more like a commander."* $\rightarrow$ Engages commander cadence (rate `0.88`, pitch `0.80`).
- *"Make your voice slightly friendlier."* $\rightarrow$ Adjusts tone to `balanced` (pitch `0.88`, rate `0.92`).
- *"Use the IGRIS voice."* $\rightarrow$ Restores default commander parameters.

---

## 7. Verification & Full Regression Results

### Dedicated Phase 9.5 Test Suite (`test-phase9.5.py`)
**Results: 25/25 PASSED (100.0%)**
- Group 1: Voice Engine & Profile Specifications (6/6 PASS)
- Group 2: Parameters, Persistence & Preview Tests (6/6 PASS)
- Group 3: Multilingual & Emotional Profile Tests (7/7 PASS)
- Group 4: Security, Isolation & Validation Barrier Tests (3/3 PASS)
- Group 5: Compatibility & Regression Safeguard Tests (3/3 PASS)

### Full Regression Suite (`run-all-tests.py`)
```
================================================================================
                             FINAL TEST SUMMARY                                 
================================================================================
  Phase 2: PASSED
  Phase 3: PASSED
  Phase 4: PASSED
  Phase 5: PASSED
  Phase 6: PASSED
  Phase 7: PASSED
  Phase 8: PASSED
  Phase 9: PASSED
  Phase 9.5: PASSED
  Phase 10: PASSED
================================================================================
ALL REQUIRED PHASES PASSED WITH 100% SUCCESS!
```
