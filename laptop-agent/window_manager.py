"""Safe Window & Application Manager for JARVIS Laptop Agent (Phase 10).

Provides deterministic, strictly validated, and bounded window management
for allowlisted Windows desktop applications.

Guarantees:
- Strictly operates on allowlisted applications only.
- Never accepts raw window handles, PIDs, or arbitrary coordinates from the client.
- Zero shell, PowerShell, or CMD commands executed.
- Zero mouse or keyboard automation introduced.
- Bounded response (maximum 50 windows).
- Safe normalized window states: 'normal', 'minimized', 'maximized'.
- Never leaks internal HWNDs, PIDs, user paths, or credentials.
"""

import ctypes
from ctypes import wintypes
import psutil
from typing import Any, Dict, List, Optional, Tuple

user32 = ctypes.windll.user32

# Win32 Window Show Commands
SW_HIDE = 0
SW_SHOWNORMAL = 1
SW_SHOWMINIMIZED = 2
SW_MAXIMIZE = 3
SW_SHOWNOACTIVATE = 4
SW_SHOW = 5
SW_MINIMIZE = 6
SW_SHOWMINNOACTIVE = 7
SW_SHOWNA = 8
SW_RESTORE = 9

# Strict Application Allowlist & Executable Map
ALLOWED_APP_MAP: Dict[str, Dict[str, Any]] = {
    "notepad": {
        "label": "Notepad",
        "executables": ["notepad.exe"],
        "description": "Windows Text Editor"
    },
    "calculator": {
        "label": "Calculator",
        "executables": ["calc.exe", "calculatorapp.exe", "calculator.exe"],
        "description": "Windows Calculator"
    },
    "paint": {
        "label": "Paint",
        "executables": ["mspaint.exe", "paint.exe"],
        "description": "Windows Paint"
    },
    "code": {
        "label": "VS Code",
        "executables": ["code.exe"],
        "description": "Visual Studio Code"
    },
    "chrome": {
        "label": "Chrome",
        "executables": ["chrome.exe"],
        "description": "Google Chrome Web Browser"
    },
    "explorer": {
        "label": "File Explorer",
        "executables": ["explorer.exe"],
        "description": "Windows File Explorer"
    }
}

ALLOWED_APPS = set(ALLOWED_APP_MAP.keys())


# Reverse map for fast O(1) process lookup
EXE_TO_APP_KEY: Dict[str, str] = {}
for _app_k, _spec in ALLOWED_APP_MAP.items():
    for _exe in _spec["executables"]:
        EXE_TO_APP_KEY[_exe.lower()] = _app_k

# Excluded system class names for Windows Explorer (e.g. desktop surface, taskbar)
IGNORED_WINDOW_CLASSES = {
    "progman",
    "workerw",
    "shell_traywnd",
    "shell_secondarytraywnd"
}

# Win32 EnumDesktopWindows callback type
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_int, wintypes.HWND, wintypes.LPARAM)


def _get_window_title(hwnd: int) -> str:
    """Retrieve window title safely without buffer overflow."""
    length = user32.GetWindowTextLengthW(hwnd)
    if length <= 0:
        return ""
    buff = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buff, length + 1)
    return buff.value.strip()


def _get_window_class(hwnd: int) -> str:
    """Retrieve window class name in lowercase."""
    buf = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, buf, 256)
    return buf.value.lower().strip()


def _get_window_state(hwnd: int) -> str:
    """Determine normalized window state: 'normal', 'minimized', or 'maximized'."""
    if user32.IsIconic(hwnd):
        return "minimized"
    if user32.IsZoomed(hwnd):
        return "maximized"
    return "normal"


def _get_window_pid(hwnd: int) -> Optional[int]:
    """Get the Process ID associated with a window handle."""
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return pid.value if pid.value > 0 else None


def _find_top_level_windows() -> List[Tuple[int, str, str, str]]:
    """Enumerate top-level visible application windows.
    
    Returns list of tuples: (hwnd, app_key, title, state).
    Only includes windows corresponding to allowlisted applications.
    """
    raw_windows: List[int] = []

    def enum_cb(hwnd: int, lparam: int) -> int:
        raw_windows.append(hwnd)
        return 1

    cb = WNDENUMPROC(enum_cb)

    # Attach to active interactive input desktop if available, fallback to EnumWindows
    h_desk = user32.OpenInputDesktop(0, False, 0x0100)  # DESKTOP_READOBJECTS
    if h_desk:
        user32.EnumDesktopWindows(h_desk, cb, 0)
    else:
        user32.EnumWindows(cb, 0)

    # Fallback to EnumWindows if input desktop yielded no raw windows
    if not raw_windows:
        user32.EnumWindows(cb, 0)

    matched_windows: List[Tuple[int, str, str, str]] = []

    for hwnd in raw_windows:
        # Window must be visible
        if not user32.IsWindowVisible(hwnd):
            continue

        title = _get_window_title(hwnd)
        if not title:
            continue

        # Check window class to avoid explorer taskbar/desktop background
        cls_name = _get_window_class(hwnd)
        if cls_name in IGNORED_WINDOW_CLASSES:
            continue

        pid = _get_window_pid(hwnd)
        if not pid:
            continue

        try:
            proc = psutil.Process(pid)
            pname = proc.name().lower()
        except Exception:
            continue

        app_key = EXE_TO_APP_KEY.get(pname)
        if not app_key:
            continue

        # Explorer special check: skip empty or system shell windows
        if app_key == "explorer" and (title in ("Program Manager", "Task View") or cls_name == "cabinetwclass" and not title):
            continue

        state = _get_window_state(hwnd)
        matched_windows.append((hwnd, app_key, title, state))

    return matched_windows


# ==============================================================================
# Public Window Management API
# ==============================================================================

def list_windows() -> Dict[str, Any]:
    """List open supported windows (bounded to max 50, safe fields only).
    
    Returns:
    {
        "success": True,
        "action": "list_windows",
        "windows": [
            { "app": "chrome", "title": "Google", "state": "normal" },
            { "app": "notepad", "title": "notes.txt", "state": "minimized" }
        ],
        "count": 2
    }
    """
    all_matched = _find_top_level_windows()

    # Bounded to maximum 50 windows
    safe_list = []
    for _hwnd, app_key, title, state in all_matched[:50]:
        safe_list.append({
            "app": app_key,
            "title": title,
            "state": state
        })

    return {
        "success": True,
        "action": "list_windows",
        "windows": safe_list,
        "count": len(safe_list)
    }


def focus_window(app: str) -> Dict[str, Any]:
    """Safely bring a supported application window to the foreground."""
    clean_app = (app or "").strip().lower()
    if clean_app not in ALLOWED_APP_MAP:
        allowed = list(ALLOWED_APP_MAP.keys())
        return {
            "success": False,
            "error": f"Application '{app}' is not in the allowed list. Allowed: {', '.join(allowed)}",
            "app": clean_app
        }

    label = ALLOWED_APP_MAP[clean_app]["label"]
    matching = [item for item in _find_top_level_windows() if item[1] == clean_app]

    if not matching:
        return {
            "success": False,
            "error": f"{label} is not currently open.",
            "app": clean_app
        }

    # Deterministic selection: Pick the first topmost/active window
    target_hwnd, _, target_title, target_state = matching[0]

    # If minimized, restore it first
    if target_state == "minimized":
        user32.ShowWindow(target_hwnd, SW_RESTORE)
    else:
        user32.ShowWindow(target_hwnd, SW_SHOW)

    # Bring to top and set foreground
    user32.BringWindowToTop(target_hwnd)
    user32.SetForegroundWindow(target_hwnd)

    return {
        "success": True,
        "action": "focus_window",
        "app": clean_app,
        "title": target_title,
        "message": f"{label} is now active."
    }


def minimize_window(app: str) -> Dict[str, Any]:
    """Safely minimize a supported application window."""
    clean_app = (app or "").strip().lower()
    if clean_app not in ALLOWED_APP_MAP:
        allowed = list(ALLOWED_APP_MAP.keys())
        return {
            "success": False,
            "error": f"Application '{app}' is not in the allowed list. Allowed: {', '.join(allowed)}",
            "app": clean_app
        }

    label = ALLOWED_APP_MAP[clean_app]["label"]
    matching = [item for item in _find_top_level_windows() if item[1] == clean_app]

    if not matching:
        return {
            "success": False,
            "error": f"{label} is not currently open.",
            "app": clean_app
        }

    # Deterministic selection: minimize the active or first matching window
    target_hwnd, _, target_title, _ = matching[0]
    user32.ShowWindow(target_hwnd, SW_MINIMIZE)

    return {
        "success": True,
        "action": "minimize_window",
        "app": clean_app,
        "title": target_title,
        "message": f"{label} has been minimized."
    }


def maximize_window(app: str) -> Dict[str, Any]:
    """Safely maximize a supported application window."""
    clean_app = (app or "").strip().lower()
    if clean_app not in ALLOWED_APP_MAP:
        allowed = list(ALLOWED_APP_MAP.keys())
        return {
            "success": False,
            "error": f"Application '{app}' is not in the allowed list. Allowed: {', '.join(allowed)}",
            "app": clean_app
        }

    label = ALLOWED_APP_MAP[clean_app]["label"]
    matching = [item for item in _find_top_level_windows() if item[1] == clean_app]

    if not matching:
        return {
            "success": False,
            "error": f"{label} is not currently open.",
            "app": clean_app
        }

    # Deterministic selection: maximize the active or first matching window
    target_hwnd, _, target_title, _ = matching[0]
    user32.ShowWindow(target_hwnd, SW_MAXIMIZE)

    return {
        "success": True,
        "action": "maximize_window",
        "app": clean_app,
        "title": target_title,
        "message": f"{label} has been maximized."
    }


def restore_window(app: str) -> Dict[str, Any]:
    """Safely restore a minimized or maximized application window to its normal state."""
    clean_app = (app or "").strip().lower()
    if clean_app not in ALLOWED_APP_MAP:
        allowed = list(ALLOWED_APP_MAP.keys())
        return {
            "success": False,
            "error": f"Application '{app}' is not in the allowed list. Allowed: {', '.join(allowed)}",
            "app": clean_app
        }

    label = ALLOWED_APP_MAP[clean_app]["label"]
    matching = [item for item in _find_top_level_windows() if item[1] == clean_app]

    if not matching:
        return {
            "success": False,
            "error": f"{label} is not currently open.",
            "app": clean_app
        }

    target_hwnd, _, target_title, _ = matching[0]
    user32.ShowWindow(target_hwnd, SW_RESTORE)

    return {
        "success": True,
        "action": "restore_window",
        "app": clean_app,
        "title": target_title,
        "message": f"{label} has been restored."
    }
