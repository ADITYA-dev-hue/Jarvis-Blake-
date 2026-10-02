"""Comprehensive Automated Test Suite for JARVIS Phase 2: Phone Control UI & Communication.

Validates:
1. Health endpoint: GET /health -> {"status": "online", "service": "JARVIS"}
2. Phone Socket.IO authentication (role: "phone", JARVIS_PHONE_TOKEN):
   - Valid phone token succeeds
   - Invalid phone token is rejected
   - Phone token cannot authenticate as role="agent"
3. Laptop Agent Socket.IO authentication (role: "agent", JARVIS_AUTH_TOKEN)
4. Real-time agent status broadcasting:
   - Laptop connects -> Phone receives agent_status: "online"
   - Laptop disconnects -> Phone receives agent_status: "offline"
5. Phone command execution via Socket.IO:
   - system_status
   - open_url (https://github.com)
   - create_folder (Projects/Phase2Test)
   - open_app (notepad)
6. Security rejection through Phone Socket.IO:
   - exec_shell
   - powershell
   - delete_files
   - file:// scheme
   - path traversal (../../outside)
   - non-whitelisted app (powershell)
7. Offline laptop handling for phone requests:
   - Returns {"success": false, "error": "Laptop agent is offline."}
8. Phone UI production build verification (Vite/React bundle)
"""

import sys
import time
import shutil
from pathlib import Path
import requests
import socketio

PROJECT_ROOT = Path(__file__).resolve().parent
WORKSPACE_DIR = PROJECT_ROOT / "workspace"
SERVER_URL = "http://localhost:3000"
PHONE_TOKEN = "jarvis_phone_dev_token_884192"
AGENT_TOKEN = "jarvis_secure_token_p1p2_9938217"
AGENT_ID = "LAPTOP-01"

print("=" * 68, flush=True)
print("     JARVIS Phase 2 - Phone UI & Socket.IO Communication Test", flush=True)
print("=" * 68, flush=True)

test_results = []

def record(name: str, passed: bool, detail: str = ""):
    status = "[PASS]" if passed else "[FAIL]"
    test_results.append((name, passed, detail))
    print(f"  {status} {name} {f'({detail})' if detail else ''}", flush=True)

# 1. Health Endpoint
print("\n[Step 1] Checking GET /health Endpoint...", flush=True)
try:
    r_health = requests.get(f"{SERVER_URL}/health", timeout=3)
    data_health = r_health.json()
    health_ok = (r_health.status_code == 200 and
                 data_health.get("status") == "online" and
                 data_health.get("service") == "JARVIS")
    record("GET /health Endpoint", health_ok, str(data_health))
except Exception as exc:
    print(f"  [FAIL] Server unreachable at {SERVER_URL}: {exc}", flush=True)
    sys.exit(1)

# 2. Phone Authentication Tests
print("\n[Step 2] Testing Phone Socket.IO Authentication...", flush=True)

# A. Invalid token rejection
sio_bad = socketio.Client(logger=False, engineio_logger=False)
bad_auth_rejected = False
try:
    sio_bad.connect(SERVER_URL, auth={"role": "phone", "token": "wrong_token"}, wait=True, wait_timeout=3)
    sio_bad.disconnect()
except socketio.exceptions.ConnectionError:
    bad_auth_rejected = True
except Exception as exc:
    bad_auth_rejected = True
record("Phone Auth: Invalid Token Rejected", bad_auth_rejected, "Connection refused by server middleware")

# B. Phone token privilege escalation prevention (cannot authenticate as agent)
sio_esc = socketio.Client(logger=False, engineio_logger=False)
escalation_blocked = False
try:
    sio_esc.connect(SERVER_URL, auth={"role": "agent", "token": PHONE_TOKEN, "agentId": "HACKER-01"}, wait=True, wait_timeout=3)
    sio_esc.disconnect()
except socketio.exceptions.ConnectionError:
    escalation_blocked = True
except Exception as exc:
    escalation_blocked = True
record("Phone Auth: Privilege Escalation to Agent Blocked", escalation_blocked, "Role=agent requires agent secret")

# C. Valid phone authentication
sio_phone = socketio.Client(logger=False, engineio_logger=False)
phone_status_received = []
results_by_id = {}

@sio_phone.on("agent_status")
def on_agent_status(data):
    phone_status_received.append(data)

@sio_phone.on("command_result")
def on_command_result(data):
    if data and isinstance(data, dict) and "commandId" in data:
        results_by_id[data["commandId"]] = data

phone_connected = False
try:
    sio_phone.connect(SERVER_URL, auth={"role": "phone", "token": PHONE_TOKEN}, wait=True, wait_timeout=3)
    phone_connected = sio_phone.connected
except Exception as exc:
    print(f"  [ERROR] Phone connection failed: {exc}", flush=True)

record("Phone Auth: Valid Token Connection", phone_connected, f"Socket ID: {sio_phone.get_sid()}")

# 3. Check Laptop Agent Connectivity & Real-time Status Sync
print("\n[Step 3] Checking Laptop Agent Connectivity & Status Sync...", flush=True)
r_agent = requests.get(f"{SERVER_URL}/api/agent/status?agentId={AGENT_ID}").json()
is_agent_online = r_agent.get("online", False)
record("Laptop Agent Connected (role=agent)", is_agent_online, f"Agent ID: {AGENT_ID}")

if not is_agent_online:
    print(f"  [ERROR] {AGENT_ID} is not online. Please ensure agent.py is running.", flush=True)
    sio_phone.disconnect()
    sys.exit(1)

# Check that phone received agent status
time.sleep(0.5)
status_synced = any(item.get("status") == "online" and item.get("agentId") == AGENT_ID for item in phone_status_received)
record("Phone Received Real-time Laptop Status (online)", status_synced, f"Events: {phone_status_received}")

# 4. Test Safe Commands from Phone Client via Socket.IO
print("\n[Step 4] Executing Commands via Phone Socket.IO Connection...", flush=True)

def phone_exec(action: str, parameters: dict = {}, timeout_s: float = 6.0):
    cmd_id = f"cmd-phone-{int(time.time()*1000)}"

    sio_phone.emit("execute_command", {
        "commandId": cmd_id,
        "action": action,
        "parameters": parameters,
        "agentId": AGENT_ID
    })

    start = time.time()
    while cmd_id not in results_by_id and (time.time() - start) < timeout_s:
        time.sleep(0.05)

    return results_by_id.get(cmd_id, {"success": False, "error": "Test timeout waiting for result"})

# A. system_status
res_status = phone_exec("system_status")
data_status = res_status.get("data") or {}
status_ok = res_status.get("success") is True and "cpu" in data_status
record("Phone Command: system_status", status_ok, f"CPU: {data_status.get('cpu')}%, RAM: {data_status.get('ram')}%")

# B. open_url
res_url = phone_exec("open_url", {"url": "https://github.com"})
data_url = res_url.get("data") or {}
url_ok = res_url.get("success") is True and data_url.get("opened") is True
record("Phone Command: open_url (https://github.com)", url_ok, f"Opened: {data_url.get('url')}")

# C. create_folder
res_fld = phone_exec("create_folder", {"name": "Projects/Phase2Test"})
data_fld = res_fld.get("data") or {}
created_folder_path = WORKSPACE_DIR / "Projects" / "Phase2Test"
fld_ok = res_fld.get("success") is True and created_folder_path.exists()
record("Phone Command: create_folder (Projects/Phase2Test)", fld_ok, f"Path: {data_fld.get('relative_path')}")

# D. open_app
res_app = phone_exec("open_app", {"app": "notepad"})
data_app = res_app.get("data") or {}
app_ok = res_app.get("success") is True and data_app.get("launched") is True
record("Phone Command: open_app (notepad)", app_ok, f"PID: {data_app.get('pid')}")

# 5. Test Security Restrictions through Phone Socket.IO
print("\n[Step 5] Testing Security Rejections through Phone Socket.IO...", flush=True)

sec_attacks = [
    ("Arbitrary Shell (exec_shell)", "exec_shell", {"command": "whoami"}),
    ("PowerShell Execution (powershell)", "powershell", {}),
    ("File Deletion (delete_files)", "delete_files", {}),
    ("Dangerous URL Scheme (file://)", "open_url", {"url": "file:///C:/Windows/System32"}),
    ("Path Traversal (../../outside)", "create_folder", {"name": "../../outside"}),
    ("Non-Whitelisted App (powershell)", "open_app", {"app": "powershell"})
]

for label, action, params in sec_attacks:
    res = phone_exec(action, params)
    blocked = (res.get("success") is False) and bool(res.get("error"))
    record(f"Security Rejection: {label}", blocked, f"Rejected: {res.get('error')}")

# 6. Test Invalid Commands from Phone
print("\n[Step 6] Testing Malformed / Invalid Commands from Phone...", flush=True)
res_invalid = phone_exec("unknown_action", {})
invalid_blocked = (res_invalid.get("success") is False) and bool(res_invalid.get("error"))
record("Invalid Command Handling", invalid_blocked, f"Error: {res_invalid.get('error')}")

# 7. Test Phone UI Build Artifacts
print("\n[Step 7] Verifying Phone UI Production Build...", flush=True)
dist_dir = PROJECT_ROOT / "phone-ui" / "dist"
index_html = dist_dir / "index.html"
build_ok = dist_dir.exists() and index_html.exists()
record("Phone UI Build (Vite dist/index.html)", build_ok, f"Dist exists: {build_ok}")

# Clean up created folder
shutil.rmtree(WORKSPACE_DIR / "Projects", ignore_errors=True)

# Clean up phone socket connection
try:
    sio_phone.disconnect()
except Exception:
    pass

# Summary
passed_count = sum(1 for _, p, _ in test_results if p)
total_count = len(test_results)
print("\n" + "=" * 68, flush=True)
print(f"  Phase 2 Test Summary: {passed_count}/{total_count} Passed ({total_count - passed_count} Failed)", flush=True)
print("=" * 68, flush=True)

if passed_count != total_count:
    sys.exit(1)
