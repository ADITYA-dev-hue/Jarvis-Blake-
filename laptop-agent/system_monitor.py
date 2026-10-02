"""JARVIS Phase 7 - System Monitor

Collects real-time hardware telemetry and system metrics for Windows laptops:
- CPU usage percentage and core count
- Virtual memory (RAM) usage and byte counters
- Workspace drive storage metrics (without leaking drive paths)
- Battery state (percentage, charging status, or unavailable for desktops)
- Network connectivity status (without exposing IPs or credentials)
- System platform, architecture, and uptime
- Dedicated Socket.IO streaming event manager with deduplication and clean shutdown.
"""

import os
import platform
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

import psutil
from config import JARVIS_AGENT_ID, WORKSPACE_DIR

# Initialize psutil CPU baseline at module load time so interval=None calls work non-blockingly
try:
    psutil.cpu_percent(interval=None)
except Exception:
    pass

# Metric interval configuration (in seconds, default: 2.0s)
_DEFAULT_INTERVAL_SECONDS = 2.0
try:
    _env_interval_ms = os.getenv("JARVIS_METRICS_INTERVAL")
    if _env_interval_ms:
        METRICS_INTERVAL = max(0.5, float(_env_interval_ms) / 1000.0)
    else:
        METRICS_INTERVAL = float(os.getenv("METRICS_INTERVAL", _DEFAULT_INTERVAL_SECONDS))
except Exception:
    METRICS_INTERVAL = _DEFAULT_INTERVAL_SECONDS


def is_network_connected() -> bool:
    """Safely check if the laptop has active network connectivity without scanning or leaking IPs."""
    try:
        stats = psutil.net_if_stats()
        for name, stat in stats.items():
            name_lower = name.lower()
            if stat.isup and "loopback" not in name_lower and "pseudo" not in name_lower:
                return True
    except Exception:
        pass
    return False


def get_workspace_drive_root() -> str:
    """Find the root mount path containing the JARVIS workspace without assuming C:."""
    try:
        resolved_ws = Path(WORKSPACE_DIR).resolve()
        anchor = resolved_ws.anchor
        if anchor:
            return anchor
    except Exception:
        pass
    return "C:\\" if os.name == "nt" else "/"


def get_system_metrics() -> Dict[str, Any]:
    """Collect current system telemetry according to the Phase 7 specification.
    
    Guarantees:
    - Never exposes sensitive paths, IPs, usernames, or credentials.
    - Zero shell or PowerShell commands executed.
    - Read-only psutil inspection.
    """
    # 1. CPU Metrics
    cpu_pct = psutil.cpu_percent(interval=None)
    # If initial call returned 0.0, do a micro-sample (0.05s) to guarantee accurate metric
    if cpu_pct == 0.0:
        cpu_pct = psutil.cpu_percent(interval=0.05)
    core_count = psutil.cpu_count(logical=True) or 1
    cpu_usage_clamped = max(0.0, min(100.0, round(float(cpu_pct), 1)))

    # 2. Memory (RAM) Metrics
    vm = psutil.virtual_memory()
    mem_usage_clamped = max(0.0, min(100.0, round(float(vm.percent), 1)))

    # 3. Disk Metrics (workspace drive)
    drive_root = get_workspace_drive_root()
    try:
        disk_usage = psutil.disk_usage(drive_root)
        disk_percent_clamped = max(0.0, min(100.0, round(float(disk_usage.percent), 1)))
        disk_used_bytes = int(disk_usage.used)
        disk_total_bytes = int(disk_usage.total)
    except Exception:
        disk_percent_clamped = 0.0
        disk_used_bytes = 0
        disk_total_bytes = 0

    # 4. Battery Metrics
    battery_data: Dict[str, Any] = {"available": False}
    try:
        batt = psutil.sensors_battery()
        if batt is not None:
            battery_data = {
                "available": True,
                "percent": max(0, min(100, int(round(batt.percent)))),
                "charging": bool(batt.power_plugged)
            }
    except Exception:
        battery_data = {"available": False}

    # 5. Network Metrics
    network_connected = is_network_connected()

    # 6. System & Uptime
    boot_time = psutil.boot_time()
    uptime_seconds = max(0, int(time.time() - boot_time))

    # Architecture mapping (e.g. AMD64 -> x64)
    arch_raw = platform.machine()
    arch_clean = "x64" if arch_raw in ("AMD64", "x86_64") else arch_raw

    return {
        "cpu": {
            "usagePercent": cpu_usage_clamped,
            "coreCount": core_count
        },
        "memory": {
            "usagePercent": mem_usage_clamped,
            "usedBytes": int(vm.used),
            "totalBytes": int(vm.total)
        },
        "disk": {
            "usagePercent": disk_percent_clamped,
            "usedBytes": disk_used_bytes,
            "totalBytes": disk_total_bytes
        },
        "battery": battery_data,
        "network": {
            "connected": network_connected
        },
        "system": {
            "platform": platform.system() or "Windows",
            "architecture": arch_clean,
            "uptimeSeconds": uptime_seconds
        },
        "agent": {
            "agentId": JARVIS_AGENT_ID
        }
    }


# ==============================================================================
# Background Socket.IO Metrics Reporter
# ==============================================================================

class SystemMetricsReporter:
    """Manages the background telemetry emission thread.
    
    Guarantees:
    - Exactly one reporting loop runs at any time, even after repeated reconnects.
    - Controlled sample interval (default 2s) to avoid high CPU usage.
    - Immediate shutdown on disconnect or application exit.
    """

    def __init__(self):
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self._sio: Any = None
        self._interval = METRICS_INTERVAL

    def start(self, sio_client: Any, interval: Optional[float] = None) -> None:
        """Start the background metrics reporting loop if not already running."""
        with self._lock:
            self._sio = sio_client
            if interval:
                self._interval = max(0.5, float(interval))

            # If already running and alive, do not create duplicate threads
            if self._thread is not None and self._thread.is_alive():
                return

            self._stop_event.clear()
            self._thread = threading.Thread(
                target=self._run_loop,
                name="JarvisMetricsReporter",
                daemon=True
            )
            self._thread.start()

    def stop(self) -> None:
        """Signal the reporting loop to terminate and join the thread."""
        with self._lock:
            self._stop_event.set()
            if self._thread is not None:
                # Wait briefly for thread to exit
                self._thread.join(timeout=1.0)
                self._thread = None

    def send_snapshot_now(self) -> Optional[Dict[str, Any]]:
        """Collect and emit a single metrics snapshot immediately."""
        if not self._sio or not getattr(self._sio, "connected", False):
            return None

        metrics = get_system_metrics()
        try:
            self._sio.emit("system_metrics", metrics)
            return metrics
        except Exception:
            return None

    def _run_loop(self) -> None:
        """Background loop emitting system_metrics at configured interval."""
        # Send an immediate snapshot when the loop starts
        self.send_snapshot_now()

        while not self._stop_event.is_set():
            # Wait with interruptible event
            if self._stop_event.wait(self._interval):
                break

            if self._sio and getattr(self._sio, "connected", False):
                try:
                    metrics = get_system_metrics()
                    self._sio.emit("system_metrics", metrics)
                except Exception:
                    pass


# Singleton reporter instance
metrics_reporter = SystemMetricsReporter()
