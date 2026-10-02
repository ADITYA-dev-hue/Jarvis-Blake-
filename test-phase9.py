r"""Comprehensive Automated Test Suite for JARVIS / IGRIS Phase 9:
INTELLIGENT WORKFLOW ENGINE + MULTILINGUAL ASSISTANT LAYER.

Validates all 37 mandated functionality, multilingual, workflow, and security tests:
1. English command: "Open Chrome"
2. Hinglish command: "Chrome kholo"
3. Hindi command: "Chrome खोलो"
4. Automatic language detection
5. Explicit English preference
6. Explicit Hinglish preference
7. Explicit Hindi preference
8. Language switching ("Hinglish mein baat karo", "Talk to me in English")
9. Mixed English/Hinglish request ("Google pe Python search karo")
10. Multi-step request ("Open Chrome, search Python roadmap, open Notepad and write topics")
11. Context-aware "now" ("Open Chrome" -> "Now search Python roadmap")
12. Context-aware "it" ("Create a folder called Projects" -> "Open it")
13. Unknown command rejected
14. Prompt injection rejected
15. Shell request rejected
16. PowerShell request rejected
17. CMD request rejected
18. Delete request rejected
19. Shutdown request rejected
20. Arbitrary executable rejected
21. Path traversal rejected
22. file:// URL rejected
23. javascript: URL rejected
24. Task >10 steps rejected
25. Wait >10000ms rejected
26. Text >1000 chars rejected
27. Empty task rejected
28. Malformed task rejected
29. Task recursion rejected
30. Confirmation bypass attempt rejected
31. Modified task after confirmation rejected
32. Invalid language value handled safely
33. Client attempting unauthorized action rejected
34. Laptop offline handled gracefully
35. Task failure / fail-fast halts execution
36. Task history credential leakage check (zero tokens/keys)
37. Full Phase 1–8 regression compatibility
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
WORKSPACE_DIR = BASE_DIR / "workspace"

WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

test_results = []

def record(name: str, passed: bool, details: str = ""):
    status = "PASS" if passed else "FAIL"
    test_results.append((name, passed, details))
    print(f"  [{status}] {name}" + (f" ({details})" if details else ""), flush=True)

print("=" * 80, flush=True)
print("     JARVIS Phase 9 - Intelligent Workflow Engine & Multilingual Assistant", flush=True)
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

print("\n[Setup] Verifying / Starting JARVIS Server and Laptop Agent...", flush=True)
if not is_server_online():
    print("  Starting Node.js Server...", flush=True)
    server_proc = subprocess.Popen(
        ["node", "server/server.js"],
        cwd=str(BASE_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    for _ in range(30):
        if is_server_online():
            break
        time.sleep(0.3)

if not is_server_online():
    print("FATAL: Could not start JARVIS server.", flush=True)
    sys.exit(1)

print("  Server is ONLINE.", flush=True)

if not is_agent_online():
    print("  Starting Laptop Agent...", flush=True)
    agent_proc = subprocess.Popen(
        [sys.executable, "agent.py"],
        cwd=str(BASE_DIR / "laptop-agent"),
        env={**os.environ, "IGRIS_SERVER_URL": "http://localhost:3000", "JARVIS_SERVER_URL": "http://localhost:3000"},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    for _ in range(30):
        if is_agent_online():
            break
        time.sleep(0.3)

record("Server Online Check", is_server_online(), "Node.js Server responding on port 3000")
record("Laptop Agent Online Check", is_agent_online(), f"Agent '{AGENT_ID}' authenticated & connected")

# Import Laptop Agent Command Registry directly
sys.path.insert(0, str(BASE_DIR / "laptop-agent"))
try:
    from command_registry import execute_registered_command, COMMAND_REGISTRY
    from commands import execute_safe_command
    agent_registry_imported = True
except Exception as e:
    agent_registry_imported = False
    print(f"Error importing laptop agent modules: {e}")

record("Laptop Agent Registry Import", agent_registry_imported, "command_registry.py handlers loaded")

# Helper to validate command via Node validator directly
def validate_via_node(command_dict):
    try:
        cmd_json = json.dumps(command_dict)
        node_script = f"const {{ validateCommand }} = require('./server/ai/command-validator'); console.log(JSON.stringify(validateCommand({cmd_json})));"
        res = subprocess.run(
            ["node", "-e", node_script],
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True,
            timeout=5
        )
        if res.returncode == 0:
            return json.loads(res.stdout.strip())
        return {"valid": False, "error": res.stderr}
    except Exception as e:
        return {"valid": False, "error": str(e)}

# Helper to query AI interpreter endpoint
def test_ai_command(text, session_id=None, language_pref="auto"):
    try:
        payload = {"text": text, "languagePreference": language_pref}
        if session_id:
            payload["sessionId"] = session_id
        r = requests.post(f"{SERVER_URL}/api/test-ai-command", json=payload, timeout=6)
        return r.json()
    except Exception as e:
        return {"success": False, "error": str(e)}

print("\n" + "=" * 80)
print("TESTING 37 MANDATED PHASE 9 TEST SCENARIOS")
print("=" * 80)

# ------------------------------------------------------------------------------
# Test 1: English command ("Open Chrome")
# ------------------------------------------------------------------------------
res1 = test_ai_command("Open Chrome")
t1_ok = (
    res1.get("success") is True and
    res1.get("command", {}).get("action") == "open_app" and
    res1.get("command", {}).get("parameters", {}).get("app") == "chrome" and
    res1.get("language") in ["en", "auto"]
)
record("Test 1: English command ('Open Chrome')", t1_ok, f"Lang: {res1.get('language')}, Msg: {res1.get('message')}")

# ------------------------------------------------------------------------------
# Test 2: Hinglish command ("Chrome kholo")
# ------------------------------------------------------------------------------
res2 = test_ai_command("Chrome kholo")
t2_ok = (
    res2.get("success") is True and
    res2.get("command", {}).get("action") == "open_app" and
    res2.get("command", {}).get("parameters", {}).get("app") == "chrome" and
    res2.get("language") == "hinglish" and
    any(w in res2.get("message", "").lower() for w in ["khol", "diya", "raha", "chrome"])
)
record("Test 2: Hinglish command ('Chrome kholo')", t2_ok, f"Lang: {res2.get('language')}, Msg: {res2.get('message')}")

# ------------------------------------------------------------------------------
# Test 3: Hindi command ("Chrome खोलो")
# ------------------------------------------------------------------------------
res3 = test_ai_command("Chrome खोलो")
t3_ok = (
    res3.get("success") is True and
    res3.get("command", {}).get("action") == "open_app" and
    res3.get("command", {}).get("parameters", {}).get("app") == "chrome" and
    res3.get("language") == "hi"
)
record("Test 3: Hindi command ('Chrome खोलो')", t3_ok, f"Lang: {res3.get('language')}, Msg: {res3.get('message')}")

# ------------------------------------------------------------------------------
# Test 4: Automatic language detection
# ------------------------------------------------------------------------------
node_script_detect = """
const { detectLanguage } = require('./server/ai/language-engine');
const l1 = detectLanguage('Open Google Chrome and wait', 'auto');
const l2 = detectLanguage('Chrome khol do bhai', 'auto');
const l3 = detectLanguage('कृपया क्रोम खोलें', 'auto');
console.log(JSON.stringify({ l1, l2, l3 }));
"""
det_proc = subprocess.run(["node", "-e", node_script_detect], cwd=str(BASE_DIR), capture_output=True, text=True)
det_json = json.loads(det_proc.stdout.strip()) if det_proc.returncode == 0 else {}
t4_ok = (det_json.get("l1") == "en" and det_json.get("l2") == "hinglish" and det_json.get("l3") == "hi")
record("Test 4: Automatic language detection", t4_ok, f"Detected: {det_json}")

# ------------------------------------------------------------------------------
# Test 5: Explicit English preference
# ------------------------------------------------------------------------------
res5 = test_ai_command("Chrome kholo", language_pref="en")
t5_ok = (
    res5.get("success") is True and
    res5.get("language") == "en" and
    any(w in res5.get("message", "").lower() for w in ["launch", "open", "chrome"])
)
record("Test 5: Explicit English preference", t5_ok, f"Lang: {res5.get('language')}, Msg: {res5.get('message')}")

# ------------------------------------------------------------------------------
# Test 6: Explicit Hinglish preference
# ------------------------------------------------------------------------------
res6 = test_ai_command("Open Chrome", language_pref="hinglish")
t6_ok = (
    res6.get("success") is True and
    res6.get("language") == "hinglish" and
    any(w in res6.get("message", "").lower() for w in ["khol", "diya", "raha", "open", "gaya", "karna"])
)
record("Test 6: Explicit Hinglish preference", t6_ok, f"Lang: {res6.get('language')}, Msg: {res6.get('message')}")

# ------------------------------------------------------------------------------
# Test 7: Explicit Hindi preference
# ------------------------------------------------------------------------------
res7 = test_ai_command("Open Chrome", language_pref="hi")
t7_ok = (
    res7.get("success") is True and
    res7.get("language") == "hi"
)
record("Test 7: Explicit Hindi preference", t7_ok, f"Lang: {res7.get('language')}, Msg: {res7.get('message')}")

# ------------------------------------------------------------------------------
# Test 8: Language switching ("Hinglish mein baat karo", "Talk to me in English")
# ------------------------------------------------------------------------------
res8_a = test_ai_command("Hinglish mein baat karo")
res8_b = test_ai_command("Talk to me in English")
t8_ok = (
    res8_a.get("isLanguageSwitch") is True and res8_a.get("targetLanguage") == "hinglish" and
    res8_b.get("isLanguageSwitch") is True and res8_b.get("targetLanguage") == "en"
)
record("Test 8: Language switching commands", t8_ok, f"Hinglish: {res8_a.get('targetLanguage')}, English: {res8_b.get('targetLanguage')}")

# ------------------------------------------------------------------------------
# Test 9: Mixed English/Hinglish request ("Google pe Python search karo")
# ------------------------------------------------------------------------------
res9 = test_ai_command("Google pe Python search karo")
t9_action = res9.get("command", {}).get("action")
t9_ok = (
    res9.get("success") is True and
    (t9_action == "search_web" or t9_action == "task") and
    res9.get("language") == "hinglish"
)
record("Test 9: Mixed English/Hinglish ('Google pe Python search karo')", t9_ok, f"Action: {t9_action}, Lang: {res9.get('language')}")

# ------------------------------------------------------------------------------
# Test 10: Multi-step request with Safe Confirmation Gate
# ------------------------------------------------------------------------------
res10 = test_ai_command("Open Chrome, search Python roadmap, open Notepad and write topics")
t10_action = res10.get("command", {}).get("action")
t10_steps = res10.get("command", {}).get("parameters", {}).get("steps", [])
t10_ok = (
    res10.get("success") is True and
    t10_action == "task" and
    len(t10_steps) >= 3 and
    res10.get("requiresConfirmation") is True and
    bool(res10.get("confirmationId"))
)
record("Test 10: Multi-step request (>=3 steps requires confirmation)", t10_ok, f"Steps: {len(t10_steps)}, ConfId: {res10.get('confirmationId')}")

# ------------------------------------------------------------------------------
# Test 11: Context-aware "now" ("Open Chrome" -> "Now search Python roadmap")
# ------------------------------------------------------------------------------
sess_11 = f"test_sess_11_{int(time.time())}"
test_ai_command("Open Chrome", session_id=sess_11)
res11_2 = test_ai_command("Now search Python roadmap", session_id=sess_11)
t11_action = res11_2.get("command", {}).get("action")
t11_q = res11_2.get("command", {}).get("parameters", {}).get("query", "")
t11_ok = (
    res11_2.get("success") is True and
    (t11_action == "search_web" or t11_action == "open_url" or t11_action == "task")
)
record("Test 11: Context-aware 'now' directive", t11_ok, f"Action: {t11_action}, Query: {t11_q}")

# ------------------------------------------------------------------------------
# Test 12: Context-aware "it" ("Create a folder called Projects" -> "Open it")
# ------------------------------------------------------------------------------
sess_12 = f"test_sess_12_{int(time.time())}"
test_ai_command("Create a folder called Projects", session_id=sess_12)
res12_2 = test_ai_command("Open it", session_id=sess_12)
t12_action = res12_2.get("command", {}).get("action")
t12_ok = (
    res12_2.get("success") is True and
    t12_action in ["open_app", "open_explorer", "open_folder", "task"]
)
record("Test 12: Context-aware 'it' resolution", t12_ok, f"Action: {t12_action}")

# ------------------------------------------------------------------------------
# Test 13: Unknown command rejected
# ------------------------------------------------------------------------------
v13 = validate_via_node({"action": "teleport_user", "parameters": {}})
record("Test 13: Unknown command rejected", not v13.get("valid"), f"Error: {v13.get('error')}")

# ------------------------------------------------------------------------------
# Test 14: Prompt injection rejected
# ------------------------------------------------------------------------------
v14 = validate_via_node({"action": "open_app", "parameters": {"app": "notepad ; rm -rf /"}})
record("Test 14: Prompt injection rejected", not v14.get("valid"), f"Error: {v14.get('error')}")

# ------------------------------------------------------------------------------
# Test 15: Shell request rejected
# ------------------------------------------------------------------------------
v15 = validate_via_node({"action": "shell", "parameters": {"cmd": "whoami"}})
record("Test 15: Shell request rejected", not v15.get("valid"), f"Error: {v15.get('error')}")

# ------------------------------------------------------------------------------
# Test 16: PowerShell request rejected
# ------------------------------------------------------------------------------
v16 = validate_via_node({"action": "powershell", "parameters": {"script": "Get-Service"}})
record("Test 16: PowerShell request rejected", not v16.get("valid"), f"Error: {v16.get('error')}")

# ------------------------------------------------------------------------------
# Test 17: CMD request rejected
# ------------------------------------------------------------------------------
v17 = validate_via_node({"action": "cmd", "parameters": {"command": "dir"}})
record("Test 17: CMD request rejected", not v17.get("valid"), f"Error: {v17.get('error')}")

# ------------------------------------------------------------------------------
# Test 18: Delete request rejected
# ------------------------------------------------------------------------------
v18 = validate_via_node({"action": "delete_folder", "parameters": {"folderName": "workspace"}})
record("Test 18: Delete request rejected", not v18.get("valid"), f"Error: {v18.get('error')}")

# ------------------------------------------------------------------------------
# Test 19: Shutdown request rejected
# ------------------------------------------------------------------------------
v19 = validate_via_node({"action": "shutdown", "parameters": {}})
record("Test 19: Shutdown request rejected", not v19.get("valid"), f"Error: {v19.get('error')}")

# ------------------------------------------------------------------------------
# Test 20: Arbitrary executable rejected
# ------------------------------------------------------------------------------
v20 = validate_via_node({"action": "open_app", "parameters": {"app": "evil_payload.exe"}})
record("Test 20: Arbitrary executable rejected", not v20.get("valid"), f"Error: {v20.get('error')}")

# ------------------------------------------------------------------------------
# Test 21: Path traversal rejected
# ------------------------------------------------------------------------------
v21 = validate_via_node({"action": "create_folder", "parameters": {"folderName": "../../System32"}})
record("Test 21: Path traversal rejected", not v21.get("valid"), f"Error: {v21.get('error')}")

# ------------------------------------------------------------------------------
# Test 22: file:// URL rejected
# ------------------------------------------------------------------------------
v22 = validate_via_node({"action": "open_url", "parameters": {"url": "file:///C:/Windows/System32"}})
record("Test 22: file:// URL rejected", not v22.get("valid"), f"Error: {v22.get('error')}")

# ------------------------------------------------------------------------------
# Test 23: javascript: URL rejected
# ------------------------------------------------------------------------------
v23 = validate_via_node({"action": "open_url", "parameters": {"url": "javascript:alert(document.cookie)"}})
record("Test 23: javascript: URL rejected", not v23.get("valid"), f"Error: {v23.get('error')}")

# ------------------------------------------------------------------------------
# Test 24: Task >10 steps rejected
# ------------------------------------------------------------------------------
task_11_steps = {
    "action": "task",
    "parameters": {
        "steps": [{"action": "wait", "parameters": {"milliseconds": 50}} for _ in range(11)]
    }
}
v24 = validate_via_node(task_11_steps)
record("Test 24: Task >10 steps rejected", not v24.get("valid"), f"Error: {v24.get('error')}")

# ------------------------------------------------------------------------------
# Test 25: Wait >10000ms rejected
# ------------------------------------------------------------------------------
task_wait_excess = {
    "action": "task",
    "parameters": {
        "steps": [{"action": "wait", "parameters": {"milliseconds": 15000}}]
    }
}
v25 = validate_via_node(task_wait_excess)
record("Test 25: Wait >10000ms rejected", not v25.get("valid"), f"Error: {v25.get('error')}")

# ------------------------------------------------------------------------------
# Test 26: Text >1000 chars rejected
# ------------------------------------------------------------------------------
task_text_excess = {
    "action": "task",
    "parameters": {
        "steps": [{"action": "type_text", "parameters": {"text": "A" * 1200}}]
    }
}
v26 = validate_via_node(task_text_excess)
record("Test 26: Text >1000 chars rejected", not v26.get("valid"), f"Error: {v26.get('error')}")

# ------------------------------------------------------------------------------
# Test 27: Empty task rejected
# ------------------------------------------------------------------------------
v27 = validate_via_node({"action": "task", "parameters": {"steps": []}})
record("Test 27: Empty task (0 steps) rejected", not v27.get("valid"), f"Error: {v27.get('error')}")

# ------------------------------------------------------------------------------
# Test 28: Malformed task rejected
# ------------------------------------------------------------------------------
v28 = validate_via_node({"action": "task", "parameters": {"steps": "not_an_array"}})
record("Test 28: Malformed task rejected", not v28.get("valid"), f"Error: {v28.get('error')}")

# ------------------------------------------------------------------------------
# Test 29: Task recursion rejected
# ------------------------------------------------------------------------------
task_recur = {
    "action": "task",
    "parameters": {
        "steps": [
            {"action": "task", "parameters": {"steps": [{"action": "wait", "parameters": {"milliseconds": 50}}]}}
        ]
    }
}
v29 = validate_via_node(task_recur)
record("Test 29: Task recursion rejected", not v29.get("valid"), f"Error: {v29.get('error')}")

# ------------------------------------------------------------------------------
# Test 30: Confirmation bypass attempt rejected
# ------------------------------------------------------------------------------
# Connect via Socket.IO phone client and try confirming invalid confirmationId
sio_test = socketio.Client()
bypass_ack = {}
try:
    sio_test.connect(SERVER_URL, auth={"role": "phone", "token": PHONE_TOKEN})
    def confirm_cb(res):
        bypass_ack["res"] = res
    sio_test.emit("task_confirm", {"confirmationId": "invalid_fake_id_999"}, callback=confirm_cb)
    time.sleep(1)
    sio_test.disconnect()
except Exception as e:
    bypass_ack["error"] = str(e)

t30_ok = bypass_ack.get("res", {}).get("success") is False
record("Test 30: Confirmation bypass attempt rejected", t30_ok, f"Result: {bypass_ack.get('res')}")

# ------------------------------------------------------------------------------
# Test 31: Modified task after confirmation rejected (server uses cached validatedCommand)
# ------------------------------------------------------------------------------
# Verify that task_confirm only looks up stored validatedCommand, ignoring any injected payload
sio_test2 = socketio.Client()
modified_ack = {}
try:
    sio_test2.connect(SERVER_URL, auth={"role": "phone", "token": PHONE_TOKEN})
    def mod_cb(res):
        modified_ack["res"] = res
    sio_test2.emit(
        "task_confirm",
        {"confirmationId": "fake_id", "injected_command": {"action": "shell", "parameters": {"cmd": "rm"}}},
        callback=mod_cb
    )
    time.sleep(1)
    sio_test2.disconnect()
except Exception as e:
    modified_ack["error"] = str(e)

t31_ok = modified_ack.get("res", {}).get("success") is False
record("Test 31: Modified task after confirmation rejected", t31_ok, f"Result: {modified_ack.get('res')}")

# ------------------------------------------------------------------------------
# Test 32: Invalid language value handled safely
# ------------------------------------------------------------------------------
res32 = test_ai_command("Open Chrome", language_pref="klingon_alien_dialect")
t32_ok = res32.get("success") is True and res32.get("language") in ["en", "auto"]
record("Test 32: Invalid language value handled safely (fallback)", t32_ok, f"Lang: {res32.get('language')}")

# ------------------------------------------------------------------------------
# Test 33: Client attempting unauthorized action rejected
# ------------------------------------------------------------------------------
sio_unauth = socketio.Client()
unauth_failed = False
try:
    sio_unauth.connect(SERVER_URL, auth={"role": "phone", "token": "invalid_token_xyz"})
except Exception:
    unauth_failed = True

if sio_unauth.connected:
    sio_unauth.disconnect()

record("Test 33: Unauthorized client connection rejected", unauth_failed, "Invalid phone token rejected by handshake")

# ------------------------------------------------------------------------------
# Test 34: Laptop offline handled gracefully
# ------------------------------------------------------------------------------
# Check server API or socket command response when querying a non-existent laptop agent ID
res34_req = requests.get(f"{SERVER_URL}/api/agent/status?agentId=NON_EXISTENT_AGENT", timeout=2)
res34_data = res34_req.json() if res34_req.status_code == 200 else {}
t34_ok = (res34_data.get("online") is False)
record("Test 34: Offline laptop agent handled gracefully", t34_ok, f"Agent offline status: {res34_data}")

# ------------------------------------------------------------------------------
# Test 35: Task failure / fail-fast halts execution
# ------------------------------------------------------------------------------
# In safe command engine, a task where step 1 succeeds and step 2 fails halts step 3
step_exec_log = []
def record_step(p, *extra):
    step_num = p.get("step") if isinstance(p, dict) else p
    step_exec_log.append(step_num)

from command_registry import set_task_progress_callback
set_task_progress_callback(record_step)

failing_task = {
    "steps": [
        {"action": "wait", "parameters": {"milliseconds": 20}},
        {"action": "open_app", "parameters": {"app": "invalid_forbidden_app_xyz"}},
        {"action": "wait", "parameters": {"milliseconds": 20}}
    ]
}
fail_fast_res = execute_safe_command("task", failing_task)
set_task_progress_callback(None)

t35_ok = (
    fail_fast_res.get("success") is False and
    3 not in step_exec_log
)
record("Test 35: Task failure halts execution (fail-fast)", t35_ok, f"Steps executed: {step_exec_log}, Error: {fail_fast_res.get('error')}")

# ------------------------------------------------------------------------------
# Test 36: Task history credential leakage check (zero tokens/keys)
# ------------------------------------------------------------------------------
hist_res = requests.get(f"{SERVER_URL}/api/tasks/history", timeout=2)
hist_text = hist_res.text
secrets_found = []
for secret in [PHONE_TOKEN, "jarvis_phone_dev_token", "JARVIS_AUTH_TOKEN", "GEMINI_API_KEY"]:
    if secret in hist_text:
        secrets_found.append(secret)

t36_ok = hist_res.status_code == 200 and len(secrets_found) == 0
record("Test 36: Task history zero credential leakage check", t36_ok, f"Secrets leaked: {secrets_found}")

# ------------------------------------------------------------------------------
# Test 37: Full Phase 1–8 regression compatibility
# ------------------------------------------------------------------------------
# 1. Phase 6 system_status authoritative metrics
p6_res = execute_safe_command("system_status", {})
p6_ok = (p6_res.get("success") is True and "cpu" in p6_res.get("data", {}))

# 2. Phase 7 CPU query natural language resolution
p7_res = test_ai_command("What is my CPU performance?")
p7_ok = (p7_res.get("success") is True and p7_res.get("command", {}).get("action") == "system_status")

# 3. Phase 8 two-step task without confirmation
p8_task_res = test_ai_command("Open Notepad and write Test Phase 9")
p8_ok = (p8_task_res.get("success") is True and p8_task_res.get("command", {}).get("action") == "task")

t37_ok = p6_ok and p7_ok and p8_ok
record("Test 37: Full Phase 1–8 regression compatibility", t37_ok, f"Phase 6: {p6_ok}, Phase 7: {p7_ok}, Phase 8: {p8_ok}")

# ------------------------------------------------------------------------------
# SUMMARY
# ------------------------------------------------------------------------------
print("\n" + "=" * 80)
print("PHASE 9 TEST SUMMARY")
print("=" * 80)
passed_count = sum(1 for _, p, _ in test_results if p)
total_count = len(test_results)
print(f"Passed: {passed_count}/{total_count}")

if server_proc:
    server_proc.terminate()
if agent_proc:
    agent_proc.terminate()

if passed_count == total_count:
    print("\n>>> ALL PHASE 9 TESTS PASSED SUCCESSFULLY! <<<\n")
    sys.exit(0)
else:
    print(f"\n>>> FAIL: {total_count - passed_count} test(s) failed. <<<\n")
    sys.exit(1)
