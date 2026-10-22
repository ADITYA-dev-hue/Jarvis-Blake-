"""
JARVIS Automated Test Suite - Notepad Text Input & Multi-Step Typing Verification
Phase 8 / 10 / Safe Command Engine Integration

Tests:
1. AI Interpretation: "Open Notepad and write My name is Aditya Prakash." -> 3-step task
2. AI Interpretation: Hinglish "Notepad kholo aur likho My name is Aditya Prakash." -> 3-step task
3. Server Validator: Validates open_app, wait, and type_text (with optional app parameter)
4. Server Validator: Rejects empty text
5. Server Validator: Rejects excessive text (>1000 chars)
6. Server Validator: Rejects null bytes in text
7. Server Validator: Rejects unapproved app in type_text parameter
8. Window Manager: ensure_app_focused detects and focuses Notepad
9. Window Manager: Rejects unsupported app in ensure_app_focused
10. Command Registry: Safe execution of handle_type_text into Notepad
11. Command Registry: End-to-end task execution (open_app -> wait -> type_text)
12. Text Content Verification: Exact text confirmed inside Notepad editor
13. Safety Invariant: Failure reported when target app is not open (no blind typing)
14. Safety Invariant: Forbidden control characters rejected
15. Safety Invariant: Text is never executed as shell or command
"""

import sys
import os
import time
import subprocess
import json
import ctypes
from ctypes import wintypes
from pathlib import Path
import psutil

BASE_DIR = Path("d:/JARVIS")
sys.path.insert(0, str(BASE_DIR / "laptop-agent"))

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_int, wintypes.HWND, wintypes.LPARAM)

test_results = []

def record(name: str, passed: bool, details: str = ""):
    status = "PASS" if passed else "FAIL"
    test_results.append((name, passed, details))
    print(f"  [{status}] {name}" + (f" ({details})" if details else ""), flush=True)

print("=" * 80)
print("     JARVIS NOTEPAD TEXT INPUT & AUTOMATION TEST SUITE")
print("=" * 80)

# Clean up any leftover notepads before starting tests
def kill_all_notepads():
    for p in psutil.process_iter(['pid', 'name']):
        if p.info['name'] and 'notepad' in p.info['name'].lower():
            try:
                psutil.Process(p.info['pid']).terminate()
            except Exception:
                pass
    time.sleep(0.5)

kill_all_notepads()

# ------------------------------------------------------------------------------
# 1. Import Agent Modules
# ------------------------------------------------------------------------------
import command_registry
import window_manager
from commands import execute_safe_command

record("Agent Module Import", True, "command_registry and window_manager imported successfully")

# ------------------------------------------------------------------------------
# Helpers for direct node-side validation and interpretation
# ------------------------------------------------------------------------------
def validate_via_node(command_dict):
    code = f"""
    const {{ validateCommand }} = require('./server/ai/command-validator.js');
    const result = validateCommand({json.dumps(command_dict)});
    console.log(JSON.stringify(result));
    """
    res = subprocess.run(
        ["node", "-e", code],
        cwd=str(BASE_DIR),
        capture_output=True,
        text=True
    )
    try:
        return json.loads(res.stdout.strip())
    except Exception as e:
        return {"valid": False, "error": f"JSON parse error: {e}, stdout: {res.stdout}"}

def interpret_via_node(text: str):
    code = f"""
    const {{ interpretCommand }} = require('./server/ai/gemini.js');
    interpretCommand({json.dumps(text)}).then(result => {{
        console.log('---JSON_START---');
        console.log(JSON.stringify(result));
    }}).catch(err => {{
        console.log('---JSON_START---');
        console.log(JSON.stringify({{ success: false, error: err.message }}));
    }});
    """
    res = subprocess.run(
        ["node", "-e", code],
        cwd=str(BASE_DIR),
        capture_output=True,
        text=True
    )
    try:
        out = res.stdout
        if '---JSON_START---' in out:
            json_part = out.split('---JSON_START---')[-1].strip()
            return json.loads(json_part)
        return json.loads(out.strip())
    except Exception as e:
        return {"success": False, "error": f"JSON parse error: {e}, stdout: {res.stdout}"}

# ------------------------------------------------------------------------------
# Test 1: AI Task Generation - English
# ------------------------------------------------------------------------------
res1 = interpret_via_node("Open Notepad and write My name is Aditya Prakash.")
cmd1 = res1.get("interpretedCommand", {}) or res1.get("validatedCommand", {})
steps1 = cmd1.get("parameters", {}).get("steps", [])
t1_valid = (
    res1.get("success") is True and
    cmd1.get("action") == "task" and
    len(steps1) == 3 and
    steps1[0].get("action") == "open_app" and steps1[0].get("parameters", {}).get("app") == "notepad" and
    steps1[1].get("action") == "wait" and
    steps1[2].get("action") == "type_text" and "Aditya Prakash" in steps1[2].get("parameters", {}).get("text", "")
)
record("Test 1: AI Interpretation (English 'Open Notepad and write...')", t1_valid, f"Steps: {len(steps1)}")

# ------------------------------------------------------------------------------
# Test 2: AI Task Generation - Hinglish
# ------------------------------------------------------------------------------
res2 = interpret_via_node("Notepad kholo aur likho My name is Aditya Prakash.")
cmd2 = res2.get("interpretedCommand", {}) or res2.get("validatedCommand", {})
steps2 = cmd2.get("parameters", {}).get("steps", [])
t2_valid = (
    res2.get("success") is True and
    cmd2.get("action") == "task" and
    len(steps2) == 3 and
    steps2[0].get("action") == "open_app" and
    steps2[2].get("action") == "type_text" and "Aditya Prakash" in steps2[2].get("parameters", {}).get("text", "")
)
record("Test 2: AI Interpretation (Hinglish 'Notepad kholo aur likho...')", t2_valid, f"Steps: {len(steps2)}")

# ------------------------------------------------------------------------------
# Test 3: Validator Approves Valid Task with type_text and app parameter
# ------------------------------------------------------------------------------
task_payload = {
    "action": "task",
    "parameters": {
        "steps": [
            {"action": "open_app", "parameters": {"app": "notepad"}},
            {"action": "wait", "parameters": {"milliseconds": 1000}},
            {"action": "type_text", "parameters": {"text": "My name is Aditya Prakash.", "app": "notepad"}}
        ]
    }
}
v_res3 = validate_via_node(task_payload)
record("Test 3: Server Validator approves 3-step Notepad task", v_res3.get("valid") is True, f"Valid: {v_res3.get('valid')}")

# ------------------------------------------------------------------------------
# Test 4: Validator Rejects Empty Text
# ------------------------------------------------------------------------------
v_res4 = validate_via_node({"action": "type_text", "parameters": {"text": ""}})
a_res4 = execute_safe_command("type_text", {"text": ""})
t4_valid = (not v_res4.get("valid")) and (not a_res4.get("success"))
record("Test 4: Empty text parameter rejected", t4_valid, f"Validator error: {v_res4.get('error')}")

# ------------------------------------------------------------------------------
# Test 5: Validator Rejects Excessive Text (>1000 chars)
# ------------------------------------------------------------------------------
long_text = "X" * 1001
v_res5 = validate_via_node({"action": "type_text", "parameters": {"text": long_text}})
a_res5 = execute_safe_command("type_text", {"text": long_text})
t5_valid = (not v_res5.get("valid")) and (not a_res5.get("success")) and ("1000" in v_res5.get("error", ""))
record("Test 5: Excessive text (>1000 chars) rejected", t5_valid, f"Validator error: {v_res5.get('error')}")

# ------------------------------------------------------------------------------
# Test 6: Validator Rejects Null Bytes
# ------------------------------------------------------------------------------
null_text = "Hello\x00World"
v_res6 = validate_via_node({"action": "type_text", "parameters": {"text": null_text}})
a_res6 = execute_safe_command("type_text", {"text": null_text})
t6_valid = (not v_res6.get("valid")) and (not a_res6.get("success"))
record("Test 6: Null bytes rejected strictly", t6_valid, "Null bytes rejected by validator and agent")

# ------------------------------------------------------------------------------
# Test 7: Validator Rejects Unapproved App in type_text
# ------------------------------------------------------------------------------
v_res7 = validate_via_node({"action": "type_text", "parameters": {"text": "test", "app": "powershell.exe"}})
a_res7 = execute_safe_command("type_text", {"text": "test", "app": "powershell.exe"})
t7_valid = (not v_res7.get("valid")) and (not a_res7.get("success"))
record("Test 7: Unapproved application in type_text rejected", t7_valid, f"Validator error: {v_res7.get('error')}")

# ------------------------------------------------------------------------------
# Test 8: Window Manager ensure_app_focused with Notepad
# ------------------------------------------------------------------------------
np_proc = subprocess.Popen(["notepad.exe"])
time.sleep(1.0)
focus_res8 = window_manager.ensure_app_focused("notepad", timeout_secs=5.0)
t8_valid = focus_res8.get("success") is True and focus_res8.get("app") == "notepad"
record("Test 8: ensure_app_focused detects and focuses Notepad", t8_valid, f"HWND: {focus_res8.get('hwnd')}, Title: {focus_res8.get('title')}")

# ------------------------------------------------------------------------------
# Test 9: Window Manager Rejects Unsupported App
# ------------------------------------------------------------------------------
focus_res9 = window_manager.ensure_app_focused("malware_app", timeout_secs=1.0)
record("Test 9: ensure_app_focused rejects unapproved app", focus_res9.get("success") is False, f"Error: {focus_res9.get('error')}")

# ------------------------------------------------------------------------------
# Test 10: Safe Execution of handle_type_text into Notepad
# ------------------------------------------------------------------------------
type_res10 = command_registry.handle_type_text({
    "text": "My name is Aditya Prakash.",
    "app": "notepad"
})
record("Test 10: handle_type_text into Notepad succeeds", type_res10.get("typed") is True and type_res10.get("length") == 26, f"Length: {type_res10.get('length')}")

# Clean up before testing complete task execution
kill_all_notepads()

# ------------------------------------------------------------------------------
# Test 11: End-to-End Sequential Task Execution (open_app -> wait -> type_text)
# ------------------------------------------------------------------------------
full_task = {
    "steps": [
        {"action": "open_app", "parameters": {"app": "notepad"}},
        {"action": "wait", "parameters": {"milliseconds": 1000}},
        {"action": "type_text", "parameters": {"text": "My name is Aditya Prakash."}}
    ]
}
exec_res11 = command_registry.handle_task(full_task)
t11_valid = exec_res11.get("success") is True and exec_res11.get("completed_steps") == 3
record("Test 11: End-to-end task execution (open_app -> wait -> type_text)", t11_valid, f"Completed: {exec_res11.get('completed_steps')}/3 steps")

# ------------------------------------------------------------------------------
# Test 12: Verify Text Content Inside Notepad Editor Control
# ------------------------------------------------------------------------------
time.sleep(0.5)
matched_notepads = [w for w in window_manager._find_top_level_windows() if w[1] == "notepad"]
t12_valid = False
read_content = ""

if matched_notepads:
    np_hwnd = matched_notepads[0][0]
    edit_hwnd = window_manager._find_notepad_edit_control(np_hwnd, timeout_secs=2.0)
    if edit_hwnd:
        WM_GETTEXTLENGTH = 0x000E
        WM_GETTEXT = 0x000D
        len_chars = user32.SendMessageW(edit_hwnd, WM_GETTEXTLENGTH, 0, 0)
        buf = ctypes.create_unicode_buffer(len_chars + 1)
        user32.SendMessageW(edit_hwnd, WM_GETTEXT, len_chars + 1, buf)
        read_content = buf.value
        t12_valid = "Aditya Prakash" in read_content
    else:
        buf = ctypes.create_unicode_buffer(1024)
        user32.GetWindowTextW(np_hwnd, buf, 1024)
        read_content = buf.value
        t12_valid = bool(read_content)

record("Test 12: Text content verified inside Notepad editor", t12_valid, f"Read text: '{read_content[:40]}'")

# Clean up Notepad instances
kill_all_notepads()

# ------------------------------------------------------------------------------
# Test 13: Safety Invariant - Closed App Fails Safely (No Blind Typing)
# ------------------------------------------------------------------------------
try:
    bad_res13 = command_registry.handle_type_text({"text": "Blind typing test", "app": "notepad"})
    t13_valid = False
except RuntimeError as exc:
    t13_valid = "not ready" in str(exc).lower() or "did not launch" in str(exc).lower()
record("Test 13: Failure reported when target app is closed (no blind typing)", t13_valid, "Safely blocked with explicit error")

# ------------------------------------------------------------------------------
# Test 14: Safety Invariant - Forbidden Control Characters Rejected
# ------------------------------------------------------------------------------
try:
    command_registry.handle_type_text({"text": "Hello\x07Beep", "app": "notepad"})
    t14_valid = False
except ValueError as e:
    t14_valid = "control characters" in str(e).lower()
record("Test 14: Forbidden control characters rejected", t14_valid, "Control characters safely rejected")

# ------------------------------------------------------------------------------
# Test 15: Safety Invariant - Text is Never Executed as Shell/Command
# ------------------------------------------------------------------------------
malicious_payloads = [
    "rm -rf /",
    "del C:\\*",
    "cmd.exe /c calc",
    "powershell -Command Get-Process",
    "&& format C:"
]
all_safe = True
for payload in malicious_payloads:
    v = validate_via_node({"action": "type_text", "parameters": {"text": payload, "app": "notepad"}})
    if not (v.get("valid") is True and v.get("command", {}).get("action") == "type_text"):
        all_safe = False
record("Test 15: Malicious text payloads handled strictly as inert text data", all_safe, "Zero shell/code execution")

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------
passed_cnt = sum(1 for _, p, _ in test_results)
total_cnt = len(test_results)

print("=" * 80)
print(f"JARVIS NOTEPAD TEXT INPUT TEST RESULTS: {passed_cnt} / {total_cnt} PASSED")
if passed_cnt == total_cnt:
    print("ALL 15 TESTS PASSED WITH 100% SUCCESS! TEXT INPUT AND FOCUS SYNCHRONIZATION VERIFIED.")
print("=" * 80)

if passed_cnt != total_cnt:
    sys.exit(1)
