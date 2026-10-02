"""Automated End-to-End Test Suite for JARVIS Phase 1.

Validates authentication, connection lifecycle, all 4 safe commands,
and all strict security boundaries (arbitrary shell rejection, path traversal rejection).
"""

import sys
import time
import requests
import socketio

SERVER_URL = "http://localhost:3000"
VALID_TOKEN = "jarvis_secret_token_2026"
INVALID_TOKEN = "wrong_token_xyz"

total_tests = 0
passed_tests = 0
failed_tests = 0


def record_result(test_name: str, passed: bool, detail: str = ""):
    global total_tests, passed_tests, failed_tests
    total_tests += 1
    if passed:
        passed_tests += 1
        print(f"  [PASS] {test_name} {f'({detail})' if detail else ''}")
    else:
        failed_tests += 1
        print(f"  [FAIL] {test_name} - {detail}")


def test_auth_rejection():
    """Test 1: Server must reject client with invalid authentication token."""
    print("\n--- Test 1: Authentication Security ---")
    bad_sio = socketio.Client(reconnection=False, logger=False, engineio_logger=False)
    rejected = False
    try:
        bad_sio.connect(SERVER_URL, auth={"token": INVALID_TOKEN, "role": "client"}, wait_timeout=3)
        bad_sio.disconnect()
    except Exception as exc:
        rejected = True
        record_result("Reject Invalid Token", True, str(exc))
    if not rejected:
        record_result("Reject Invalid Token", False, "Server incorrectly accepted invalid token!")


def main():
    print("=" * 60)
    print("       JARVIS Phase 1 - Automated Verification Suite")
    print("=" * 60)

    # 0. Check Server Health
    print("\n--- Pre-Flight: Checking Server Health ---")
    try:
        r = requests.get(f"{SERVER_URL}/health", timeout=3)
        data = r.json()
        print(f"  Server Status: {data.get('status')} | Agent Online: {data.get('agentOnline')}")
        record_result("Server Reachable", r.status_code == 200)
    except Exception as e:
        print(f"  [ERROR] Server is not running at {SERVER_URL}: {e}")
        sys.exit(1)

    test_auth_rejection()

    # Connect with valid credentials
    print("\n--- Test 2: Valid Socket Connection ---")
    client_sio = socketio.Client(reconnection=False, logger=False, engineio_logger=False)
    agent_status_received = {}

    @client_sio.on("agent_status")
    def on_status(data):
        agent_status_received.update(data)

    try:
        client_sio.connect(
            SERVER_URL,
            auth={"token": VALID_TOKEN, "role": "client"},
            wait=True,
            wait_timeout=5
        )
        record_result("Authenticated Connection", True, f"Socket ID: {client_sio.sid}")
    except Exception as exc:
        record_result("Authenticated Connection", False, str(exc))
        sys.exit(1)

    time.sleep(1)

    if not agent_status_received.get("online"):
        print("\n  [NOTICE] Waiting for laptop agent to come online...")
        # Give a short grace period
        for _ in range(5):
            if agent_status_received.get("online"):
                break
            time.sleep(1)

    is_online = agent_status_received.get("online", False)
    record_result("Laptop Agent Online", is_online, f"Agent info: {agent_status_received.get('agentInfo')}")

    if not is_online:
        print("\n[WARNING] Laptop agent is offline! Start 'agent.py' to run command tests.")
        client_sio.disconnect()
        return

    # Helper function to send command and wait for response
    def send_cmd(cmd_name: str, params: dict = None) -> dict:
        result_holder = {}
        done = False

        def cb(res):
            nonlocal done
            result_holder.update(res)
            done = True

        client_sio.emit("send_command", {"command": cmd_name, "params": params or {}}, callback=cb)
        timeout = time.time() + 8
        while not done and time.time() < timeout:
            time.sleep(0.1)
        return result_holder

    print("\n--- Test 3: Safe Command - system_status ---")
    res = send_cmd("system_status")
    if res.get("success") and "cpu" in res.get("data", {}) and "memory" in res.get("data", {}):
        cpu_usage = res["data"]["cpu"]["usage_percent"]
        ram_used = res["data"]["memory"]["used"]
        record_result("system_status Execution", True, f"CPU: {cpu_usage}%, RAM: {ram_used}")
    else:
        record_result("system_status Execution", False, str(res.get("error")))

    print("\n--- Test 4: Safe Command - create_folder (Legitimate & Nested) ---")
    legit_folders = ["TestFolder", "Projects", "EduPrep", "Projects/Test", "Projects/EduPrep"]
    for fld in legit_folders:
        res = send_cmd("create_folder", {"folder_name": fld})
        if res.get("success") and res.get("data", {}).get("created"):
            record_result(f"create_folder '{fld}'", True, f"Created {res['data']['relative_path']}")
        else:
            record_result(f"create_folder '{fld}'", False, str(res.get("error")))

    print("\n--- Test 5: Security Check - Path Traversal Vectors ---")
    bad_folders = [
        "../../ExploitFolder",
        "../",
        r"..\evil",
        r"C:\Windows\System32",
        r"\\server\share\exploit",
        "/root_folder",
        "Projects/../../escape"
    ]
    all_traversals_blocked = True
    for bad in bad_folders:
        res = send_cmd("create_folder", {"folder_name": bad})
        blocked = (not res.get("success")) and (
            "forbidden" in str(res.get("error")).lower() or
            "security violation" in str(res.get("error")).lower() or
            "resolves outside" in str(res.get("error")).lower()
        )
        if blocked:
            record_result(f"Blocked Traversal '{bad}'", True, res.get("error"))
        else:
            all_traversals_blocked = False
            record_result(f"Blocked Traversal '{bad}'", False, f"Failed to block: {res}")

    print("\n--- Test 6: Safe Command - open_url (Valid HTTP/HTTPS) ---")
    res = send_cmd("open_url", {"url": "https://example.com"})
    if res.get("success") and res.get("data", {}).get("opened"):
        record_result("open_url Valid HTTPS", True, res["data"]["url"])
    else:
        record_result("open_url Valid HTTPS", False, str(res.get("error")))

    print("\n--- Test 7: Security Check - open_url Invalid Scheme (file://) ---")
    res = send_cmd("open_url", {"url": "file:///C:/Windows/System32/calc.exe"})
    if not res.get("success") and "only 'http' and 'https'" in str(res.get("error")).lower():
        record_result("open_url Non-HTTP Scheme Blocked", True, f"Blocked: {res.get('error')}")
    else:
        record_result("open_url Non-HTTP Scheme Blocked", False, f"Unexpected: {res}")

    print("\n--- Test 8: Safe Command - open_app (Whitelisted: calculator) ---")
    res = send_cmd("open_app", {"app_name": "calculator"})
    if res.get("success") and res.get("data", {}).get("launched"):
        record_result("open_app Whitelisted (calculator)", True, f"PID: {res['data']['pid']}")
    else:
        record_result("open_app Whitelisted (calculator)", False, str(res.get("error")))

    print("\n--- Test 9: Security Check - open_app Non-Whitelisted App ---")
    res = send_cmd("open_app", {"app_name": "cmd.exe"})
    if not res.get("success") and "not whitelisted" in str(res.get("error")).lower():
        record_result("open_app Non-Whitelisted Blocked", True, f"Blocked: {res.get('error')}")
    else:
        record_result("open_app Non-Whitelisted Blocked", False, f"Unexpected: {res}")

    print("\n--- Test 10: Security Check - Disallow Arbitrary Commands ---")
    res = send_cmd("shell_exec", {"cmd": "whoami"})
    if not res.get("success") and ("rejected" in str(res.get("error")).lower() or "disallowed" in str(res.get("error")).lower()):
        record_result("Arbitrary Command Blocked", True, f"Blocked: {res.get('error')}")
    else:
        record_result("Arbitrary Command Blocked", False, f"Unexpected: {res}")

    print("\n--- Test 11: REST API /api/command ---")
    try:
        resp = requests.post(
            f"{SERVER_URL}/api/command",
            headers={"Authorization": f"Bearer {VALID_TOKEN}"},
            json={"command": "system_status", "params": {}},
            timeout=5
        )
        data = resp.json()
        record_result("REST API Command Execution", data.get("success") is True, f"Status: {resp.status_code}")
    except Exception as exc:
        record_result("REST API Command Execution", False, str(exc))

    client_sio.disconnect()

    print("\n" + "=" * 60)
    print(f"Test Summary: {passed_tests}/{total_tests} Passed ({failed_tests} Failed)")
    print("=" * 60)


if __name__ == "__main__":
    main()
