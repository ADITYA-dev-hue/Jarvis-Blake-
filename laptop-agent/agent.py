"""JARVIS Phase 1 Part 3 - Windows Laptop Agent

Connects to the central Node.js Socket.IO server, authenticates, and safely
routes commands through the sandboxed safe command router.
"""

import sys
import time
import signal
import socketio

# Reconfigure stdout/stderr to UTF-8 on Windows to safely handle unicode characters
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
import config
from commands import execute_safe_command, set_task_progress_callback
from system_monitor import metrics_reporter

# Setup lightweight security audit logger (1MB max, 2 backups)
audit_log_path = Path(__file__).resolve().parent / "audit.log"
audit_logger = logging.getLogger("jarvis_agent_audit")
audit_logger.setLevel(logging.INFO)
audit_logger.propagate = False
if not audit_logger.handlers:
    _handler = RotatingFileHandler(str(audit_log_path), maxBytes=1_000_000, backupCount=2, encoding="utf-8")
    _formatter = logging.Formatter("%(asctime)s action=%(message)s")
    _handler.setFormatter(_formatter)
    audit_logger.addHandler(_handler)

def record_audit(command_id: str, action: str, success: bool):
    try:
        audit_logger.info(f"{action} command_id={command_id} success={success}")
    except Exception:
        pass

# Initialize Socket.IO client with automatic reconnection
sio = socketio.Client(
    reconnection=True,
    reconnection_attempts=0,     # Retry indefinitely
    reconnection_delay=1,        # Wait 1s between attempts
    reconnection_delay_max=5,    # Cap backoff at 5s
    randomization_factor=0.2,
    logger=False,
    engineio_logger=False
)

# Connection state tracking
is_connected = False
has_initially_connected = False
running = True
last_connect_error = None


@sio.event
def connect():
    """Triggered when connection and authentication succeed."""
    global is_connected, has_initially_connected, last_connect_error
    is_connected = True
    last_connect_error = None

    # Start live system metrics reporting
    metrics_reporter.start(sio)

    if not has_initially_connected:
        has_initially_connected = True
        print("Authentication successful", flush=True)
        print("Connected to IGRIS Server", flush=True)
        print("Status: ONLINE", flush=True)
        print("Waiting for commands...", flush=True)
    else:
        print("Reconnected successfully", flush=True)
        print("Status: ONLINE", flush=True)


@sio.event
def disconnect():
    """Triggered when the server becomes unavailable."""
    global is_connected
    metrics_reporter.stop()
    if is_connected:
        is_connected = False
        print("Server unavailable", flush=True)
        print("Reconnecting...", flush=True)


@sio.event
def connect_error(data):
    """Triggered on initial connection or reconnection failure."""
    global is_connected, last_connect_error
    metrics_reporter.stop()
    last_connect_error = data
    err_str = str(data)

    if "Authentication failed" in err_str:
        print(f"Authentication failed: {err_str}", flush=True)
        return

    if is_connected:
        is_connected = False
        print("Server unavailable", flush=True)
        print("Reconnecting...", flush=True)


@sio.on("request_system_metrics")
def on_request_system_metrics(payload=None):
    """Handle instant metrics snapshot request from server/phone."""
    metrics_reporter.send_snapshot_now()


@sio.on("execute_command")
def on_execute_command(payload):
    """Handle incoming command from server and dispatch to safe command router.
    
    Robust validation prevents crashes from malformed payloads.
    Returns structured results via 'command_result' event.
    """
    # 1. Validate payload structure
    if not isinstance(payload, dict):
        response = {
            "commandId": "invalid",
            "success": False,
            "action": "unknown",
            "data": None,
            "error": "Malformed command payload: expected a JSON object."
        }
        try:
            sio.emit("command_result", response)
        except Exception:
            pass
        return

    # 2. Extract and validate commandId
    command_id = payload.get("commandId")
    if not command_id or not isinstance(command_id, str):
        command_id = f"cmd-{int(time.time()*1000)}"

    action = payload.get("action")
    parameters = payload.get("parameters")

    # 3. Validate action
    if not action or not isinstance(action, str) or not action.strip():
        print(f"[COMMAND] Received {command_id} -> [MISSING ACTION]", flush=True)
        print(f"[RESULT] {command_id} -> FAILED (Missing or invalid action)", flush=True)
        response = {
            "commandId": command_id,
            "success": False,
            "action": str(action) if action is not None else None,
            "data": None,
            "error": "Missing or invalid required field: 'action'."
        }
        try:
            sio.emit("command_result", response)
        except Exception:
            pass
        return

    action = action.strip()

    # 4. Validate parameters
    if parameters is None:
        parameters = {}
    elif not isinstance(parameters, dict):
        print(f"[COMMAND] Received {command_id} -> {action}", flush=True)
        print(f"[RESULT] {command_id} -> FAILED (Invalid parameters format)", flush=True)
        response = {
            "commandId": command_id,
            "success": False,
            "action": action,
            "data": None,
            "error": "Invalid 'parameters' format: expected a JSON object."
        }
        try:
            sio.emit("command_result", response)
        except Exception:
            pass
        return

    # Log safe command receipt
    print(f"[COMMAND] Received {command_id} -> {action}", flush=True)
    print(f"[EXECUTE] {action}", flush=True)

    # 5. Pass to existing safe command router
    def notify_step_progress(step_idx: int, total_steps: int, step_action: str):
        try:
            sio.emit("task_progress", {
                "commandId": command_id,
                "step": step_idx,
                "total": total_steps,
                "action": step_action
            })
            print(f"[TASK PROGRESS] Step {step_idx}/{total_steps}: {step_action}", flush=True)
        except Exception:
            pass

    if action == "task":
        set_task_progress_callback(notify_step_progress)

    try:
        execution_result = execute_safe_command(action, parameters)
        is_success = execution_result.get("success", False)
        result_data = execution_result.get("data")
        err_msg = execution_result.get("error")
    except Exception as exc:
        is_success = False
        result_data = None
        err_msg = str(exc)
    finally:
        if action == "task":
            set_task_progress_callback(None)

    # Log execution result and record audit
    if is_success:
        print(f"[RESULT] {command_id} -> SUCCESS", flush=True)
    else:
        print(f"[RESULT] {command_id} -> FAILED ({err_msg})", flush=True)

    record_audit(command_id, action, is_success)

    # 6. Return result to server via command_result
    response = {
        "commandId": command_id,
        "success": is_success,
        "action": action,
        "data": result_data,
        "error": err_msg
    }

    try:
        sio.emit("command_result", response)
    except Exception as exc:
        print(f"[ERROR] Failed to emit command_result: {exc}")


def handle_shutdown(signum, frame):
    """Graceful process termination."""
    global running
    running = False
    metrics_reporter.stop()
    if sio.connected:
        try:
            sio.disconnect()
        except Exception:
            pass
    sys.exit(0)


def main():
    """Main entrypoint for JARVIS laptop agent."""
    global last_connect_error
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    # Exact required terminal banner format
    print("IGRIS Laptop Agent")
    print("------------------------------")
    print(f"Agent ID: {config.JARVIS_AGENT_ID}")
    print(f"Server URL: {config.JARVIS_SERVER_URL}")
    print("Connecting to IGRIS Server...", flush=True)

    auth_payload = {
        "token": config.JARVIS_AUTH_TOKEN,
        "role": "agent",
        "agentId": config.JARVIS_AGENT_ID
    }

    server_url = config.JARVIS_SERVER_URL

    while running:
        try:
            if not sio.connected:
                last_connect_error = None
                sio.connect(
                    server_url,
                    auth=auth_payload,
                    transports=["polling", "websocket"],
                    wait=True,
                    wait_timeout=10
                )
            sio.wait()
        except socketio.exceptions.ConnectionError as exc:
            if not has_initially_connected:
                print("Server unavailable", flush=True)
                # Diagnostic logging for local troubleshooting without exposing secrets
                if last_connect_error:
                    msg = last_connect_error.get("message") if isinstance(last_connect_error, dict) else str(last_connect_error)
                    print(f"  [Detail] Handshake response: {msg}", flush=True)
                elif exc.args:
                    print(f"  [Detail] SocketIO error: {exc.args[0]}", flush=True)
                print("Reconnecting...", flush=True)
            time.sleep(2)
        except KeyboardInterrupt:
            handle_shutdown(None, None)
        except Exception as e:
            if not has_initially_connected:
                print(f"  [Detail] Unexpected error: {type(e).__name__}: {e}", flush=True)
            time.sleep(2)


if __name__ == "__main__":
    main()
