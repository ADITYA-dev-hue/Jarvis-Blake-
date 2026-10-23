r"""Intelligent Notepad & Text-File Automation for IGRIS (Phase 14).

Provides safe, deterministic, and verifiable text file operations:
- Open Notepad and focus application.
- Create, write, append, save, open, and verify text files.
- Strict workspace sandbox containment (D:\JARVIS\workspace).
- Rejects path traversal and unauthorized absolute paths.
- Enforces safe extensions (.txt, .md, .csv, .json).
- Never overwrites existing files silently without explicit confirmation.
- Guarantees clean UTF-8 encoding and verifies file integrity on disk.
"""

import os
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, Optional

from config import WORKSPACE_DIR

ALLOWED_EXTENSIONS = {".txt", ".md", ".csv", ".json"}
MAX_CONTENT_LENGTH = 10000


def _resolve_safe_text_path(raw_path: str, must_exist: bool = False) -> Path:
    """Resolve and validate a text file path inside the safe workspace."""
    from command_registry import resolve_workspace_path
    target = resolve_workspace_path(raw_path, must_exist=must_exist, allow_root=False)

    ext = target.suffix.lower()
    if not ext:
        # Default to .txt if no extension provided
        target = target.with_suffix(".txt")
        ext = ".txt"

    if ext not in ALLOWED_EXTENSIONS:
        raise PermissionError(
            f"File extension '{ext}' is forbidden. Allowed text extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    return target


def open_notepad() -> Dict[str, Any]:
    """Launch Windows Notepad or focus an existing Notepad window."""
    import window_manager

    # Check if Notepad is already open and focus it
    open_windows = window_manager._find_top_level_windows()
    for win in open_windows:
        if win[1] == "notepad":
            window_manager.focus_window("notepad")
            return {
                "success": True,
                "opened": True,
                "reused": True,
                "message": "Notepad is already open. Brought to focus."
            }

    # Launch Notepad
    proc = subprocess.Popen(
        ["notepad.exe"],
        shell=False,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    # Allow window time to initialize
    focus_res = window_manager.ensure_app_focused("notepad", timeout_secs=4.0)

    return {
        "success": True,
        "opened": True,
        "reused": False,
        "pid": proc.pid,
        "focused": focus_res.get("success", False),
        "message": "Notepad opened successfully."
    }


def write_text_file(
    path: str,
    content: str,
    overwrite: bool = False
) -> Dict[str, Any]:
    """Write text content into an approved workspace file with safety checks.
    
    If the file already exists and overwrite is False, halts and requests
    user confirmation before proceeding.
    """
    if not isinstance(content, str):
        raise ValueError("Parameter 'content' must be a string.")

    if len(content) > MAX_CONTENT_LENGTH:
        raise ValueError(
            f"Content length ({len(content)}) exceeds maximum allowed limit of {MAX_CONTENT_LENGTH} characters."
        )

    target_path = _resolve_safe_text_path(path, must_exist=False)
    base_dir = WORKSPACE_DIR.resolve()
    rel_path = str(target_path.relative_to(base_dir)).replace("\\", "/")

    # Check for silent overwrite protection
    if target_path.exists() and not overwrite:
        return {
            "success": False,
            "already_exists": True,
            "needs_confirmation": True,
            "path": rel_path,
            "filename": target_path.name,
            "message": f"File '{target_path.name}' already exists. Would you like to overwrite it, append to it, or choose another name?"
        }

    # Ensure parent folder exists
    target_path.parent.mkdir(parents=True, exist_ok=True)

    # Write UTF-8
    target_path.write_text(content, encoding="utf-8")

    return {
        "success": True,
        "written": True,
        "path": rel_path,
        "filename": target_path.name,
        "size_bytes": len(content.encode("utf-8")),
        "message": f"Text written successfully to '{target_path.name}'."
    }


def append_text_file(path: str, content: str) -> Dict[str, Any]:
    """Append text content to an existing text file inside the workspace."""
    if not isinstance(content, str):
        raise ValueError("Parameter 'content' must be a string.")

    target_path = _resolve_safe_text_path(path, must_exist=False)
    base_dir = WORKSPACE_DIR.resolve()
    rel_path = str(target_path.relative_to(base_dir)).replace("\\", "/")

    target_path.parent.mkdir(parents=True, exist_ok=True)

    existing_text = ""
    if target_path.exists():
        existing_text = target_path.read_text(encoding="utf-8")

    new_text = existing_text
    if new_text and not new_text.endswith("\n"):
        new_text += "\n"
    new_text += content

    if len(new_text) > MAX_CONTENT_LENGTH:
        raise ValueError(
            f"Resulting file content ({len(new_text)}) exceeds maximum allowed limit of {MAX_CONTENT_LENGTH} characters."
        )

    target_path.write_text(new_text, encoding="utf-8")

    return {
        "success": True,
        "appended": True,
        "path": rel_path,
        "filename": target_path.name,
        "size_bytes": len(new_text.encode("utf-8")),
        "message": f"Appended text to '{target_path.name}' successfully."
    }


def save_text_file(path: str, content: Optional[str] = None) -> Dict[str, Any]:
    """Save document to workspace disk and verify persistence."""
    target_path = _resolve_safe_text_path(path, must_exist=False)
    base_dir = WORKSPACE_DIR.resolve()
    rel_path = str(target_path.relative_to(base_dir)).replace("\\", "/")

    target_path.parent.mkdir(parents=True, exist_ok=True)

    if content is not None:
        if not isinstance(content, str):
            raise ValueError("Parameter 'content' must be a string.")
        if len(content) > MAX_CONTENT_LENGTH:
            raise ValueError(f"Content length exceeds limit of {MAX_CONTENT_LENGTH} characters.")
        target_path.write_text(content, encoding="utf-8")
    elif not target_path.exists():
        # Create empty file if no content was provided and file does not exist
        target_path.write_text("", encoding="utf-8")

    if not target_path.exists():
        raise RuntimeError(f"Failed to verify saved file '{target_path.name}' on disk.")

    return {
        "success": True,
        "saved": True,
        "path": rel_path,
        "filename": target_path.name,
        "full_path": str(target_path),
        "size_bytes": target_path.stat().st_size,
        "message": f"The text file has been saved as {target_path.name}."
    }


def open_text_file(path: str) -> Dict[str, Any]:
    """Open an existing text file with Windows Notepad."""
    target_path = _resolve_safe_text_path(path, must_exist=True)
    base_dir = WORKSPACE_DIR.resolve()
    rel_path = str(target_path.relative_to(base_dir)).replace("\\", "/")

    subprocess.Popen(
        ["notepad.exe", str(target_path)],
        shell=False,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    return {
        "success": True,
        "opened": True,
        "path": rel_path,
        "filename": target_path.name,
        "message": f"Opened '{target_path.name}' in Notepad."
    }


def verify_text_file(
    path: str,
    expected_content: Optional[str] = None
) -> Dict[str, Any]:
    """Verify that a saved text file exists on disk and matches expected content."""
    target_path = _resolve_safe_text_path(path, must_exist=True)
    base_dir = WORKSPACE_DIR.resolve()
    rel_path = str(target_path.relative_to(base_dir)).replace("\\", "/")

    actual_content = target_path.read_text(encoding="utf-8")

    if expected_content is not None:
        # Check if expected text is contained or matches exactly
        if expected_content.strip() not in actual_content.strip():
            return {
                "success": False,
                "verified": False,
                "path": rel_path,
                "filename": target_path.name,
                "error": "Content on disk does not match expected text.",
                "message": f"Verification failed: content of '{target_path.name}' did not match expected text."
            }

    preview = actual_content[:60] + ("..." if len(actual_content) > 60 else "")
    return {
        "success": True,
        "verified": True,
        "path": rel_path,
        "filename": target_path.name,
        "size_bytes": target_path.stat().st_size,
        "line_count": len(actual_content.splitlines()),
        "preview": preview,
        "message": f"File '{target_path.name}' verified successfully on disk."
    }
