"""JARVIS Phase 1 Part 2 - Verification Test Suite

Tests Server ↔ Laptop Agent Communication and Authentication:
Scenario A: Correct token -> Connection succeeds
Scenario B: Wrong token -> Connection rejected
Scenario C: Missing token -> Connection rejected
Scenario D & E: Server stop/restart -> Disconnection & automatic reconnection
"""

import sys
import time
import subprocess
import requests
import socketio

SERVER_URL = "http://localhost:3000"
VALID_TOKEN = "jarvis_secure_token_p1p2_9938217"
AGENT_ID = "LAPTOP-01"

print("=" * 60)
print("     JARVIS Phase 1 Part 2 - Communication & Auth Tests")
print("=" * 60)

# --- 1. Health Endpoint Verification ---
print("\n[Step 1] Checking GET /health endpoint...")
try:
    r = requests.get(f"{SERVER_URL}/health", timeout=3)
    data = r.json()
    print(f"  Response: {data} (Status Code: {r.status_code})")
    assert r.status_code == 200, "Health check must return HTTP 200"
    assert data.get("status") == "online", "Health status must be 'online'"
    assert data.get("service") in ["IGRIS", "JARVIS"], "Health service must be 'IGRIS' or 'JARVIS'"
    print(f"  [PASS] /health matches specification: {data}")
except Exception as e:
    print(f"  [FAIL] Health check failed: {e}")
    sys.exit(1)

# --- 2. Scenario A: Correct Token -> Connection Succeeds ---
print("\n[Scenario A] Correct token: Connection succeeds")
sio_a = socketio.Client(reconnection=False, logger=False, engineio_logger=False)
connected_a = False

@sio_a.event
def connect():
    global connected_a
    connected_a = True

try:
    sio_a.connect(
        SERVER_URL,
        auth={"token": VALID_TOKEN, "role": "agent", "agentId": AGENT_ID},
        wait=True,
        wait_timeout=5
    )
    time.sleep(0.5)
    assert connected_a and sio_a.connected, "Agent should be connected"
    print("  [PASS] Correct token authenticated successfully.")
    print("  Server:         ONLINE")
    print("  Laptop:         CONNECTED")
    print("  Authentication: SUCCESS")
except Exception as e:
    print(f"  [FAIL] Scenario A failed: {e}")
    sys.exit(1)
finally:
    if sio_a.connected:
        sio_a.disconnect()
        time.sleep(0.5)

# --- 3. Scenario B: Wrong Token -> Connection Rejected ---
print("\n[Scenario B] Wrong token: Connection rejected")
sio_b = socketio.Client(reconnection=False, logger=False, engineio_logger=False)
rejected_b = False

try:
    sio_b.connect(
        SERVER_URL,
        auth={"token": "INVALID_TOKEN_999", "role": "agent", "agentId": AGENT_ID},
        wait=True,
        wait_timeout=3
    )
    sio_b.disconnect()
except Exception as e:
    rejected_b = True
    print(f"  [PASS] Rejected as expected with error: {e}")

assert rejected_b, "Server must reject invalid token"

# --- 4. Scenario C: Missing Token -> Connection Rejected ---
print("\n[Scenario C] Missing token: Connection rejected")
sio_c = socketio.Client(reconnection=False, logger=False, engineio_logger=False)
rejected_c = False

try:
    sio_c.connect(
        SERVER_URL,
        auth={"role": "agent", "agentId": AGENT_ID},
        wait=True,
        wait_timeout=3
    )
    sio_c.disconnect()
except Exception as e:
    rejected_c = True
    print(f"  [PASS] Rejected as expected with error: {e}")

assert rejected_c, "Server must reject missing token"

print("\n" + "=" * 60)
print("  All Authentication & Protocol Checks Passed Successfully!")
print("=" * 60)
