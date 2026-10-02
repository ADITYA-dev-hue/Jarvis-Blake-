"""Safe Command Execution Router for JARVIS Laptop Agent.

Bridges existing command interfaces to the Centralized Command Registry (Phase 6).
Preserves backwards compatibility for all Phase 1–5 tests and callers.
"""

from typing import Any, Dict

from command_registry import (
    COMMAND_REGISTRY,
    WHITELISTED_APPS,
    ALLOWED_TEXT_EXTENSIONS,
    ALLOWED_OPEN_EXTENSIONS,
    MAX_FILE_CONTENT_LENGTH,
    resolve_workspace_path,
    execute_registered_command,
    handle_system_status,
    handle_open_url,
    handle_create_folder,
    handle_open_app,
    handle_open_folder,
    handle_list_folder,
    handle_get_file_info,
    handle_create_text_file,
    handle_open_file,
    format_bytes,
    format_uptime
)

# Backwards compatibility alias
SAFE_COMMAND_REGISTRY = {
    cmd: spec.executor for cmd, spec in COMMAND_REGISTRY.items()
}


def execute_safe_command(command: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a command through the centralized command registry.
    
    Preserves exact backwards compatibility format:
    { "success": bool, "command": str, "data": dict|None, "error": str|None }
    """
    res = execute_registered_command(command, params)
    # Ensure both "command" and "action" keys exist for compatibility
    return {
        "success": res["success"],
        "command": res["action"],
        "action": res["action"],
        "message": res.get("message"),
        "data": res["data"],
        "error": res["error"]
    }
