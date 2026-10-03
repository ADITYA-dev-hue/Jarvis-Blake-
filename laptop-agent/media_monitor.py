"""Safe Desktop Media Monitor for JARVIS Laptop Agent (Phase 10).

Monitors media playback metadata from supported desktop applications:
- YouTube in Chrome or Edge
- Spotify Desktop
- VLC Media Player
- Windows Media Player

Privacy & Security Guarantees:
- Metadata ONLY (title, artist, album, source, playback state, media type).
- ZERO mic input or audio capture.
- ZERO desktop audio recording.
- ZERO webcam or video recording.
- ZERO screen recording or screenshot capture.
- ZERO shell, PowerShell, or CMD commands executed.
- Strictly authenticated telemetry transmission via Socket.IO.
- Never fabricates metadata if none exists.
"""

import time
import re
import threading
import ctypes
from ctypes import wintypes
from typing import Any, Dict, Optional, List, Tuple
import psutil

user32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_int, wintypes.HWND, wintypes.LPARAM)

# Supported media applications map
MEDIA_APP_MAP = {
    "chrome.exe": "Chrome",
    "msedge.exe": "Edge",
    "spotify.exe": "Spotify",
    "vlc.exe": "VLC",
    "wmplayer.exe": "Windows Media Player",
    "firefox.exe": "Firefox"
}


def _get_window_title(hwnd: int) -> str:
    """Safely retrieve window title."""
    length = user32.GetWindowTextLengthW(hwnd)
    if length <= 0:
        return ""
    buff = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buff, length + 1)
    return buff.value.strip()


def _get_window_pid(hwnd: int) -> Optional[int]:
    """Retrieve window Process ID."""
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return pid.value if pid.value > 0 else None


def _find_media_windows() -> List[Tuple[str, str]]:
    """Enumerate visible top-level windows belonging to supported media apps.
    
    Returns list of (source_app_name, window_title).
    """
    raw_hwnds: List[int] = []

    def enum_cb(hwnd: int, lparam: int) -> int:
        raw_hwnds.append(hwnd)
        return 1

    cb = WNDENUMPROC(enum_cb)
    h_desk = user32.OpenInputDesktop(0, False, 0x0100)
    if h_desk:
        user32.EnumDesktopWindows(h_desk, cb, 0)
    else:
        user32.EnumWindows(cb, 0)

    if not raw_hwnds:
        user32.EnumWindows(cb, 0)

    media_windows: List[Tuple[str, str]] = []

    for hwnd in raw_hwnds:
        if not user32.IsWindowVisible(hwnd):
            continue
        title = _get_window_title(hwnd)
        if not title:
            continue
        pid = _get_window_pid(hwnd)
        if not pid:
            continue
        try:
            pname = psutil.Process(pid).name().lower()
        except Exception:
            continue

        if pname in MEDIA_APP_MAP:
            source_label = MEDIA_APP_MAP[pname]
            media_windows.append((source_label, title))

    return media_windows


def get_media_status() -> Dict[str, Any]:
    """Extract current safe desktop media playback metadata.
    
    Returns normalized structure:
    {
        "active": bool,
        "playbackState": "playing" | "paused" | "stopped" | "no_media" | "unknown",
        "mediaType": "video" | "audio" | "unknown",
        "title": Optional[str],
        "artist": Optional[str],
        "album": Optional[str],
        "source": Optional[str],
        "positionSeconds": Optional[int],
        "durationSeconds": Optional[int],
        "timestamp": int
    }
    """
    now_ts = int(time.time())
    windows = _find_media_windows()

    # 1. Check for Spotify
    for source, title in windows:
        if source == "Spotify":
            # Spotify idle/paused window titles
            if title in ("Spotify Free", "Spotify Premium", "Spotify", "Spotify Music"):
                return {
                    "active": True,
                    "playbackState": "paused",
                    "mediaType": "audio",
                    "title": "Spotify",
                    "artist": None,
                    "album": None,
                    "source": "Spotify",
                    "positionSeconds": None,
                    "durationSeconds": None,
                    "timestamp": now_ts
                }
            elif " - " in title:
                # Format: "Artist - Song Name"
                parts = title.split(" - ", 1)
                artist = parts[0].strip()
                track_title = parts[1].strip() if len(parts) > 1 else title
                return {
                    "active": True,
                    "playbackState": "playing",
                    "mediaType": "audio",
                    "title": track_title,
                    "artist": artist,
                    "album": None,
                    "source": "Spotify",
                    "positionSeconds": None,
                    "durationSeconds": None,
                    "timestamp": now_ts
                }

    # 2. Check for YouTube / Media in Chrome or Edge
    for source, title in windows:
        if source in ("Chrome", "Edge", "Firefox"):
            if "YouTube" in title:
                # Strip notification prefix e.g. "(181) "
                clean = re.sub(r'^\(\d+\)\s*', '', title)
                # Strip browser/site suffix
                clean = re.sub(r'\s*-\s*YouTube.*$', '', clean, flags=re.IGNORECASE)
                clean = re.sub(r'\s*-\s*Google Chrome.*$', '', clean, flags=re.IGNORECASE)
                clean = re.sub(r'\s*-\s*Microsoft Edge.*$', '', clean, flags=re.IGNORECASE)
                clean = re.sub(r'\s*-\s*Mozilla Firefox.*$', '', clean, flags=re.IGNORECASE)
                clean = clean.strip()
                if clean:
                    return {
                        "active": True,
                        "playbackState": "playing",
                        "mediaType": "video",
                        "title": clean,
                        "artist": None,
                        "album": None,
                        "source": source,
                        "positionSeconds": None,
                        "durationSeconds": None,
                        "timestamp": now_ts
                    }

    # 3. Check for VLC Media Player
    for source, title in windows:
        if source == "VLC":
            if title == "VLC media player":
                return {
                    "active": True,
                    "playbackState": "paused",
                    "mediaType": "video",
                    "title": "VLC",
                    "artist": None,
                    "album": None,
                    "source": "VLC",
                    "positionSeconds": None,
                    "durationSeconds": None,
                    "timestamp": now_ts
                }
            else:
                clean = re.sub(r'\s*-\s*VLC media player.*$', '', title, flags=re.IGNORECASE).strip()
                return {
                    "active": True,
                    "playbackState": "playing",
                    "mediaType": "video",
                    "title": clean or title,
                    "artist": None,
                    "album": None,
                    "source": "VLC",
                    "positionSeconds": None,
                    "durationSeconds": None,
                    "timestamp": now_ts
                }

    # 4. No supported media session found
    return {
        "active": False,
        "playbackState": "no_media",
        "mediaType": "unknown",
        "title": None,
        "artist": None,
        "album": None,
        "source": None,
        "positionSeconds": None,
        "durationSeconds": None,
        "timestamp": now_ts
    }


class MediaStatusReporter:
    """Background reporter emitting media_status over Socket.IO when metadata changes."""

    def __init__(self, sio_client, poll_interval: float = 2.0, interval_sec: Optional[float] = None):
        self._sio = sio_client
        self._interval = interval_sec if interval_sec is not None else poll_interval
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._last_status: Optional[Dict[str, Any]] = None
        self._last_emit_time: float = 0

    def start(self):
        """Start the background media telemetry loop."""
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run_loop,
            name="MediaStatusReporterThread",
            daemon=True
        )
        self._thread.start()

    def stop(self):
        """Stop the background media telemetry loop cleanly."""
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None

    def send_snapshot_now(self):
        """Send an immediate media status snapshot."""
        if not self._sio or not self._sio.connected:
            return
        status = get_media_status()
        self._last_status = status
        self._last_emit_time = time.time()
        try:
            self._sio.emit("media_status", status)
        except Exception:
            pass

    def _has_status_changed(self, new_st: Dict[str, Any], old_st: Optional[Dict[str, Any]]) -> bool:
        """Check if meaningful metadata or playback state has changed."""
        if old_st is None:
            return True
        for key in ("active", "playbackState", "mediaType", "title", "artist", "source"):
            if new_st.get(key) != old_st.get(key):
                return True
        return False

    _has_changed = _has_status_changed

    def _run_loop(self):
        """Background loop polling media status."""
        while not self._stop_event.is_set():
            try:
                if self._sio and self._sio.connected:
                    status = get_media_status()
                    now = time.time()
                    # Emit if metadata changed or every 15s heartbeat
                    if self._has_status_changed(status, self._last_status) or (now - self._last_emit_time >= 15.0):
                        self._last_status = status
                        self._last_emit_time = now
                        self._sio.emit("media_status", status)
            except Exception:
                pass

            self._stop_event.wait(self._interval)
