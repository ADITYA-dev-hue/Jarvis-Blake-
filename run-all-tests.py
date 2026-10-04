import sys
import os
import time
import subprocess
import requests
from pathlib import Path

BASE_DIR = Path("d:/JARVIS")
PYTHON_EXE = sys.executable

def is_server_online():
    try:
        r = requests.get("http://localhost:3000/health", timeout=1.5)
        return r.status_code == 200 and r.json().get("status") == "online"
    except Exception:
        return False

def is_agent_online():
    try:
        r = requests.get("http://localhost:3000/api/agent/status?agentId=LAPTOP-01", timeout=1.5)
        return r.status_code == 200 and r.json().get("online") is True
    except Exception:
        return False

def kill_process(proc):
    if proc:
        try:
            proc.terminate()
            proc.wait(timeout=3)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

def main():
    print("================================================================================")
    print("                 JARVIS COMPLETE REGRESSION & VERIFICATION RUNNER              ")
    print("================================================================================")

    results = {}

    # --- PART A: Phases 2 to 5 (Running against live server & agent) ---
    print("\n[PART A] Starting Node.js Server and Laptop Agent for Phases 2-5...")
    server_proc = subprocess.Popen(["node", "server/server.js"], cwd=str(BASE_DIR))
    
    for _ in range(25):
        if is_server_online():
            break
        time.sleep(0.4)

    if not is_server_online():
        print("[FAIL] Failed to start server.")
        kill_process(server_proc)
        sys.exit(1)

    print("  Server is ONLINE.")

    agent_proc = subprocess.Popen(
        [PYTHON_EXE, "laptop-agent/agent.py"],
        cwd=str(BASE_DIR),
        env={**os.environ, "IGRIS_SERVER_URL": "http://localhost:3000", "JARVIS_SERVER_URL": "http://localhost:3000"}
    )
    for _ in range(25):
        if is_agent_online():
            break
        time.sleep(0.4)

    if not is_agent_online():
        print("[FAIL] Failed to connect laptop agent.")
        kill_process(agent_proc)
        kill_process(server_proc)
        sys.exit(1)

    print("  Laptop Agent is ONLINE.\n")

    for phase in [2, 3, 4, 5]:
        script = f"test-phase{phase}.py"
        print(f"--- Running {script} ---")
        res = subprocess.run([PYTHON_EXE, str(BASE_DIR / script)], cwd=str(BASE_DIR))
        results[f"Phase {phase}"] = (res.returncode == 0)
        print(f"Result for {script}: {'PASSED' if res.returncode == 0 else 'FAILED'}\n")

    print("[Cleanup] Stopping background server and agent for Phases 6 & 7...")
    kill_process(agent_proc)
    kill_process(server_proc)
    time.sleep(2)

    # --- PART B: Phases 6, 7, 8, 9, 9.5, 10, 11, 12, 13 & 13.5 (Self-managing lifecycles) ---
    for phase in [6, 7, 8, 9, "9.5", 10, 11, 12, 13, "13.5"]:
        script = f"test-phase{phase}.py"
        print(f"--- Running {script} ---")
        res = subprocess.run([PYTHON_EXE, str(BASE_DIR / script)], cwd=str(BASE_DIR))
        results[f"Phase {phase}"] = (res.returncode == 0)
        print(f"Result for {script}: {'PASSED' if res.returncode == 0 else 'FAILED'}\n")

    print("================================================================================")
    print("                             FINAL TEST SUMMARY                                 ")
    print("================================================================================")
    all_passed = True
    for name, passed in results.items():
        status = "PASSED" if passed else "FAILED"
        if not passed:
            all_passed = False
        print(f"  {name}: {status}")

    print("================================================================================")
    if all_passed:
        print("ALL REQUIRED PHASES PASSED WITH 100% SUCCESS!")
        sys.exit(0)
    else:
        print("SOME TESTS FAILED.")
        sys.exit(1)

if __name__ == "__main__":
    main()
