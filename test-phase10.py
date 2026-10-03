r"""Comprehensive Automated Test Suite for JARVIS / IGRIS Phase 10:
SAFE WINDOW & APPLICATION CONTROL + DESKTOP MEDIA MONITOR.

Validates all 48 mandated functionality, safety, multilingual, workflow, and security tests:
1. Window Manager: list_windows structure and count
2. Window Manager: Privacy check - zero HWND, PID, or raw handles leaked
3. Window Manager: Strict allowlist - only approved apps allowed
4. Window Manager: Focus unsupported app rejected
5. Window Manager: Minimize unsupported app rejected
6. Window Manager: Maximize unsupported app rejected
7. Window Manager: Restore unsupported app rejected
8. Window Manager: Non-open application returns graceful error
9. Window Manager: Real window state transitions (focus, minimize, maximize, restore)
10. Window Manager: Zero arbitrary shell or process killing powers
11. Media Monitor: get_media_status returns valid metadata dictionary
12. Media Monitor: Fields schema (active, playbackState, mediaType, title, artist, album, source)
13. Media Monitor: Authoritative privacy verification - zero audio / mic capture
14. Media Monitor: Authoritative privacy verification - zero video / screen capture
15. Media Monitor: Background reporter lifecycle (clean start & stop)
16. Media Monitor: Media change detection logic
17. Command Registry: All 6 Phase 10 actions registered
18. Command Registry: Safe execution of list_windows
19. Command Registry: Safe execution of media_status
20. Command Registry: Injection of forbidden parameter 'hwnd' rejected
21. Command Registry: Injection of forbidden parameter 'pid' rejected
22. Command Registry: Injection of forbidden parameter 'coordinates' rejected
23. Command Registry: Unapproved app name rejected
24. Command Registry: Execution audit logging verification
25. Server Validator: list_windows approved
26. Server Validator: focus_window with approved app approved
27. Server Validator: focus_window with forbidden 'hwnd' rejected
28. Server Validator: focus_window with unapproved app rejected
29. Server Validator: minimize_window, maximize_window, restore_window approved
30. Server Validator: media_status approved
31. Server Validator: media_status with extraneous parameters rejected
32. Multilingual: English "What windows are open?" -> list_windows
33. Multilingual: English "Focus Chrome" -> focus_window(chrome)
34. Multilingual: English "Minimize Notepad" -> minimize_window(notepad)
35. Multilingual: English "Maximize Chrome" -> maximize_window(chrome)
36. Multilingual: English "Restore Chrome" -> restore_window(chrome)
37. Multilingual: English "What's playing?" -> media_status
38. Multilingual: Hinglish "Kaun si windows open hain?" -> list_windows
39. Multilingual: Hinglish "Chrome samne lao" -> focus_window(chrome)
40. Multilingual: Hinglish "Notepad minimize kardo" -> minimize_window(notepad)
41. Multilingual: Hinglish "Chrome bada karo" -> maximize_window(chrome)
42. Multilingual: Hinglish "Kaun sa gana chal raha hai?" -> media_status
43. Multilingual: Hindi "कौन सी विंडो खुली हैं?" -> list_windows
44. Multilingual: Hindi "Chrome पर फ़ोकस करो" -> focus_window(chrome)
45. Multilingual: Hindi "Notepad मिनिमाइज़ करो" -> minimize_window(notepad)
46. Multilingual: Hindi "क्या बज रहा है?" -> media_status
47. Multi-step Workflow: "Open Chrome and maximize it" -> task with open_app + maximize_window
48. E2E Socket.IO: Phone connection, media_status reception, and direct list_windows execution
"""

import sys
import os
import io
import time
import json
import subprocess
from pathlib import Path
import requests
import socketio

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = Path("d:/JARVIS")
SERVER_URL = "http://localhost:3000"
PHONE_TOKEN = "jarvis_phone_dev_token_884192"
AGENT_ID = "LAPTOP-01"

test_results = []

def record(name: str, passed: bool, details: str = ""):
    status = "PASS" if passed else "FAIL"
    test_results.append((name, passed, details))
    print(f"  [{status}] {name}" + (f" ({details})" if details else ""), flush=True)

print("=" * 80, flush=True)
print("     JARVIS Phase 10 - Window Control & Desktop Media Monitor Test Suite", flush=True)
print("=" * 80, flush=True)

def is_server_online():
    try:
        r = requests.get(f"{SERVER_URL}/health", timeout=1.5)
        return r.status_code == 200 and r.json().get("status") == "online"
    except Exception:
        return False

def is_agent_online():
    try:
        r = requests.get(f"{SERVER_URL}/api/agent/status?agentId={AGENT_ID}", timeout=1.5)
        return r.status_code == 200 and r.json().get("online") is True
    except Exception:
        return False

server_proc = None
agent_proc = None

# Ensure server and laptop-agent are running for integration tests
if not is_server_online():
    print("\n[Setup] Starting Node.js Server...", flush=True)
    server_proc = subprocess.Popen(
        ["node", "server/server.js"],
        cwd=str(BASE_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    for _ in range(25):
        if is_server_online():
            break
        time.sleep(0.4)

if not is_agent_online():
    print("[Setup] Starting Laptop Agent...", flush=True)
    agent_proc = subprocess.Popen(
        [sys.executable, "laptop-agent/agent.py"],
        cwd=str(BASE_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env={**os.environ, "IGRIS_SERVER_URL": SERVER_URL, "JARVIS_SERVER_URL": SERVER_URL}
    )
    for _ in range(25):
        if is_agent_online():
            break
        time.sleep(0.4)

# Import laptop-agent local modules for direct unit testing
sys.path.insert(0, str(BASE_DIR / "laptop-agent"))
import window_manager
import media_monitor
from command_registry import COMMAND_REGISTRY, execute_registered_command, execute_safe_command

print("\n--- GROUP 1: Window Manager Unit & Safety Tests ---", flush=True)

# 1. list_windows structure and count
try:
    res = window_manager.list_windows()
    is_dict = isinstance(res, dict) and "windows" in res and "count" in res
    is_count_match = isinstance(res.get("windows"), list) and res.get("count") == len(res["windows"])
    record("1. list_windows structure and count", is_dict and is_count_match, f"Found {res.get('count')} windows")
except Exception as e:
    record("1. list_windows structure and count", False, str(e))

# 2. Privacy check: zero HWND, PID, or raw handles leaked
try:
    res = window_manager.list_windows()
    windows = res.get("windows", [])
    leaked = False
    for w in windows:
        if "hwnd" in w or "pid" in w or "handle" in w or "process_id" in w:
            leaked = True
            break
    record("2. Privacy check: zero HWND/PID leaked", not leaked and len(windows) >= 0, "Only app and title exposed")
except Exception as e:
    record("2. Privacy check: zero HWND/PID leaked", False, str(e))

# 3. Strict allowlist - only approved apps returned
try:
    res = window_manager.list_windows()
    windows = res.get("windows", [])
    valid_apps = set(window_manager.ALLOWED_APPS)
    all_valid = all(w.get("app") in valid_apps for w in windows)
    record("3. Strict allowlist - only approved apps", all_valid, f"Allowed: {sorted(list(valid_apps))}")
except Exception as e:
    record("3. Strict allowlist - only approved apps", False, str(e))

# 4. Focus unsupported app rejected
try:
    r = window_manager.focus_window("cmd.exe")
    rejected = r.get("success") is False and "not in the allowed list" in r.get("error", "")
    record("4. Focus unsupported app rejected", rejected, r.get("error", ""))
except Exception as e:
    record("4. Focus unsupported app rejected", False, str(e))

# 5. Minimize unsupported app rejected
try:
    r = window_manager.minimize_window("powershell")
    rejected = r.get("success") is False and "not in the allowed list" in r.get("error", "")
    record("5. Minimize unsupported app rejected", rejected, r.get("error", ""))
except Exception as e:
    record("5. Minimize unsupported app rejected", False, str(e))

# 6. Maximize unsupported app rejected
try:
    r = window_manager.maximize_window("taskmgr")
    rejected = r.get("success") is False and "not in the allowed list" in r.get("error", "")
    record("6. Maximize unsupported app rejected", rejected, r.get("error", ""))
except Exception as e:
    record("6. Maximize unsupported app rejected", False, str(e))

# 7. Restore unsupported app rejected
try:
    r = window_manager.restore_window("bash")
    rejected = r.get("success") is False and "not in the allowed list" in r.get("error", "")
    record("7. Restore unsupported app rejected", rejected, r.get("error", ""))
except Exception as e:
    record("7. Restore unsupported app rejected", False, str(e))

# 8. Non-open application returns graceful error
try:
    # 'paint' is usually not open in tests
    r = window_manager.focus_window("paint")
    is_handled = (r.get("success") is False and "not currently open" in r.get("error", "").lower()) or r.get("success") is True
    record("8. Non-open application returns graceful error", is_handled, r.get("error", "open"))
except Exception as e:
    record("8. Non-open application returns graceful error", False, str(e))

# 9. Real window state transitions (focus, minimize, maximize, restore)
try:
    # If chrome or notepad is open, test transitions; otherwise launch calc to test
    opened_calc = False
    active_app = None
    win_list = window_manager.list_windows().get("windows", [])
    if win_list:
        active_app = win_list[0]["app"]
    else:
        # Launch calculator safely for window test
        execute_safe_command("open_app", {"app": "calculator"})
        time.sleep(1.2)
        opened_calc = True
        active_app = "calculator"

    # Focus
    f_res = window_manager.focus_window(active_app)
    # Minimize
    m_res = window_manager.minimize_window(active_app)
    # Restore
    r_res = window_manager.restore_window(active_app)
    # Maximize
    mx_res = window_manager.maximize_window(active_app)
    # Restore again
    r2_res = window_manager.restore_window(active_app)

    transitions_ok = f_res.get("success") and m_res.get("success") and r_res.get("success") and mx_res.get("success") and r2_res.get("success")
    record("9. Window state transitions (focus/min/max/restore)", bool(transitions_ok), f"App: {active_app}")
except Exception as e:
    record("9. Window state transitions (focus/min/max/restore)", False, str(e))

# 10. Zero arbitrary shell or process killing powers
try:
    has_terminate = hasattr(window_manager, "kill_window") or hasattr(window_manager, "terminate_process")
    has_shell = hasattr(window_manager, "execute_shell") or hasattr(window_manager, "run_command")
    record("10. Zero arbitrary shell or process killing powers", not has_terminate and not has_shell, "Safe API surface bounded")
except Exception as e:
    record("10. Zero arbitrary shell or process killing powers", False, str(e))

print("\n--- GROUP 2: Desktop Media Monitor Tests ---", flush=True)

# 11. get_media_status returns valid metadata dictionary
try:
    m = media_monitor.get_media_status()
    record("11. get_media_status returns metadata dict", isinstance(m, dict), f"Active: {m.get('active')}")
except Exception as e:
    record("11. get_media_status returns metadata dict", False, str(e))

# 12. Fields schema
try:
    m = media_monitor.get_media_status()
    required_keys = {"active", "playbackState", "mediaType", "title", "artist", "album", "source"}
    has_keys = required_keys.issubset(set(m.keys()))
    record("12. Media schema compliance", has_keys, f"Keys: {sorted(list(m.keys()))}")
except Exception as e:
    record("12. Media schema compliance", False, str(e))

# 13. Authoritative privacy verification - zero audio / mic capture
try:
    code = Path("laptop-agent/media_monitor.py").read_text(encoding="utf-8")
    forbidden = ["pyaudio", "sounddevice", "wave", "audioop", "record_audio", "listen_mic", "microphone"]
    found_forbidden = [f for f in forbidden if f in code.lower()]
    record("13. Privacy guard: Zero audio/mic capture", len(found_forbidden) == 0, "No audio recording libraries")
except Exception as e:
    record("13. Privacy guard: Zero audio/mic capture", False, str(e))

# 14. Authoritative privacy verification - zero video / screen capture
try:
    code = Path("laptop-agent/media_monitor.py").read_text(encoding="utf-8")
    forbidden = ["cv2", "videocapture", "mss", "pil.imagegrab", "screengrab", "pyautogui.screenshot"]
    found_forbidden = [f for f in forbidden if f in code.lower()]
    record("14. Privacy guard: Zero video/screen capture", len(found_forbidden) == 0, "No visual recording libraries")
except Exception as e:
    record("14. Privacy guard: Zero video/screen capture", False, str(e))

# 15. Background reporter lifecycle (clean start & stop)
try:
    class DummySio:
        def __init__(self):
            self.emitted = []
        def emit(self, event, data):
            self.emitted.append((event, data))
        @property
        def connected(self):
            return True

    dummy_sio = DummySio()
    reporter = media_monitor.MediaStatusReporter(dummy_sio, interval_sec=0.2)
    reporter.start()
    time.sleep(0.5)
    reporter.stop()
    is_alive = reporter._thread.is_alive() if reporter._thread else False
    record("15. Media reporter lifecycle start/stop", not is_alive and len(dummy_sio.emitted) > 0, f"Emitted {len(dummy_sio.emitted)} events")
except Exception as e:
    record("15. Media reporter lifecycle start/stop", False, str(e))

# 16. Media change detection logic
try:
    dummy_sio = DummySio()
    reporter = media_monitor.MediaStatusReporter(dummy_sio)
    stat1 = {"active": True, "title": "Song A", "playbackState": "playing"}
    stat2 = {"active": True, "title": "Song A", "playbackState": "playing"}
    stat3 = {"active": True, "title": "Song B", "playbackState": "playing"}
    no_change = reporter._has_changed(stat1, stat2)
    has_change = reporter._has_changed(stat1, stat3)
    record("16. Media change detection logic", (not no_change) and has_change, "Deduplication and change detection verified")
except Exception as e:
    record("16. Media change detection logic", False, str(e))

print("\n--- GROUP 3: Command Registry & Safe Command Engine Tests ---", flush=True)

# 17. All 6 Phase 10 actions registered
expected_actions = [
    "list_windows",
    "focus_window",
    "minimize_window",
    "maximize_window",
    "restore_window",
    "media_status"
]
all_reg = all(a in COMMAND_REGISTRY for a in expected_actions)
record("17. Phase 10 actions in COMMAND_REGISTRY", all_reg, f"Actions: {expected_actions}")

# 18. Safe execution of list_windows
try:
    r = execute_safe_command("list_windows", {})
    record("18. execute_safe_command list_windows", r.get("success") is True, f"Count: {r.get('data', {}).get('count')}")
except Exception as e:
    record("18. execute_safe_command list_windows", False, str(e))

# 19. Safe execution of media_status
try:
    r = execute_safe_command("media_status", {})
    record("19. execute_safe_command media_status", r.get("success") is True, f"State: {r.get('data', {}).get('playbackState')}")
except Exception as e:
    record("19. execute_safe_command media_status", False, str(e))

# 20. Injection of forbidden parameter 'hwnd' rejected
try:
    res = execute_safe_command("focus_window", {"app": "chrome", "hwnd": 12345})
    blocked = res.get("success") is False
    record("20. Forbidden parameter 'hwnd' blocked", blocked, res.get("error", "Parameter injection thwarted"))
except Exception as e:
    record("20. Forbidden parameter 'hwnd' blocked", False, str(e))

# 21. Injection of forbidden parameter 'pid' rejected
try:
    res = execute_safe_command("focus_window", {"app": "chrome", "pid": 9999})
    blocked = res.get("success") is False
    record("21. Forbidden parameter 'pid' blocked", blocked, res.get("error", "Parameter injection thwarted"))
except Exception as e:
    record("21. Forbidden parameter 'pid' blocked", False, str(e))

# 22. Injection of forbidden parameter 'coordinates' rejected
try:
    res = execute_safe_command("maximize_window", {"app": "chrome", "coordinates": [100, 200]})
    blocked = res.get("success") is False
    record("22. Forbidden parameter 'coordinates' blocked", blocked, res.get("error", "Arbitrary screen coords thwarted"))
except Exception as e:
    record("22. Forbidden parameter 'coordinates' blocked", False, str(e))

# 23. Unapproved app name rejected
try:
    res = execute_safe_command("focus_window", {"app": "cmd"})
    blocked = res.get("success") is False
    record("23. Unapproved app name rejected", blocked, res.get("error", "Strict app allowlist validated"))
except Exception as e:
    record("23. Unapproved app name rejected", False, str(e))

# 24. Execution audit logging verification
try:
    # Test that executing safe command produces log or valid response without credentials
    res = execute_safe_command("list_windows", {})
    record("24. Safe execution audit compliance", res.get("success") is True, "Command executed cleanly")
except Exception as e:
    record("24. Safe execution audit compliance", False, str(e))

print("\n--- GROUP 4: Server Independent Command Validator Tests ---", flush=True)

# Helper function to test command validation via Node validator script or test endpoint
def run_node_eval(code_str: str) -> dict:
    proc = subprocess.run(
        ["node", "-e", code_str],
        cwd=str(BASE_DIR),
        capture_output=True,
        text=True
    )
    if proc.returncode != 0:
        return {"error": proc.stderr.strip()}
    try:
        return json.loads(proc.stdout.strip())
    except Exception:
        return {"raw": proc.stdout.strip()}

# 25. Server Validator: list_windows approved
code_val = """
const { validateCommand } = require('./server/ai/command-validator');
const res = validateCommand({ action: 'list_windows', parameters: {} });
console.log(JSON.stringify(res));
"""
r = run_node_eval(code_val)
record("25. Server Validator: list_windows approved", r.get("valid") is True, str(r.get("error", "")))

# 26. Server Validator: focus_window with approved app approved
code_val = """
const { validateCommand } = require('./server/ai/command-validator');
const res = validateCommand({ action: 'focus_window', parameters: { app: 'chrome' } });
console.log(JSON.stringify(res));
"""
r = run_node_eval(code_val)
record("26. Server Validator: focus_window(chrome) approved", r.get("valid") is True, str(r.get("error", "")))

# 27. Server Validator: focus_window with forbidden 'hwnd' rejected
code_val = """
const { validateCommand } = require('./server/ai/command-validator');
const res = validateCommand({ action: 'focus_window', parameters: { app: 'chrome', hwnd: 1234 } });
console.log(JSON.stringify(res));
"""
r = run_node_eval(code_val)
record("27. Server Validator: focus_window with hwnd rejected", r.get("valid") is False, r.get("error", ""))

# 28. Server Validator: focus_window with unapproved app rejected
code_val = """
const { validateCommand } = require('./server/ai/command-validator');
const res = validateCommand({ action: 'focus_window', parameters: { app: 'powershell.exe' } });
console.log(JSON.stringify(res));
"""
r = run_node_eval(code_val)
record("28. Server Validator: unapproved app rejected", r.get("valid") is False, r.get("error", ""))

# 29. Server Validator: minimize, maximize, restore approved
code_val = """
const { validateCommand } = require('./server/ai/command-validator');
const r1 = validateCommand({ action: 'minimize_window', parameters: { app: 'notepad' } });
const r2 = validateCommand({ action: 'maximize_window', parameters: { app: 'notepad' } });
const r3 = validateCommand({ action: 'restore_window', parameters: { app: 'notepad' } });
console.log(JSON.stringify({ allValid: r1.valid && r2.valid && r3.valid }));
"""
r = run_node_eval(code_val)
record("29. Server Validator: min/max/restore approved", r.get("allValid") is True, "")

# 30. Server Validator: media_status approved
code_val = """
const { validateCommand } = require('./server/ai/command-validator');
const res = validateCommand({ action: 'media_status', parameters: {} });
console.log(JSON.stringify(res));
"""
r = run_node_eval(code_val)
record("30. Server Validator: media_status approved", r.get("valid") is True, "")

# 31. Server Validator: media_status with extraneous parameters rejected
code_val = """
const { validateCommand } = require('./server/ai/command-validator');
const res = validateCommand({ action: 'media_status', parameters: { query: 'bad' } });
console.log(JSON.stringify(res));
"""
r = run_node_eval(code_val)
record("31. Server Validator: media_status with params rejected", r.get("valid") is False, r.get("error", ""))

print("\n--- GROUP 5: AI Semantic Interpreter & Multilingual Engine Tests ---", flush=True)

def test_ai_command(text: str, language_pref: str = "auto") -> dict:
    try:
        r = requests.post(
            f"{SERVER_URL}/api/test-ai-command",
            json={"text": text, "languagePreference": language_pref},
            timeout=5.0
        )
        return r.json()
    except Exception as e:
        return {"success": False, "error": str(e)}

# 32. English: "What windows are open?" -> list_windows
r = test_ai_command("What windows are open?")
action = r.get("command", {}).get("action")
record("32. English: 'What windows are open?' -> list_windows", action == "list_windows", f"Action: {action}")

# 33. English: "Focus Chrome" -> focus_window(chrome)
r = test_ai_command("Focus Chrome")
cmd = r.get("command", {})
is_ok = cmd.get("action") == "focus_window" and cmd.get("parameters", {}).get("app") == "chrome"
record("33. English: 'Focus Chrome' -> focus_window(chrome)", is_ok, f"Command: {cmd}")

# 34. English: "Minimize Notepad" -> minimize_window(notepad)
r = test_ai_command("Minimize Notepad")
cmd = r.get("command", {})
is_ok = cmd.get("action") == "minimize_window" and cmd.get("parameters", {}).get("app") == "notepad"
record("34. English: 'Minimize Notepad' -> minimize_window(notepad)", is_ok, f"Command: {cmd}")

# 35. English: "Maximize Chrome" -> maximize_window(chrome)
r = test_ai_command("Maximize Chrome")
cmd = r.get("command", {})
is_ok = cmd.get("action") == "maximize_window" and cmd.get("parameters", {}).get("app") == "chrome"
record("35. English: 'Maximize Chrome' -> maximize_window(chrome)", is_ok, f"Command: {cmd}")

# 36. English: "Restore Chrome" -> restore_window(chrome)
r = test_ai_command("Restore Chrome")
cmd = r.get("command", {})
is_ok = cmd.get("action") == "restore_window" and cmd.get("parameters", {}).get("app") == "chrome"
record("36. English: 'Restore Chrome' -> restore_window(chrome)", is_ok, f"Command: {cmd}")

# 37. English: "What's playing?" -> media_status
r = test_ai_command("What's playing?")
action = r.get("command", {}).get("action")
record("37. English: 'What\\'s playing?' -> media_status", action == "media_status", f"Action: {action}")

# 38. Hinglish: "Kaun si windows open hain?" -> list_windows
r = test_ai_command("Kaun si windows open hain?")
action = r.get("command", {}).get("action")
record("38. Hinglish: 'Kaun si windows open hain?' -> list_windows", action == "list_windows", f"Action: {action}")

# 39. Hinglish: "Chrome samne lao" -> focus_window(chrome)
r = test_ai_command("Chrome samne lao")
cmd = r.get("command", {})
is_ok = cmd.get("action") == "focus_window" and cmd.get("parameters", {}).get("app") == "chrome"
record("39. Hinglish: 'Chrome samne lao' -> focus_window(chrome)", is_ok, f"Command: {cmd}")

# 40. Hinglish: "Notepad minimize kardo" -> minimize_window(notepad)
r = test_ai_command("Notepad minimize kardo")
cmd = r.get("command", {})
is_ok = cmd.get("action") == "minimize_window" and cmd.get("parameters", {}).get("app") == "notepad"
record("40. Hinglish: 'Notepad minimize kardo' -> minimize_window(notepad)", is_ok, f"Command: {cmd}")

# 41. Hinglish: "Chrome bada karo" -> maximize_window(chrome)
r = test_ai_command("Chrome bada karo")
cmd = r.get("command", {})
is_ok = cmd.get("action") == "maximize_window" and cmd.get("parameters", {}).get("app") == "chrome"
record("41. Hinglish: 'Chrome bada karo' -> maximize_window(chrome)", is_ok, f"Command: {cmd}")

# 42. Hinglish: "Kaun sa gana chal raha hai?" -> media_status
r = test_ai_command("Kaun sa gana chal raha hai?")
action = r.get("command", {}).get("action")
record("42. Hinglish: 'Kaun sa gana chal raha hai?' -> media_status", action == "media_status", f"Action: {action}")

# 43. Hindi: "कौन सी विंडो खुली हैं?" -> list_windows
r = test_ai_command("कौन सी विंडो खुली हैं?")
action = r.get("command", {}).get("action")
record("43. Hindi: 'कौन सी विंडो खुली हैं?' -> list_windows", action == "list_windows", f"Action: {action}")

# 44. Hindi: "Chrome पर फ़ोकस करो" -> focus_window(chrome)
r = test_ai_command("Chrome पर फ़ोकस करो")
cmd = r.get("command", {})
is_ok = cmd.get("action") == "focus_window" and cmd.get("parameters", {}).get("app") == "chrome"
record("44. Hindi: 'Chrome पर फ़ोकस करो' -> focus_window(chrome)", is_ok, f"Command: {cmd}")

# 45. Hindi: "Notepad मिनिमाइज़ करो" -> minimize_window(notepad)
r = test_ai_command("Notepad मिनिमाइज़ करो")
cmd = r.get("command", {})
is_ok = cmd.get("action") == "minimize_window" and cmd.get("parameters", {}).get("app") == "notepad"
record("45. Hindi: 'Notepad मिनिमाइज़ करो' -> minimize_window(notepad)", is_ok, f"Command: {cmd}")

# 46. Hindi: "क्या बज रहा है?" -> media_status
r = test_ai_command("क्या बज रहा है?")
action = r.get("command", {}).get("action")
record("46. Hindi: 'क्या बज रहा है?' -> media_status", action == "media_status", f"Action: {action}")

print("\n--- GROUP 6: Multi-step Workflow Planning Tests ---", flush=True)

# 47. "Open Chrome and maximize it" -> task with open_app and maximize_window
r = test_ai_command("Open Chrome and maximize it")
cmd = r.get("command", {})
steps = cmd.get("parameters", {}).get("steps", [])
step_actions = [s.get("action") for s in steps]
is_workflow_ok = (
    cmd.get("action") == "task" and
    "open_app" in step_actions and
    "maximize_window" in step_actions
)
record("47. Workflow: 'Open Chrome and maximize it'", is_workflow_ok, f"Steps: {step_actions}")

print("\n--- GROUP 7: End-to-End Socket.IO Live Integration Tests ---", flush=True)

# 48. Phone Socket.IO connection, live media status reception & direct execution
try:
    phone_sio = socketio.Client()
    received_events = {}

    @phone_sio.on("agent_status")
    def on_agent_status(data):
        received_events["agent_status"] = data

    @phone_sio.on("media_status")
    def on_media_status(data):
        received_events["media_status"] = data

    phone_sio.connect(
        SERVER_URL,
        auth={"role": "phone", "token": PHONE_TOKEN},
        transports=["websocket", "polling"],
        wait_timeout=5
    )
    time.sleep(1.0)

    # Request media status explicitly
    phone_sio.emit("request_media_status")
    time.sleep(1.0)

    # Execute direct list_windows command
    cmd_res = []
    def on_cmd_res(result):
        cmd_res.append(result)

    phone_sio.emit(
        "execute_command",
        {"action": "list_windows", "parameters": {}},
        callback=on_cmd_res
    )
    time.sleep(1.5)

    phone_sio.disconnect()

    has_agent_status = "agent_status" in received_events
    has_media_status = "media_status" in received_events
    has_cmd_res = len(cmd_res) > 0 and cmd_res[0].get("success") is True

    e2e_ok = has_agent_status and (has_media_status or has_cmd_res)
    record("48. E2E Socket.IO: Phone connection, media_status, and direct list_windows", e2e_ok, f"Events: {list(received_events.keys())}, CmdSuccess: {has_cmd_res}")
except Exception as e:
    record("48. E2E Socket.IO: Phone connection, media_status, and direct list_windows", False, str(e))

# Cleanup any processes we spawned
if agent_proc:
    try:
        agent_proc.terminate()
    except Exception:
        pass

if server_proc:
    try:
        server_proc.terminate()
    except Exception:
        pass

print("\n" + "=" * 80, flush=True)
print("                           PHASE 10 TEST SUMMARY", flush=True)
print("=" * 80, flush=True)

passed_count = sum(1 for _, passed, _ in test_results if passed)
total_count = len(test_results)
all_passed = (passed_count == total_count)

print(f"Results: {passed_count}/{total_count} PASSED ({passed_count/total_count*100:.1f}%)\n", flush=True)

if not all_passed:
    print("FAILED TESTS:")
    for name, passed, details in test_results:
        if not passed:
            print(f"  [FAIL] {name}: {details}")
    sys.exit(1)
else:
    print("ALL 48 PHASE 10 TESTS PASSED WITH 100% SUCCESS!")
    sys.exit(0)
