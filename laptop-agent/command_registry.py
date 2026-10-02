"""Centralized Command Registry for JARVIS Laptop Agent (Phase 6).

Single source of truth for all permitted laptop operations.
Enforces strict parameter validation, path containment, symlink/junction protection,
and extension whitelisting.

Arbitrary shell execution, PowerShell, deletion, and system modification are strictly forbidden.
"""

import os
import re
import sys
import time
import urllib.parse
import webbrowser
import platform
import subprocess
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import psutil
from config import WORKSPACE_DIR

# Maximum content limit for created text files
MAX_FILE_CONTENT_LENGTH = 10000

# Whitelist of allowed extensions for creating text files
ALLOWED_TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".json"}

# Whitelist of allowed extensions for opening existing files
ALLOWED_OPEN_EXTENSIONS = {
    ".txt", ".md", ".csv", ".json",
    ".py", ".html", ".css", ".js", ".ts", ".tsx"
}

# Forbidden Windows reserved device names
RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
}

# Whitelist of allowed safe desktop applications
WHITELISTED_APPS: Dict[str, Dict[str, Any]] = {
    "notepad": {
        "label": "Notepad",
        "executable": "notepad.exe",
        "description": "Windows Text Editor"
    },
    "calculator": {
        "label": "Calculator",
        "executable": "calc.exe",
        "description": "Windows Calculator"
    },
    "paint": {
        "label": "Paint",
        "executable": "mspaint.exe",
        "description": "Windows Paint Graphics Tool"
    },
    "code": {
        "label": "Visual Studio Code",
        "executable": "code.cmd" if os.name == "nt" else "code",
        "description": "Visual Studio Code Editor"
    },
    "chrome": {
        "label": "Google Chrome",
        "executable": "chrome.exe",
        "description": "Google Chrome Web Browser"
    },
    "explorer": {
        "label": "Workspace Explorer",
        "executable": "explorer.exe",
        "args": [str(WORKSPACE_DIR)],
        "description": "File Explorer opened strictly inside JARVIS workspace"
    }
}


# ==============================================================================
# Helper Formatting Utilities
# ==============================================================================

def format_bytes(bytes_num: int) -> str:
    """Format bytes into human-readable string (GB/MB/KB/B)."""
    if bytes_num >= 1024 ** 3:
        return f"{bytes_num / (1024 ** 3):.2f} GB"
    elif bytes_num >= 1024 ** 2:
        return f"{bytes_num / (1024 ** 2):.2f} MB"
    elif bytes_num >= 1024:
        return f"{bytes_num / 1024:.2f} KB"
    return f"{bytes_num} B"


def format_uptime(seconds: float) -> str:
    """Format seconds into readable days, hours, minutes."""
    mins, sec = divmod(int(seconds), 60)
    hours, mins = divmod(mins, 60)
    days, hours = divmod(hours, 24)
    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0 or days > 0:
        parts.append(f"{hours}h")
    parts.append(f"{mins}m")
    parts.append(f"{sec}s")
    return " ".join(parts)


# ==============================================================================
# Central Safe Path Resolver (With Symlink & Junction Protection)
# ==============================================================================

def resolve_workspace_path(
    relative_path: Optional[str],
    must_exist: bool = False,
    allow_root: bool = False
) -> Path:
    """Resolve a relative workspace path and verify strict workspace containment.
    
    Security Controls:
    1. Rejects None, non-string, or control characters.
    2. Rejects UNC network paths (\\\\server\\share).
    3. Rejects leading slashes / root paths (/ or \\).
    4. Rejects drive letters (C:\\, D:\\).
    5. Rejects path traversal tokens ('..').
    6. Rejects file URLs (file://).
    7. Rejects illegal Windows characters (< > : " | ? *).
    8. Rejects Windows reserved device names (CON, NUL, AUX, COM1-9, LPT1-9).
    9. Canonical containment: uses both Path.resolve() and os.path.realpath() to
       defeat symlinks, NTFS directory junctions, and reparse points that attempt
       to escape the workspace.
    
    Args:
        relative_path: Relative subpath within workspace, or empty/'.' for workspace root.
        must_exist: If True, raises FileNotFoundError if target does not exist.
        allow_root: If True, permits referencing the workspace root directory itself.
        
    Returns:
        Canonical Path object strictly contained within WORKSPACE_DIR.
    """
    base_dir = WORKSPACE_DIR.resolve()
    base_realpath = os.path.normcase(os.path.realpath(str(base_dir)))

    # Handle empty or alias paths pointing to workspace root
    raw_str = (relative_path or "").strip()
    if raw_str in ("", ".", "workspace", "jarvis workspace"):
        if not allow_root:
            raise PermissionError("Security violation: A specific workspace subpath is required.")
        return base_dir

    # 1. Reject control characters
    if any(ord(c) < 32 or ord(c) == 127 for c in raw_str):
        raise ValueError("Path contains forbidden control characters.")

    # 2. Reject file URLs
    if raw_str.lower().startswith(("file://", "file:")):
        raise PermissionError("Security violation: File URLs are strictly forbidden.")

    # 3. Reject UNC network paths (e.g. \\server\share or //server/share)
    if raw_str.startswith(("\\\\", "//")):
        raise PermissionError(f"Security violation: UNC network paths are forbidden: '{raw_str}'")

    # 4. Reject leading slashes/backslashes (root-relative or absolute paths)
    if raw_str.startswith(("/", "\\")):
        raise PermissionError(f"Security violation: Leading slashes (absolute paths) are forbidden: '{raw_str}'")

    # 5. Reject drive-letter paths (e.g. C:\ or D:foo)
    drive_part, _ = os.path.splitdrive(raw_str)
    if drive_part or re.match(r'^[a-zA-Z]:', raw_str):
        raise PermissionError(f"Security violation: Drive-letter paths are forbidden: '{raw_str}'")

    # 6. Check with Path.is_absolute() and os.path.isabs()
    input_path = Path(raw_str)
    if input_path.is_absolute() or os.path.isabs(raw_str):
        raise PermissionError(f"Security violation: Absolute paths are forbidden: '{raw_str}'")

    # 7. Check raw path segments for path traversal ('.' or '..')
    raw_segments = raw_str.replace("\\", "/").split("/")
    for seg in raw_segments:
        seg_clean = seg.strip()
        if seg_clean in (".", ".."):
            raise PermissionError("Security violation: Path traversal elements ('.' or '..') are strictly forbidden.")
        if not seg_clean:
            raise PermissionError("Security violation: Redundant or empty path segments are forbidden.")

    # 8. Check for illegal Windows filename characters (< > : " | ? *)
    illegal_chars = re.compile(r'[<>:"|?*]')
    for part in input_path.parts:
        if illegal_chars.search(part):
            raise ValueError(f"Path component '{part}' contains illegal characters (< > : \" | ? *).")

        stem = part.split('.')[0].upper()
        if stem in RESERVED_NAMES:
            raise ValueError(f"Path component '{part}' is a reserved Windows device name.")

    # 9. Resolve target against workspace
    target_path = (base_dir / input_path).resolve()
    target_norm = os.path.normcase(str(target_path))
    base_norm = os.path.normcase(str(base_dir))

    # Basic Path hierarchy check
    try:
        is_sub = target_path.is_relative_to(base_dir)
    except AttributeError:
        is_sub = target_norm.startswith(base_norm + os.sep) or (target_norm == base_norm)

    if not is_sub:
        raise PermissionError(f"Security violation: Path '{raw_str}' resolves outside workspace.")

    if not allow_root and target_norm == base_norm:
        raise PermissionError("Security violation: Path references workspace root where a sub-item is required.")

    # 10. Symlink and junction protection: resolve realpath
    target_realpath = os.path.normcase(os.path.realpath(str(target_path)))
    # If the target exists or its existing parent exists, realpath defeats symlinks
    if os.path.exists(target_path) or os.path.islink(target_path):
        is_real_sub = target_realpath.startswith(base_realpath + os.sep) or (allow_root and target_realpath == base_realpath)
        if not is_real_sub:
            raise PermissionError("Security violation: Symlink or junction resolves outside safe workspace.")

    # Check parent realpath for new files
    parent_path = target_path.parent
    if parent_path.exists():
        parent_realpath = os.path.normcase(os.path.realpath(str(parent_path)))
        is_parent_sub = parent_realpath.startswith(base_realpath + os.sep) or (parent_realpath == base_realpath)
        if not is_parent_sub:
            raise PermissionError("Security violation: Symlink or junction parent resolves outside safe workspace.")

    # 11. Existence check if required
    if must_exist and not target_path.exists():
        raise FileNotFoundError(f"Path not found: '{raw_str}'")

    return target_path


# ==============================================================================
# Command Handlers
# ==============================================================================

def handle_system_status(params: Dict[str, Any]) -> Dict[str, Any]:
    """Gather read-only Windows hardware metrics (CPU, RAM, Disk, OS) conforming to Phase 7."""
    from system_monitor import get_system_metrics
    metrics = get_system_metrics()

    # Base Phase 7 structured response
    result = dict(metrics)

    # Backwards-compatibility fields for legacy test suites & formatters
    result["ram"] = metrics["memory"]["usagePercent"]
    result["cpu_percent"] = metrics["cpu"]["usagePercent"]
    result["os"] = metrics["system"]["platform"]
    result["hostname"] = metrics["agent"]["agentId"]
    result["uptime"] = format_uptime(metrics["system"]["uptimeSeconds"])
    result["timestamp"] = time.strftime("%Y-%m-%d %H:%M:%S")

    return result


def handle_open_url(params: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and open an HTTP or HTTPS URL in the default browser."""
    raw_url = params.get("url")
    if not raw_url or not isinstance(raw_url, str):
        raise ValueError("Missing or invalid 'url' parameter. Expected a non-empty string.")

    raw_url = raw_url.strip()
    if not raw_url:
        raise ValueError("URL cannot be empty or blank.")

    if any(ord(c) < 32 or ord(c) == 127 for c in raw_url):
        raise ValueError("URL contains forbidden control characters.")

    parsed = urllib.parse.urlparse(raw_url)
    scheme = parsed.scheme.lower()

    if scheme not in ("http", "https"):
        raise ValueError(f"Forbidden URL scheme '{scheme}'. Only 'http' and 'https' URLs are permitted.")

    if not parsed.netloc:
        raise ValueError(f"Invalid URL '{raw_url}': missing domain/hostname.")

    webbrowser.open(raw_url, new=2, autoraise=True)

    return {
        "opened": True,
        "url": raw_url,
        "scheme": scheme,
        "host": parsed.netloc
    }


def handle_create_folder(params: Dict[str, Any]) -> Dict[str, Any]:
    """Create a folder inside the predefined safe JARVIS workspace."""
    raw_name = params.get("name") if "name" in params else params.get("folder_name")
    if not raw_name or not isinstance(raw_name, str):
        raise ValueError("Missing or invalid 'name' parameter. Expected a non-empty string.")

    target_path = resolve_workspace_path(raw_name, must_exist=False, allow_root=False)
    base_dir = WORKSPACE_DIR.resolve()

    already_existed = target_path.exists()
    target_path.mkdir(parents=True, exist_ok=True)

    return {
        "created": True,
        "already_existed": already_existed,
        "folder_name": raw_name.strip(),
        "relative_path": str(target_path.relative_to(base_dir)).replace("\\", "/"),
        "full_path": str(target_path),
        "workspace_root": str(base_dir)
    }


def handle_open_app(params: Dict[str, Any]) -> Dict[str, Any]:
    """Launch an application from the strictly predefined safe whitelist."""
    raw_app = params.get("app") if "app" in params else params.get("app_name")
    if not raw_app or not isinstance(raw_app, str):
        allowed = list(WHITELISTED_APPS.keys())
        raise ValueError(f"Missing 'app' parameter. Allowed apps: {', '.join(allowed)}")

    app_key = raw_app.strip().lower()
    if app_key not in WHITELISTED_APPS:
        allowed = list(WHITELISTED_APPS.keys())
        raise PermissionError(
            f"Application '{raw_app}' is not whitelisted. Allowed safe applications: {', '.join(allowed)}"
        )

    app_spec = WHITELISTED_APPS[app_key]
    executable = app_spec["executable"]
    args = app_spec.get("args", [])

    command_args = [executable] + args

    # Check if executable exists or can be resolved
    proc = subprocess.Popen(
        command_args,
        shell=False,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    return {
        "launched": True,
        "app_key": app_key,
        "app_label": app_spec["label"],
        "executable": executable,
        "pid": proc.pid,
        "description": app_spec["description"]
    }


# ==============================================================================
# PHASE 6 NEW SAFE ACTIONS
# ==============================================================================

def handle_open_folder(params: Dict[str, Any]) -> Dict[str, Any]:
    """Open an approved folder inside the workspace in Windows File Explorer.
    
    Security:
    - Path must resolve strictly inside WORKSPACE_DIR.
    - Target must exist and be a directory.
    - Executed via explorer.exe without shell invocation.
    """
    raw_path = params.get("path") if "path" in params else params.get("folder_name")
    target_path = resolve_workspace_path(raw_path, must_exist=True, allow_root=True)

    if not target_path.is_dir():
        raise ValueError(f"Specified path is not a directory: '{raw_path}'")

    base_dir = WORKSPACE_DIR.resolve()
    rel_path = str(target_path.relative_to(base_dir)).replace("\\", "/") if target_path != base_dir else ""

    # Open safely in Windows File Explorer without shell
    subprocess.Popen(
        ["explorer.exe", str(target_path)],
        shell=False,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    return {
        "opened": True,
        "path": rel_path or "workspace",
        "full_path": str(target_path),
        "message": "Folder opened successfully in File Explorer."
    }


def handle_list_folder(params: Dict[str, Any]) -> Dict[str, Any]:
    """List files and folders inside an approved workspace directory.
    
    Security:
    - Path must resolve strictly inside WORKSPACE_DIR.
    - Target must exist and be a directory.
    - Symlinks escaping workspace are filtered out.
    - Returns structured information: { name, type: 'directory'|'file' }.
    """
    raw_path = params.get("path") if "path" in params else params.get("folder_name")
    target_path = resolve_workspace_path(raw_path, must_exist=True, allow_root=True)

    if not target_path.is_dir():
        raise ValueError(f"Specified path is not a directory: '{raw_path}'")

    base_dir = WORKSPACE_DIR.resolve()
    base_realpath = os.path.normcase(os.path.realpath(str(base_dir)))
    rel_path = str(target_path.relative_to(base_dir)).replace("\\", "/") if target_path != base_dir else ""

    items = []
    try:
        with os.scandir(target_path) as entries:
            for entry in entries:
                # Symlink check on each item
                try:
                    entry_realpath = os.path.normcase(os.path.realpath(entry.path))
                    if not entry_realpath.startswith(base_realpath + os.sep) and entry_realpath != base_realpath:
                        continue  # Skip dangerous symlinks pointing outside workspace
                except Exception:
                    continue

                item_type = "directory" if entry.is_dir() else "file"
                items.append({
                    "name": entry.name,
                    "type": item_type
                })
    except PermissionError:
        raise PermissionError(f"Access denied reading directory: '{raw_path}'")

    # Sort directories first, then alphabetical by name
    items.sort(key=lambda x: (0 if x["type"] == "directory" else 1, x["name"].lower()))

    return {
        "path": rel_path or "workspace",
        "count": len(items),
        "items": items
    }


def handle_get_file_info(params: Dict[str, Any]) -> Dict[str, Any]:
    """Get metadata about an approved file inside the workspace.
    
    Security:
    - Path must resolve strictly inside WORKSPACE_DIR.
    - Target must exist and be a regular file.
    - Returns metadata ONLY (filename, type, size, modified time, relative path).
    - NEVER returns file contents, passwords, or secrets.
    """
    raw_path = params.get("path") if "path" in params else params.get("file_name")
    if not raw_path or not isinstance(raw_path, str):
        raise ValueError("Missing or invalid 'path' parameter. Expected a non-empty string.")

    target_path = resolve_workspace_path(raw_path, must_exist=True, allow_root=False)

    if not target_path.is_file():
        raise ValueError(f"Specified path is not a file: '{raw_path}'")

    base_dir = WORKSPACE_DIR.resolve()
    rel_path = str(target_path.relative_to(base_dir)).replace("\\", "/")

    stat_res = target_path.stat()
    mod_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat_res.st_mtime))

    return {
        "filename": target_path.name,
        "type": "file",
        "size": format_bytes(stat_res.st_size),
        "size_bytes": stat_res.st_size,
        "modified_time": mod_time,
        "relative_path": rel_path,
        "extension": target_path.suffix.lower()
    }


def handle_create_text_file(params: Dict[str, Any]) -> Dict[str, Any]:
    """Create a simple text file inside the JARVIS workspace.
    
    Security:
    - Allowed extensions strictly: .txt, .md, .csv, .json.
    - Disallows executable/dangerous file types (.exe, .bat, .cmd, .ps1, .vbs, .dll, etc.).
    - Content length capped at MAX_FILE_CONTENT_LENGTH (10,000 characters).
    - Path must resolve strictly inside WORKSPACE_DIR.
    """
    raw_path = params.get("path") if "path" in params else params.get("file_name")
    if not raw_path or not isinstance(raw_path, str):
        raise ValueError("Missing or invalid 'path' parameter. Expected a non-empty string.")

    content = params.get("content", "")
    if content is None:
        content = ""
    elif not isinstance(content, str):
        raise ValueError("Invalid 'content' parameter: expected a string.")

    # Enforce maximum file content length
    if len(content) > MAX_FILE_CONTENT_LENGTH:
        raise ValueError(
            f"Content length exceeds maximum limit of {MAX_FILE_CONTENT_LENGTH} characters "
            f"(received {len(content)} characters)."
        )

    target_path = resolve_workspace_path(raw_path, must_exist=False, allow_root=False)

    # Check extension
    ext = target_path.suffix.lower()
    if not ext:
        raise ValueError(
            f"File must have an explicit safe extension ({', '.join(sorted(ALLOWED_TEXT_EXTENSIONS))})."
        )

    if ext not in ALLOWED_TEXT_EXTENSIONS:
        raise PermissionError(
            f"File extension '{ext}' is forbidden. Allowed extensions: {', '.join(sorted(ALLOWED_TEXT_EXTENSIONS))}"
        )

    # Create parent directories safely
    target_path.parent.mkdir(parents=True, exist_ok=True)

    # Write content securely
    target_path.write_text(content, encoding="utf-8")

    base_dir = WORKSPACE_DIR.resolve()
    rel_path = str(target_path.relative_to(base_dir)).replace("\\", "/")

    return {
        "created": True,
        "path": rel_path,
        "filename": target_path.name,
        "size_bytes": len(content.encode("utf-8")),
        "message": f"File '{target_path.name}' created successfully."
    }


def handle_open_file(params: Dict[str, Any]) -> Dict[str, Any]:
    """Open an approved existing file using its associated Windows application.
    
    Security:
    - Must exist.
    - Must be a regular file inside workspace.
    - Extension must be in ALLOWED_OPEN_EXTENSIONS.
    - Disallows opening executable files or scripts (.exe, .bat, .cmd, .ps1, etc.).
    - Uses os.startfile on Windows without shell invocation.
    """
    raw_path = params.get("path") if "path" in params else params.get("file_name")
    if not raw_path or not isinstance(raw_path, str):
        raise ValueError("Missing or invalid 'path' parameter. Expected a non-empty string.")

    target_path = resolve_workspace_path(raw_path, must_exist=True, allow_root=False)

    if not target_path.is_file():
        raise ValueError(f"Specified path is not a file: '{raw_path}'")

    ext = target_path.suffix.lower()
    if ext not in ALLOWED_OPEN_EXTENSIONS:
        raise PermissionError(
            f"Opening file type '{ext}' is forbidden for security. Allowed: {', '.join(sorted(ALLOWED_OPEN_EXTENSIONS))}"
        )

    # Safe opening via os.startfile (Windows) or xdg-open / open (fallback)
    try:
        if hasattr(os, "startfile"):
            os.startfile(str(target_path))
        else:
            opener = "open" if sys.platform == "darwin" else "xdg-open"
            subprocess.Popen([opener, str(target_path)], shell=False)
    except Exception as exc:
        raise RuntimeError(f"Failed to launch file viewer: {exc}")

    base_dir = WORKSPACE_DIR.resolve()
    rel_path = str(target_path.relative_to(base_dir)).replace("\\", "/")

    return {
        "opened": True,
        "path": rel_path,
        "filename": target_path.name,
        "extension": ext,
        "message": f"File '{target_path.name}' opened successfully."
    }


# ==============================================================================
# Central Command Registry Definition
# ==============================================================================

class CommandSpec:
    """Specification of an authorized safe command."""
    def __init__(
        self,
        action: str,
        description: str,
        executor: Callable[[Dict[str, Any]], Dict[str, Any]],
        required_params: Optional[List[str]] = None,
        optional_params: Optional[List[str]] = None
    ):
        self.action = action
        self.description = description
        self.executor = executor
        self.required_params = required_params or []
        self.optional_params = optional_params or []

    PARAM_ALIASES = {
        "name": ["name", "folder_name"],
        "app": ["app", "app_name"],
        "path": ["path", "folder_name", "file_name"]
    }

    def validate_params(self, params: Dict[str, Any]) -> None:
        """Verify presence of required parameters."""
        for param in self.required_params:
            aliases = self.PARAM_ALIASES.get(param, [param])
            if not any(a in params and params[a] is not None for a in aliases):
                raise ValueError(f"Missing required parameter '{param}' for command '{self.action}'.")


COMMAND_REGISTRY: Dict[str, CommandSpec] = {
    "system_status": CommandSpec(
        action="system_status",
        description="Retrieve hardware metrics (CPU, RAM, Disk, OS).",
        executor=handle_system_status,
        required_params=[]
    ),
    "open_url": CommandSpec(
        action="open_url",
        description="Open an HTTP/HTTPS URL in the default browser.",
        executor=handle_open_url,
        required_params=["url"]
    ),
    "create_folder": CommandSpec(
        action="create_folder",
        description="Create a directory within the safe workspace.",
        executor=handle_create_folder,
        required_params=["name"]
    ),
    "open_app": CommandSpec(
        action="open_app",
        description="Launch a whitelisted safe desktop application.",
        executor=handle_open_app,
        required_params=["app"]
    ),
    "open_folder": CommandSpec(
        action="open_folder",
        description="Open an approved folder in Windows File Explorer.",
        executor=handle_open_folder,
        required_params=["path"]
    ),
    "list_folder": CommandSpec(
        action="list_folder",
        description="List files and folders within an approved workspace path.",
        executor=handle_list_folder,
        required_params=[]
    ),
    "get_file_info": CommandSpec(
        action="get_file_info",
        description="Retrieve safe file metadata (size, mod time, extension).",
        executor=handle_get_file_info,
        required_params=["path"]
    ),
    "create_text_file": CommandSpec(
        action="create_text_file",
        description="Create a simple text file (.txt, .md, .csv, .json) in workspace.",
        executor=handle_create_text_file,
        required_params=["path"]
    ),
    "open_file": CommandSpec(
        action="open_file",
        description="Open an existing safe file with its default application.",
        executor=handle_open_file,
        required_params=["path"]
    )
}


def execute_registered_command(command: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a command through the centralized command registry.
    
    Returns standard structured result:
    { "success": bool, "action": str, "message": str, "data": dict, "error": str }
    """
    if not isinstance(command, str) or not command.strip():
        return {
            "success": False,
            "action": "unknown",
            "message": "Invalid command name: must be a non-empty string.",
            "data": None,
            "error": "Invalid command name: must be a non-empty string."
        }

    clean_cmd = command.strip().lower()

    if clean_cmd not in COMMAND_REGISTRY:
        allowed = list(COMMAND_REGISTRY.keys())
        msg = f"Command '{clean_cmd}' is disallowed. Allowed safe commands: {', '.join(allowed)}"
        return {
            "success": False,
            "action": clean_cmd,
            "message": msg,
            "data": None,
            "error": msg
        }

    spec = COMMAND_REGISTRY[clean_cmd]
    try:
        spec.validate_params(params or {})
        result_data = spec.executor(params or {})
        return {
            "success": True,
            "action": clean_cmd,
            "message": result_data.get("message", "Command executed successfully.") if isinstance(result_data, dict) else "Command executed successfully.",
            "data": result_data,
            "error": None
        }
    except Exception as exc:
        err_str = str(exc)
        return {
            "success": False,
            "action": clean_cmd,
            "message": err_str,
            "data": None,
            "error": err_str
        }
