"""Automated Reconnection Test for JARVIS Phase 1 Part 2.

Tests Scenarios D & E:
D. Stop server -> Laptop detects disconnection (Server unavailable, Reconnecting...)
E. Restart server -> Laptop automatically reconnects (Reconnected successfully, Status: ONLINE)
"""

import os
import sys
import time
import subprocess
import requests
import socketio

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
SERVER_DIR = os.path.join(PROJECT_ROOT, "server")
SERVER_URL = "http://localhost:3000"
VALID_TOKEN = "jarvis_secure_token_p1p2_9938217"
AGENT_ID = "LAPTOP-01"

print("=" * 60)
print("  JARVIS Phase 1 Part 2 - Lifecycle & Reconnection Test")
print("=" * 60)

server_proc = None

def start_server():
    print("-> Starting Node.js Relay Server...")
    proc = subprocess.Popen(
        ["node", "server.js"],
        cwd=SERVER_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    # Wait for server to become responsive
    for _ in range(20):
        try:
            r = requests.get(f"{SERVER_URL}/health", timeout=1)
            if r.status_code == 200:
                print("-> Server is up and listening on port 3000.")
                return proc
        except Exception:
            time.sleep(0.5)
    raise RuntimeError("Failed to start server within timeout.")

def stop_server(proc):
    print("-> Stopping Node.js Server (Simulating server crash / maintenance)...")
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except Exception:
        proc.kill()
    time.sleep(1)
    print("-> Server process stopped.")

# 1. Start server initially
server_proc = start_server()

# 2. Setup Laptop Agent Socket Client with Reconnection
connection_events = []
is_connected = False
has_initially_connected = False

sio = socketio.Client(
    reconnection=True,
    reconnection_attempts=0,
    reconnection_delay=1,
    reconnection_delay_max=2,
    logger=False,
    engineio_logger=False
)

@sio.event
def connect():
    global is_connected, has_initially_connected
    is_connected = True
    if not has_initially_connected:
        has_initially_connected = True
        print("\n[Laptop Output]")
        print("Authentication successful")
        print("Connected to JARVIS Server")
        print("Status: ONLINE")
        print("Waiting for commands...\n")
        connection_events.append("INITIAL_CONNECT")
    else:
        print("\n[Laptop Output]")
        print("Reconnected successfully")
        print("Status: ONLINE\n")
        connection_events.append("RECONNECT")

@sio.event
def disconnect():
    global is_connected
    is_connected = False
    print("\n[Laptop Output]")
    print("Server unavailable")
    print("Reconnecting...\n")
    connection_events.append("DISCONNECT")

# Connect initial client
print("-> Connecting Laptop Agent to Server...")
sio.connect(
    SERVER_URL,
    auth={"token": VALID_TOKEN, "role": "agent", "agentId": AGENT_ID},
    wait=True,
    wait_timeout=5
)
time.sleep(1)
assert "INITIAL_CONNECT" in connection_events, "Initial connection must succeed"
assert is_connected, "Agent must be connected"

# 3. Test Scenario D: Stop Server
print("-" * 50)
print("[Scenario D] Stopping server to test disconnection detection...")
stop_server(server_proc)

# Wait for client to notice disconnect
timeout = time.time() + 8
while is_connected and time.time() < timeout:
    time.sleep(0.2)

assert not is_connected, "Agent should detect server is offline"
assert "DISCONNECT" in connection_events, "DISCONNECT event must be recorded"
print("  [PASS] Scenario D: Disconnection successfully detected.")

# 4. Test Scenario E: Restart Server
print("-" * 50)
print("[Scenario E] Restarting server to test automatic reconnection...")
server_proc = start_server()

# Wait for client to automatically reconnect
timeout = time.time() + 10
while ("RECONNECT" not in connection_events) and time.time() < timeout:
    time.sleep(0.3)

assert "RECONNECT" in connection_events, "RECONNECT event must be recorded"
assert is_connected, "Agent must have reconnected successfully"
print("  [PASS] Scenario E: Automatic reconnection succeeded!")

# Cleanup
sio.disconnect()
stop_server(server_proc)

print("\n" + "=" * 60)
print("  All Lifecycle & Reconnection Scenarios Passed (100%)")
print("=" * 60)
