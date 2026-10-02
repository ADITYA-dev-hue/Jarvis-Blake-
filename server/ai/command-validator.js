/**
 * JARVIS Phase 6 - Command Validator
 * 
 * Independent security and parameter verification layer.
 * Enforces strict action whitelisting, URL safety, workspace path containment,
 * file extension allowlists, and application authorization before any command
 * reaches the laptop agent.
 */

// Application whitelist matching the laptop agent
const ALLOWED_APPS = new Set(['notepad', 'calculator', 'paint', 'explorer', 'code', 'chrome']);

// Allowed command actions (9 safe actions)
const ALLOWED_ACTIONS = new Set([
  'system_status',
  'open_url',
  'create_folder',
  'open_app',
  'open_folder',
  'list_folder',
  'get_file_info',
  'create_text_file',
  'open_file'
]);

// Maximum file content length (10,000 characters)
const MAX_FILE_CONTENT_LENGTH = 10000;

// Allowed file extensions for creating text files
const ALLOWED_CREATE_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json']);

// Allowed file extensions for opening existing files
const ALLOWED_OPEN_EXTENSIONS = new Set([
  '.txt', '.md', '.csv', '.json',
  '.py', '.html', '.css', '.js', '.ts', '.tsx'
]);

/**
 * Validate that a relative path string is safe and contained within workspace.
 * 
 * @param {string} rawPath
 * @param {boolean} allowEmpty Whether empty/root workspace is permitted
 * @returns {{ valid: boolean, path?: string, error?: string }}
 */
function validateSafeWorkspacePath(rawPath, allowEmpty = false) {
  if (rawPath === undefined || rawPath === null) {
    if (allowEmpty) return { valid: true, path: '' };
    return { valid: false, error: "Missing required 'path' parameter." };
  }

  if (typeof rawPath !== 'string') {
    return { valid: false, error: "Path parameter must be a string." };
  }

  const trimmed = rawPath.trim();

  // Empty or alias
  if (trimmed === '' || trimmed === '.' || trimmed.toLowerCase() === 'workspace' || trimmed.toLowerCase() === 'jarvis workspace') {
    if (allowEmpty) return { valid: true, path: '' };
    return { valid: false, error: "A specific path within the workspace is required." };
  }

  // Check for control characters
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return { valid: false, error: "Path contains forbidden control characters." };
  }

  // Block file URLs
  if (trimmed.toLowerCase().startsWith('file://') || trimmed.toLowerCase().startsWith('file:')) {
    return { valid: false, error: "Security violation: File URLs are strictly forbidden." };
  }

  // Block UNC network paths (\\server\share or //server/share)
  if (trimmed.startsWith('\\\\') || trimmed.startsWith('//')) {
    return { valid: false, error: "Security violation: UNC network paths are forbidden." };
  }

  // Block root / absolute paths
  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    return { valid: false, error: "Security violation: Absolute folder/file paths are forbidden." };
  }

  // Block drive letters (e.g. C:\ or D:\)
  if (/^[a-zA-Z]:/.test(trimmed)) {
    return { valid: false, error: "Security violation: Drive-letter paths are forbidden." };
  }

  // Block path traversal tokens
  const normalizedParts = trimmed.replace(/\\/g, '/').split('/');
  for (const part of normalizedParts) {
    const cleanPart = part.trim();
    if (cleanPart === '..') {
      return { valid: false, error: "Security violation: Path traversal elements ('..') are strictly forbidden." };
    }
  }

  // Block illegal Windows characters (< > : " | ? *)
  if (/[<>:"|?*]/.test(trimmed)) {
    return { valid: false, error: "Path contains illegal filesystem characters." };
  }

  // Normalized safe relative path
  const normalizedPath = trimmed.replace(/\\/g, '/');
  return { valid: true, path: normalizedPath };
}

/**
 * Validate an interpreted command structure
 * 
 * @param {object} parsed Output from the command parser
 * @returns {object} { valid: boolean, command?: object, error?: string, message?: string }
 */
function validateCommand(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return {
      valid: false,
      error: "Invalid command structure: expected a JSON object.",
      message: "I can't perform that action yet."
    };
  }

  const { action, parameters = {}, message } = parsed;

  if (action === 'unsupported') {
    return {
      valid: false,
      action: 'unsupported',
      message: message || "I can't perform that action yet."
    };
  }

  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return {
      valid: false,
      error: `Command '${action}' is not permitted.`,
      message: "I can't perform that action yet."
    };
  }

  if (typeof parameters !== 'object' || parameters === null || Array.isArray(parameters)) {
    return {
      valid: false,
      error: "Command parameters must be a valid object."
    };
  }

  // 1. Validation for system_status
  if (action === 'system_status') {
    return {
      valid: true,
      command: {
        action: 'system_status',
        parameters: {}
      }
    };
  }

  // 2. Validation for open_url
  if (action === 'open_url') {
    const rawUrl = parameters.url;
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
      return {
        valid: false,
        error: "Missing or invalid 'url' parameter."
      };
    }

    const trimmedUrl = rawUrl.trim();

    // Check for control characters
    if (/[\x00-\x1F\x7F]/.test(trimmedUrl)) {
      return {
        valid: false,
        error: "URL contains forbidden control characters."
      };
    }

    // Protocol enforcement: strictly http:// or https://
    try {
      const parsedUrl = new URL(trimmedUrl);
      const protocol = parsedUrl.protocol.toLowerCase();
      if (protocol !== 'http:' && protocol !== 'https:') {
        return {
          valid: false,
          error: "Only HTTP and HTTPS URLs are permitted."
        };
      }
    } catch (_) {
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        return {
          valid: false,
          error: "Only HTTP and HTTPS URLs are permitted."
        };
      }
    }

    return {
      valid: true,
      command: {
        action: 'open_url',
        parameters: {
          url: trimmedUrl
        }
      }
    };
  }

  // 3. Validation for create_folder
  if (action === 'create_folder') {
    const rawName = parameters.name || parameters.folder_name;
    const pathCheck = validateSafeWorkspacePath(rawName, false);
    if (!pathCheck.valid) {
      return { valid: false, error: pathCheck.error };
    }

    return {
      valid: true,
      command: {
        action: 'create_folder',
        parameters: {
          name: pathCheck.path
        }
      }
    };
  }

  // 4. Validation for open_app
  if (action === 'open_app') {
    const rawApp = parameters.app || parameters.app_name;
    if (!rawApp || typeof rawApp !== 'string' || !rawApp.trim()) {
      return {
        valid: false,
        error: "Missing or invalid 'app' parameter."
      };
    }

    const appKey = rawApp.trim().toLowerCase();

    // Check application whitelist
    if (!ALLOWED_APPS.has(appKey)) {
      return {
        valid: false,
        error: `Application '${rawApp}' is not whitelisted. Allowed: ${Array.from(ALLOWED_APPS).join(', ')}`
      };
    }

    return {
      valid: true,
      command: {
        action: 'open_app',
        parameters: {
          app: appKey
        }
      }
    };
  }

  // 5. Validation for open_folder
  if (action === 'open_folder') {
    const rawPath = parameters.path !== undefined ? parameters.path : parameters.folder_name;
    const pathCheck = validateSafeWorkspacePath(rawPath, true);
    if (!pathCheck.valid) {
      return { valid: false, error: pathCheck.error };
    }

    return {
      valid: true,
      command: {
        action: 'open_folder',
        parameters: {
          path: pathCheck.path
        }
      }
    };
  }

  // 6. Validation for list_folder
  if (action === 'list_folder') {
    const rawPath = parameters.path !== undefined ? parameters.path : parameters.folder_name;
    const pathCheck = validateSafeWorkspacePath(rawPath, true);
    if (!pathCheck.valid) {
      return { valid: false, error: pathCheck.error };
    }

    return {
      valid: true,
      command: {
        action: 'list_folder',
        parameters: {
          path: pathCheck.path
        }
      }
    };
  }

  // 7. Validation for get_file_info
  if (action === 'get_file_info') {
    const rawPath = parameters.path !== undefined ? parameters.path : parameters.file_name;
    const pathCheck = validateSafeWorkspacePath(rawPath, false);
    if (!pathCheck.valid) {
      return { valid: false, error: pathCheck.error };
    }

    return {
      valid: true,
      command: {
        action: 'get_file_info',
        parameters: {
          path: pathCheck.path
        }
      }
    };
  }

  // 8. Validation for create_text_file
  if (action === 'create_text_file') {
    const rawPath = parameters.path !== undefined ? parameters.path : parameters.file_name;
    const pathCheck = validateSafeWorkspacePath(rawPath, false);
    if (!pathCheck.valid) {
      return { valid: false, error: pathCheck.error };
    }

    // Check extension
    const dotIdx = pathCheck.path.lastIndexOf('.');
    if (dotIdx === -1) {
      return {
        valid: false,
        error: `File must have a safe extension (${Array.from(ALLOWED_CREATE_EXTENSIONS).join(', ')}).`
      };
    }
    const ext = pathCheck.path.substring(dotIdx).toLowerCase();
    if (!ALLOWED_CREATE_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: `File extension '${ext}' is forbidden. Allowed: ${Array.from(ALLOWED_CREATE_EXTENSIONS).join(', ')}`
      };
    }

    // Check content
    const content = parameters.content !== undefined ? parameters.content : '';
    if (typeof content !== 'string') {
      return {
        valid: false,
        error: "Parameter 'content' must be a string."
      };
    }

    if (content.length > MAX_FILE_CONTENT_LENGTH) {
      return {
        valid: false,
        error: `Content length (${content.length}) exceeds maximum allowed limit of ${MAX_FILE_CONTENT_LENGTH} characters.`
      };
    }

    return {
      valid: true,
      command: {
        action: 'create_text_file',
        parameters: {
          path: pathCheck.path,
          content
        }
      }
    };
  }

  // 9. Validation for open_file
  if (action === 'open_file') {
    const rawPath = parameters.path !== undefined ? parameters.path : parameters.file_name;
    const pathCheck = validateSafeWorkspacePath(rawPath, false);
    if (!pathCheck.valid) {
      return { valid: false, error: pathCheck.error };
    }

    // Check extension
    const dotIdx = pathCheck.path.lastIndexOf('.');
    if (dotIdx === -1) {
      return {
        valid: false,
        error: `File must have a valid extension (${Array.from(ALLOWED_OPEN_EXTENSIONS).join(', ')}).`
      };
    }
    const ext = pathCheck.path.substring(dotIdx).toLowerCase();
    if (!ALLOWED_OPEN_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: `Opening file type '${ext}' is forbidden for security. Allowed: ${Array.from(ALLOWED_OPEN_EXTENSIONS).join(', ')}`
      };
    }

    return {
      valid: true,
      command: {
        action: 'open_file',
        parameters: {
          path: pathCheck.path
        }
      }
    };
  }

  return {
    valid: false,
    error: "Unknown validation error."
  };
}

module.exports = {
  validateCommand,
  validateSafeWorkspacePath,
  ALLOWED_APPS,
  ALLOWED_ACTIONS,
  ALLOWED_CREATE_EXTENSIONS,
  ALLOWED_OPEN_EXTENSIONS,
  MAX_FILE_CONTENT_LENGTH
};
