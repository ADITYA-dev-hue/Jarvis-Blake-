# JARVIS / IGRIS Phase 10: Safe Window & Application Control + Desktop Media Monitor

## 1. Overview & Architectural Scope
Phase 10 extends the JARVIS / IGRIS autonomous assistant framework with **Safe Windows Application & Window Management** and a **Privacy-First Desktop Media Monitor**, fully integrated with the Phase 8/9 Multi-Step Workflow Engine and Multilingual Assistant Layer.

```
       📱 Phone / Web UI (English / Hinglish / Hindi)
         - Active Windows Manager Card (Focus / Min / Max / Restore)
         - Live Desktop Media Card (Now Playing & Privacy Shield)
                          ↕ HTTPS / WSS
    ╭────────────────────────────────────────────────────────╮
    │                 Node.js Gateway Server                 │
    │  ┌──────────────────────┐   ┌───────────────────────┐  │
    │  │ Language Engine      │   │ Media Status Cache    │  │
    │  │ (en / hinglish / hi) │   │ (latestMediaStatus)   │  │
    │  └──────────────────────┘   └───────────────────────┘  │
    │  ┌──────────────────────┐   ┌───────────────────────┐  │
    │  │ Gemini 2.5 Flash /   │   │ Multi-Step Workflow   │  │
    │  │ Semantic Interpreter │   │ Planner (Phase 8 & 9) │  │
    │  └──────────────────────┘   └───────────────────────┘  │
    │  ┌──────────────────────────────────────────────────┐  │
    │  │      Independent Command Validator Barrier       │  │
    │  │ (Allowlist strictly: notepad, calculator, paint, │  │
    │  │  code, chrome, explorer. Rejects HWND/PID/coords)│  │
    │  └──────────────────────────────────────────────────┘  │
    ╰────────────────────────────────────────────────────────╯
                          ↕ Socket.IO (Authenticated)
               🐍 Python Laptop Agent (LAPTOP-01)
         - Win32 Window Manager (Zero HWND/PID leak)
         - Desktop Media Monitor (Zero audio/video capture)
         - Command Registry & Safe Command Engine
                          ↕ Win32 Safe APIs
                    💻 Windows Laptop Target
```

---

## 2. Core Security & Privacy Principles

1. **Strict Application Allowlist**:
   Only 6 verified, non-destructive applications can be managed:
   - `notepad`
   - `calculator`
   - `paint`
   - `code` (VS Code)
   - `chrome`
   - `explorer` (File Explorer)
   *All other applications (e.g., `cmd`, `powershell`, `taskmgr`, `bash`) are strictly rejected.*

2. **Zero HWND / PID Exposure**:
   Raw Windows window handles (`HWND`) and process identifiers (`PID`) are never returned to the network, never emitted over Socket.IO, and never accepted as command parameters. The client-facing payload only exposes safe identifiers (`app` and clean window `title`).

3. **Forbidden Parameters Barrier**:
   The independent server validator and laptop command registry enforce that parameters such as `hwnd`, `pid`, `process_id`, `handle`, `coordinates`, `coords`, `x`, `y`, `width`, `height`, and `rect` are blocked with immediate security violation errors.

4. **Zero Arbitrary Shell Execution & No Process Killing**:
   Window management does not invoke PowerShell, cmd, or shell scripts, and provides no process termination / killing capabilities.

5. **Desktop Media Privacy Shield**:
   - Desktop media monitoring is **strictly metadata-only** (title, artist, album, playback state, duration, source).
   - **Zero microphone / audio capture**: No audio input or capture libraries (`pyaudio`, `sounddevice`, `wave`, etc.) are imported or utilized.
   - **Zero video / screen capture**: No screen-grabbing or camera libraries (`opencv`, `mss`, `pyautogui.screenshot`, etc.) are imported or utilized.

---

## 3. New Safe Actions & Command Registry

| Action | Parameters | Description |
|---|---|---|
| `list_windows` | *None* | Enumerate open windows matching the allowed applications. Returns `{ count, windows: [{ app, title }] }`. |
| `focus_window` | `app` (string) | Bring the specified allowed application's window to the foreground (`ShowWindow(SW_RESTORE)` + `SetForegroundWindow`). |
| `minimize_window` | `app` (string) | Minimize the specified allowed application's window (`ShowWindow(SW_MINIMIZE)`). |
| `maximize_window` | `app` (string) | Maximize the specified allowed application's window (`ShowWindow(SW_MAXIMIZE)`). |
| `restore_window` | `app` (string) | Restore the specified allowed application's window to normal size (`ShowWindow(SW_RESTORE)`). |
| `media_status` | *None* | Query current desktop media playback metadata (title, artist, playback state, source). |

---

## 4. Subsystem Implementations

### A. Window Manager (`laptop-agent/window_manager.py`)
- Uses Win32 Desktop APIs (`OpenInputDesktop`, `EnumDesktopWindows`, `GetWindowTextW`, `GetWindowThreadProcessId`).
- Matches windows by process executable name and verified window title patterns.
- Handles multi-monitor and minimized states safely without flickering.

### B. Desktop Media Monitor (`laptop-agent/media_monitor.py`)
- Extracts playback state and track metadata from supported desktop applications (Google Chrome, Microsoft Edge, Spotify, VLC, Mozilla Firefox).
- Includes background `MediaStatusReporter` thread that emits `media_status` events over Socket.IO upon change detection with automatic deduplication.

### C. Server Validator (`server/ai/command-validator.js`)
- Validates that `app` matches the strict allowlist (`notepad`, `calculator`, `paint`, `explorer`, `code`, `chrome`).
- Enforces zero parameters for `list_windows` and `media_status`.
- Rejects dangerous parameter keys (`hwnd`, `pid`, `handle`, `coordinates`, etc.).

### D. Multilingual AI Semantic Engine (`server/ai/language-engine.js` & `server/ai/gemini.js`)
- Full natural language interpretation and speech/text responses across **English**, **Hinglish**, and **Hindi**:
  - *"What windows are open?"* / *"Kaun si windows open hain?"* / *"कौन सी विंडो खुली हैं?"* $\rightarrow$ `list_windows`
  - *"Focus Chrome"* / *"Chrome samne lao"* / *"Chrome पर फ़ोकस करो"* $\rightarrow$ `focus_window(chrome)`
  - *"Minimize Notepad"* / *"Notepad minimize kardo"* / *"Notepad मिनिमाइज़ करो"* $\rightarrow$ `minimize_window(notepad)`
  - *"Maximize Chrome"* / *"Chrome bada karo"* $\rightarrow$ `maximize_window(chrome)`
  - *"What's playing?"* / *"Kaun sa gana chal raha hai?"* / *"क्या बज रहा है?"* $\rightarrow$ `media_status`
- Workflow integration: *"Open Chrome and maximize it"* decomposes into:
  1. `open_app` (app: `chrome`)
  2. `maximize_window` (app: `chrome`)

### E. Phone UI & Desktop Dashboard (`phone-ui/`)
- **`WindowsManagerCard.tsx`**:
  - Displays list of currently open supported applications with clean icons.
  - Quick action buttons: **Focus**, **Min**, **Max**, **Restore**.
  - Refresh button triggering `list_windows`.
- **`NowPlayingCard.tsx`**:
  - Holographic Now Playing badge showing Track Title, Artist, Album, and Source.
  - Dynamic playback state indicator (`playing`, `paused`, `stopped`).
  - Active **Privacy Shield Badge** guaranteeing zero audio/video capture.
- Integrated into `DesktopDashboard.tsx`, `HomeScreen.tsx`, and `AppsScreen.tsx`.

---

## 5. Verification & Regression Results

### Phase 10 Test Suite (`test-phase10.py`)
**Results: 48/48 PASSED (100.0%)**
- Group 1: Window Manager Unit & Safety Tests (10/10 PASS)
- Group 2: Desktop Media Monitor Tests & Privacy Guard (6/6 PASS)
- Group 3: Command Registry & Safe Command Engine Tests (8/8 PASS)
- Group 4: Server Independent Command Validator Tests (7/7 PASS)
- Group 5: AI Semantic Interpreter & Multilingual Engine Tests (15/15 PASS)
- Group 6: Multi-step Workflow Planning Tests (1/1 PASS)
- Group 7: End-to-End Socket.IO Live Integration Tests (1/1 PASS)

### Complete System Regression Suite (`run-all-tests.py`)
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
  Phase 10: PASSED
================================================================================
ALL REQUIRED PHASES PASSED WITH 100% SUCCESS!
```

### Phone UI Production Build
```
✓ 1641 modules transformed.
dist/index.html                   2.04 kB │ gzip:   0.83 kB
dist/assets/index-CBQq7azg.css   82.34 kB │ gzip:  12.55 kB
dist/assets/index-DZpY9jAW.js   432.99 kB │ gzip: 108.38 kB
✓ built in 23.23s
```
**0 TypeScript errors, 0 compilation warnings.**
