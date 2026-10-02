"""Comprehensive Test Suite for JARVIS Phase 1 Part 3: Safe Command Communication.

Validates:
1. Health endpoint: GET /health -> {"status": "online", "service": "JARVIS"}
2. All safe commands via POST /api/test-command:
   - system_status
   - open_url
   - create_folder
   - open_app
3. Security rejections through Socket.IO:
   - Arbitrary shell (exec_shell)
   - PowerShell (powershell)
   - Unknown action (delete_everything)
   - Invalid URL scheme (file://)
   - Path traversal (../../outside)
   - Non-whitelisted app (powershell)
4. Invalid/Malformed command handling (agent resilience):
   - Empty payload ({})
   - Missing action
   - Invalid parameters
   - Unknown action
   - Non-dict parameters
5. Command timeout handling
6. Offline laptop agent handling
"""

import sys
import time
import shutil
from pathlib import Path
import requests

PROJECT_ROOT = Path(__file__).resolve().parent
WORKSPACE_DIR = PROJECT_ROOT / "workspace"
SERVER_URL = "http://localhost:3000"
TEST_ENDPOINT = f"{SERVER_URL}/api/test-command"
AGENT_ID = "LAPTOP-01"

print("=" * 65, flush=True)
print("     JARVIS Phase 1 Part 3 - Safe Command Communication Test", flush=True)
print("=" * 65, flush=True)

test_results = []

def record(name: str, passed: bool, detail: str = ""):
    status = "[PASS]" if passed else "[FAIL]"
    test_results.append((name, passed, detail))
    print(f"  {status} {name} {f'({detail})' if detail else ''}", flush=True)

# 1. Health Endpoint Verification
print("\n[Step 1] Checking GET /health Endpoint...", flush=True)
try:
    r_health = requests.get(f"{SERVER_URL}/health", timeout=3)
    data_health = r_health.json()
    health_ok = (r_health.status_code == 200 and
                 data_health.get("status") == "online" and
                 data_health.get("service") in ["IGRIS", "JARVIS"])
    record("GET /health Endpoint", health_ok, str(data_health))
except Exception as exc:
    print(f"  [FAIL] Server unreachable at {SERVER_URL}: {exc}", flush=True)
    sys.exit(1)

# 2. Check Offline Laptop Detection (Requirement 11)
print("\n[Step 2] Testing Offline Laptop Agent Handling...", flush=True)
r_offline = requests.post(TEST_ENDPOINT, json={
    "agentId": "UNREGISTERED-AGENT-99",
    "action": "system_status",
    "parameters": {}
}).json()
is_offline_handled = (r_offline.get("success") is False) and ("offline" in r_offline.get("error", "").lower())
record("Offline Laptop Detection", is_offline_handled, f"Response: {r_offline}")

# 3. Check LAPTOP-01 Online Status
print("\n[Step 3] Verifying LAPTOP-01 is Connected...", flush=True)
r_status = requests.get(f"{SERVER_URL}/api/agent/status?agentId={AGENT_ID}").json()
is_online = r_status.get("online", False)
record("Agent Handshake & Connectivity", is_online, f"Agent ID: {AGENT_ID}")
if not is_online:
    print(f"  [ERROR] {AGENT_ID} is not connected. Please start agent.py before running tests.", flush=True)
    sys.exit(1)

# 4. Test All 4 Safe Commands (Requirement 7)
print("\n[Step 4] Testing All 4 Safe Commands...", flush=True)

# A. system_status
res_status = requests.post(TEST_ENDPOINT, json={
    "commandId": "cmd-001",
    "agentId": AGENT_ID,
    "action": "system_status",
    "parameters": {}
}).json()
data_status = res_status.get("data") or {}
status_ok = res_status.get("success") is True and "cpu" in data_status
record("Safe Command: system_status", status_ok, f"CPU: {data_status.get('cpu')}%, RAM: {data_status.get('ram')}%")

# B. open_url
res_url = requests.post(TEST_ENDPOINT, json={
    "commandId": "cmd-002",
    "agentId": AGENT_ID,
    "action": "open_url",
    "parameters": {"url": "https://github.com"}
}).json()
data_url = res_url.get("data") or {}
url_ok = res_url.get("success") is True and data_url.get("opened") is True
record("Safe Command: open_url (https://github.com)", url_ok, f"Opened: {data_url.get('url')}")

# C. create_folder
res_fld = requests.post(TEST_ENDPOINT, json={
    "commandId": "cmd-003",
    "agentId": AGENT_ID,
    "action": "create_folder",
    "parameters": {"name": "Projects/Phase1SocketTest"}
}).json()
created_path = WORKSPACE_DIR / "Projects" / "Phase1SocketTest"
data_fld = res_fld.get("data") or {}
fld_ok = res_fld.get("success") is True and created_path.exists()
record("Safe Command: create_folder (Projects/Phase1SocketTest)", fld_ok, f"Created: {data_fld.get('relative_path')}")

# D. open_app (notepad)
res_app = requests.post(TEST_ENDPOINT, json={
    "commandId": "cmd-004",
    "agentId": AGENT_ID,
    "action": "open_app",
    "parameters": {"app": "notepad"}
}).json()
data_app = res_app.get("data") or {}
app_ok = res_app.get("success") is True and data_app.get("launched") is True
record("Safe Command: open_app (notepad)", app_ok, f"PID: {data_app.get('pid')}")

# 5. Test Security Through Socket.IO (Section 12)
print("\n[Step 5] Testing Security Enforcements Through Socket.IO...", flush=True)

security_cases = [
    ("A. Arbitrary Shell (exec_shell)", {"action": "exec_shell", "parameters": {"command": "whoami"}}),
    ("B. PowerShell (powershell)", {"action": "powershell", "parameters": {}}),
    ("C. File Deletion (delete_files)", {"action": "delete_files", "parameters": {}}),
    ("D. Invalid URL Scheme (file:///C:/Windows/System32)", {"action": "open_url", "parameters": {"url": "file:///C:/Windows/System32"}}),
    ("E. Path Traversal (../../outside)", {"action": "create_folder", "parameters": {"name": "../../outside"}}),
    ("F. Non-Whitelisted App (powershell)", {"action": "open_app", "parameters": {"app": "powershell"}})
]

for label, payload in security_cases:
    payload["agentId"] = AGENT_ID
    payload["commandId"] = f"sec-{int(time.time()*1000)}"
    res = requests.post(TEST_ENDPOINT, json=payload).json()
    blocked = (res.get("success") is False) and bool(res.get("error"))
    record(f"Security: {label}", blocked, f"Rejected with: {res.get('error')}")

# 6. Test Invalid/Malformed Command Handling (Section 13)
print("\n[Step 6] Testing Invalid/Malformed Command Resilience...", flush=True)

malformed_cases = [
    ("Empty Payload ({})", {}),
    ("Missing Action (commandId: 'test')", {"commandId": "test"}),
    ("Unknown Command Action", {"commandId": "test", "action": "unknown_command", "parameters": {}}),
    ("Missing Parameters for open_url", {"commandId": "test", "action": "open_url", "parameters": {}}),
    ("Non-Dict Parameters", {"commandId": "test", "action": "create_folder", "parameters": "not-a-dict"})
]

for label, payload in malformed_cases:
    payload["agentId"] = AGENT_ID
    res = requests.post(TEST_ENDPOINT, json=payload).json()
    handled = (res.get("success") is False) and bool(res.get("error"))
    record(f"Malformed: {label}", handled, f"Error: {res.get('error')}")

# Verify agent is still alive and responsive after all malformed payloads
res_alive = requests.post(TEST_ENDPOINT, json={"agentId": AGENT_ID, "action": "system_status"}).json()
agent_survived = res_alive.get("success") is True
record("Agent Resilience After Malformed Requests", agent_survived, "Agent is healthy and responsive")

# 7. Test Command Timeout Handling (Requirement 10)
print("\n[Step 7] Testing Command Timeout Handling...", flush=True)
res_timeout = requests.post(TEST_ENDPOINT, json={
    "commandId": "cmd-timeout-test",
    "agentId": AGENT_ID,
    "action": "system_status",
    "parameters": {},
    "timeoutMs": 1  # 1ms triggers immediate timeout on server
}).json()
timeout_handled = (res_timeout.get("success") is False) and ("timed out" in res_timeout.get("error", "").lower())
record("Command Timeout Handling", timeout_handled, f"Response: {res_timeout}")

# Clean up created test folder
test_folder = WORKSPACE_DIR / "Projects"
if test_folder.exists():
    shutil.rmtree(test_folder, ignore_errors=True)

# Summary
passed_count = sum(1 for _, p, _ in test_results if p)
total_count = len(test_results)
print("\n" + "=" * 65, flush=True)
print(f"  Test Summary: {passed_count}/{total_count} Passed ({total_count - passed_count} Failed)", flush=True)
print("=" * 65, flush=True)

if passed_count != total_count:
    sys.exit(1)
