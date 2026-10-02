# JARVIS / IGRIS Phase 9: Intelligent Workflow Engine + Multilingual Assistant Layer

## 1. Overview & Architectural Scope
Phase 9 elevates the JARVIS / IGRIS system from an individual-command executor into an intelligent, multilingual assistant capable of:
1. **Multilingual Interaction**: Native understanding and response generation across English, Hinglish, and Hindi with automatic language detection, explicit user preference persistence, and conversational language-switching commands.
2. **Context-Aware Workflow Planning**: Multi-step sequential task planning that resolves conversational pronouns ("open it", "now search ...", "show what is inside") based on prior turns and active workspace folders.
3. **Safe Task Confirmation Gate**: Automatic detection and gating for workflows with $\ge 3$ steps requiring explicit mobile user confirmation before execution, with strict server-side re-validation and tamper protection.
4. **Task Execution History API**: Bounded, sanitized task history (`GET /api/tasks/history`) preventing any credential, token, or secret exposure.
5. **Mobile & Desktop Control Center**: Language badge/selector, step-by-step progress banner, holographic confirmation modal, and task audit log modal.

```
       📱 Phone / Web UI (English / Hinglish / Hindi)
                         ↕ HTTPS / WSS
   ╭────────────────────────────────────────────────────────╮
   │                 Node.js Gateway Server                 │
   │  ┌──────────────────────┐   ┌───────────────────────┐  │
   │  │ Language Engine      │   │ Task History Memory   │  │
   │  │ (en / hinglish / hi) │   │ (Bounded 50 Entries)  │  │
   │  └──────────────────────┘   └───────────────────────┘  │
   │  ┌──────────────────────┐   ┌───────────────────────┐  │
   │  │ Gemini 2.5 Flash /   │   │ Confirmation Gate     │  │
   │  │ Semantic Interpreter │   │ (≥3 steps gated)      │  │
   │  └──────────────────────┘   └───────────────────────┘  │
   │  ┌──────────────────────────────────────────────────┐  │
   │  │        Strict Command Validator Barrier          │  │
   │  └──────────────────────────────────────────────────┘  │
   ╰────────────────────────────────────────────────────────╯
                         ↕ Socket.IO (Authenticated)
              🐍 Python Laptop Agent (LAPTOP-01)
                         ↕ Safe Command Engine
                   💻 Windows Laptop Target
```

---

## 2. Multilingual Assistant Layer (`server/ai/language-engine.js`)

### Language Detection & Preference Hierarchy
- **Explicit User Preference**: When set to `'en'`, `'hinglish'`, or `'hi'`, user preference takes strict precedence.
- **Auto-Detection (`'auto'`)**:
  - **Devanagari Regex (`[\u0900-\u097F]`)**: Flags Hindi script input.
  - **Hinglish Token Analyzer**: Detects conversational Romanized Hindi keywords (`kholo`, `banao`, `dikhaye`, `karo`, `chalaye`, `band`, `dobara`, `abhi`, `kaun`, `mera`, `kaise`, etc.).
  - Defaults safely to English (`en`).
- **Conversational Switching**:
  - Natural commands like *"Talk to me in English"*, *"Hinglish mein baat karo"*, or *"हिंदी में बोलो"* switch the active session language and emit a localized acknowledgement without executing system actions.

### Multilingual Responses
- **Telemetric Queries**: Formats CPU, RAM, Disk, and Battery metrics into natural speech and text in English, Hinglish, and Hindi.
- **File & App Feedback**: Contextually localized confirmations (e.g. *"chrome open ho gaya. Ab kya karna hai?"*).
- **Security Rejections**: User-friendly rejections in the target language while maintaining strict security isolation.

---

## 3. Intelligent Multi-Step Workflow Engine

### Context Reference Resolution
- **"Now" Directive**: Resolves follow-ups such as *"Now search for Python roadmap"* into `search_web` without losing preceding application context.
- **"It" Resolution**: Resolves references such as *"Open it"* or *"Isse kholo"* to the most recently created file or referenced folder from session memory.
- **Ambiguity Clarification**: Prompts the user with natural clarifying questions when parameters are missing (e.g., *"What should I name the folder?"* / *"Folder ka naam kya rakhna hai?"*).

### Safe Task Confirmation Gate
- **Threshold**: Any task containing $\ge 3$ steps automatically enters the confirmation queue.
- **Approval Protocol**:
  1. Server issues a cryptographically random, timestamped `confirmationId` expiring in 2 minutes.
  2. Mobile client renders `TaskConfirmationModal` displaying each planned step with auditory alerts.
  3. Upon user confirmation (`task_confirm`), the server retrieves the original plan from the pending map, **re-validates every individual step through `command-validator.js`**, and dispatches to the laptop agent.
  4. Any spoofed, modified, or expired confirmation attempt is immediately rejected.

---

## 4. Bounded Task Execution History API

- **Endpoint**: `GET /api/tasks/history`
- **Bounds**: In-memory ring buffer capped at 50 latest executions.
- **Sanitization**: All tokens (`JARVIS_AUTH_TOKEN`, `GEMINI_API_KEY`, Bearer tokens) are stripped before storage or transmission.
- **Schema**:
  ```json
  {
    "success": true,
    "count": 1,
    "tasks": [
      {
        "taskId": "cmd-ai-...",
        "timestamp": "2026-10-02T20:04:00.000Z",
        "originalUserRequest": "Open Chrome and search for news",
        "detectedLanguage": "en",
        "status": "completed",
        "steps": 2,
        "completedSteps": 2,
        "failedStep": null,
        "resultSummary": "Task completed successfully (2 steps executed)."
      }
    ]
  }
  ```

---

## 5. Frontend UI Extensions (`phone-ui/`)

1. **`LanguageSelector.tsx`**:
   - Language selector dropdown/badge supporting Auto, English, Hinglish, and Hindi.
   - Persisted across app sessions in `localStorage` (`jarvis_language_pref_v1`).
2. **`TaskConfirmationModal.tsx`**:
   - Holographic cyberpunk modal outlining sequential steps before approval.
   - Triggered via Socket.IO `task_confirmation_required` event.
3. **`TaskProgressBanner.tsx`**:
   - Real-time step progress indicator (Step X of Y with ✓, ⏳, ○ state indicators).
4. **`TaskHistoryModal.tsx`**:
   - Audit trail modal fetching recent tasks from `/api/tasks/history`.

---

## 6. Verification & Regression Test Results

### Phase 9 Test Suite (`test-phase9.py`)
- **Total Test Cases**: 40/40 PASSED (100% Success)
- **Coverage**:
  - English, Hinglish, and Hindi natural language commands
  - Explicit language preference override
  - Language-switching conversational commands
  - Context-aware "now" and "it" resolution
  - 3-step confirmation threshold & bypass rejection
  - Re-validation of modified tasks upon confirmation
  - Prompt injection, shell, PowerShell, CMD, and deletion security barriers
  - Fail-fast execution on intermediate step errors
  - Zero credential leakage in task history API

### Master Regression Suite (`run-all-tests.py`)
```
================================================================================
                             FINAL TEST SUMMARY                                 
================================================================================
  Phase 2: PASSED  (18/18)
  Phase 3: PASSED  (19/19)
  Phase 4: PASSED  (21/21)
  Phase 5: PASSED  (32/32)
  Phase 6: PASSED  (50/50)
  Phase 7: PASSED  (17/17)
  Phase 8: PASSED  (29/29)
  Phase 9: PASSED  (40/40)
================================================================================
ALL REQUIRED PHASES PASSED WITH 100% SUCCESS!
```
