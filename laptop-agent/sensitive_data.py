"""JARVIS / IGRIS Phase 11 - Sensitive Data Protection & Redaction

Guarantees:
1. Strict exclusion of credential and secret files (.env, private keys, certificates, token stores).
2. Automatic redaction of API keys, bearer tokens, passwords, and private key blocks before processing.
3. Treats file contents as pure untrusted DATA, preventing secret exfiltration.
"""

import re
from pathlib import Path
from typing import Union

# Sensitive filename patterns (case-insensitive)
SENSITIVE_FILE_PATTERNS = [
    r'^\.env(\..+)?$',           # .env, .env.local, .env.production
    r'.*\.pem$',                 # Privacy Enhanced Mail certificates / keys
    r'.*\.key$',                 # Private keys
    r'.*\.pfx$',                 # PKCS #12 certs
    r'.*\.p12$',
    r'.*\.kdbx$',                # KeePass databases
    r'.*\.keystore$',            # Java keystores
    r'^credentials(\..+)?$',     # credentials, credentials.json
    r'^secrets?(\..+)?$',        # secret.json, secrets.yaml
    r'.*id_rsa.*',               # SSH private keys
    r'.*id_ed25519.*',
    r'.*id_ecdsa.*',
    r'.*auth_token.*',           # Auth token files
    r'.*access_token.*',
    r'.*password.*',             # Password files
    r'.*htpasswd.*',
]

# Compiled regex for sensitive file patterns
_SENSITIVE_FILE_REGEXES = [re.compile(p, re.IGNORECASE) for p in SENSITIVE_FILE_PATTERNS]

# Secret pattern regexes for redaction in text content
SECRET_PATTERNS = [
    # Private Key blocks
    (re.compile(r'-----BEGIN [A-Z0-9 ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]+ PRIVATE KEY-----', re.IGNORECASE),
     '[REDACTED_PRIVATE_KEY]'),
    
    # Generic API Keys / Tokens (key/token = "...")
    (re.compile(r'(?i)\b(api[_-]?key|auth[_-]?token|access[_-]?token|bearer|secret[_-]?key|password|client[_-]?secret)\s*[:=]\s*["\']?([a-zA-Z0-9_\-\.]{8,})["\']?'),
     r'\1=[REDACTED_SECRET]'),

    # OpenAI / Gemini / GitHub / Slack / AWS specific token prefixes
    (re.compile(r'\b(AIzaSy[a-zA-Z0-9_\-]{33})\b'), '[REDACTED_GEMINI_API_KEY]'),
    (re.compile(r'\b(sk-[a-zA-Z0-9]{20,})\b'), '[REDACTED_API_KEY]'),
    (re.compile(r'\b(ghp_[a-zA-Z0-9]{36})\b'), '[REDACTED_GITHUB_TOKEN]'),
    (re.compile(r'\b(xox[baprs]-[0-9a-zA-Z]{10,48})\b'), '[REDACTED_SLACK_TOKEN]'),
    (re.compile(r'\b(AKIA[0-9A-Z]{16})\b'), '[REDACTED_AWS_KEY]'),
]


def is_sensitive_file(filename_or_path: Union[str, Path]) -> bool:
    """Check if a filename or path matches any sensitive file patterns.
    
    Args:
        filename_or_path: Path object or string of the filename/relative path.
        
    Returns:
        True if the file is classified as sensitive and must be blocked from analysis.
    """
    if not filename_or_path:
        return False

    name = Path(filename_or_path).name.strip().lower()

    for regex in _SENSITIVE_FILE_REGEXES:
        if regex.match(name):
            return True

    return False


def redact_secrets(content: str) -> str:
    """Redact known API keys, tokens, passwords, and private key blocks from content.
    
    Args:
        content: Raw text string from file or metadata.
        
    Returns:
        Sanitized text string with secrets replaced by redaction placeholders.
    """
    if not content or not isinstance(content, str):
        return ""

    sanitized = content
    for pattern, replacement in SECRET_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)

    return sanitized
