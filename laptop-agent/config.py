"""Configuration manager for the JARVIS Laptop Agent.

Loads environment variables and validates system constraints.
Secrets are loaded strictly from environment variables without hardcoding.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory for the laptop agent
AGENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = AGENT_DIR.parent

# Load .env file from laptop-agent directory, fallback to project root
env_file = AGENT_DIR / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)
else:
    load_dotenv(dotenv_path=PROJECT_ROOT / ".env")

# Server connection settings
JARVIS_SERVER_URL = os.getenv("JARVIS_SERVER_URL", os.getenv("SERVER_URL", "http://localhost:3000")).rstrip("/")
JARVIS_AUTH_TOKEN = os.getenv("JARVIS_AUTH_TOKEN", "")
JARVIS_AGENT_ID = os.getenv("JARVIS_AGENT_ID", "LAPTOP-01")

# Predefined safe workspace directory (strict containment boundary)
default_workspace = PROJECT_ROOT / "workspace"
workspace_env = os.getenv("JARVIS_WORKSPACE_DIR", str(default_workspace))
WORKSPACE_DIR = Path(workspace_env).resolve()

# Ensure the safe workspace directory exists
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

# Logging configuration
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

def get_config_summary() -> dict:
    """Return a sanitized dictionary of the active configuration (token omitted)."""
    return {
        "server_url": JARVIS_SERVER_URL,
        "agent_id": JARVIS_AGENT_ID,
        "auth_token_configured": bool(JARVIS_AUTH_TOKEN),
        "workspace_dir": str(WORKSPACE_DIR),
        "log_level": LOG_LEVEL
    }
