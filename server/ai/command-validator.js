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

// Allowed command actions (13 safe actions)
const ALLOWED_ACTIONS = new Set([
  'system_status',
  'open_url',
  'create_folder',
  'open_app',
  'open_folder',
  'list_folder',
  'get_file_info',
  'create_text_file',
  'open_file',
  'type_text',
  'wait',
  'search_web',
  'task'
]);

// Maximum limits
const MAX_FILE_CONTENT_LENGTH = 10000;
const MAX_TASK_STEPS = 10;
const MAX_TYPE_TEXT_LENGTH = 1000;
const MAX_WAIT_MS = 10000;
const MAX_SEARCH_QUERY_LENGTH = 500;

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

  // 10. Validation for type_text
  if (action === 'type_text') {
    const rawText = parameters.text;
    if (rawText === undefined || rawText === null) {
      return { valid: false, error: "Missing required 'text' parameter." };
    }
    if (typeof rawText !== 'string') {
      return { valid: false, error: "Parameter 'text' must be a string." };
    }
    if (rawText.length === 0) {
      return { valid: false, error: "Parameter 'text' cannot be empty." };
    }
    if (rawText.length > MAX_TYPE_TEXT_LENGTH) {
      return {
        valid: false,
        error: `Text length (${rawText.length}) exceeds maximum allowed limit of ${MAX_TYPE_TEXT_LENGTH} characters.`
      };
    }
    if (rawText.includes('\x00')) {
      return { valid: false, error: "Text contains forbidden characters." };
    }

    return {
      valid: true,
      command: {
        action: 'type_text',
        parameters: {
          text: rawText
        }
      }
    };
  }

  // 11. Validation for wait
  if (action === 'wait') {
    const rawMs = parameters.milliseconds !== undefined ? parameters.milliseconds : parameters.ms;
    if (rawMs === undefined || rawMs === null) {
      return { valid: false, error: "Missing required 'milliseconds' parameter." };
    }
    if (typeof rawMs !== 'number' || isNaN(rawMs)) {
      return { valid: false, error: "Parameter 'milliseconds' must be a number." };
    }
    if (rawMs < 0) {
      return { valid: false, error: "Wait duration cannot be negative." };
    }
    if (rawMs > MAX_WAIT_MS) {
      return {
        valid: false,
        error: `Wait duration (${rawMs} ms) exceeds maximum allowed limit of ${MAX_WAIT_MS} milliseconds.`
      };
    }

    return {
      valid: true,
      command: {
        action: 'wait',
        parameters: {
          milliseconds: Math.round(rawMs)
        }
      }
    };
  }

  // 12. Validation for search_web
  if (action === 'search_web') {
    const rawQuery = parameters.query;
    if (rawQuery === undefined || rawQuery === null) {
      return { valid: false, error: "Missing required 'query' parameter." };
    }
    if (typeof rawQuery !== 'string') {
      return { valid: false, error: "Parameter 'query' must be a string." };
    }
    const trimmed = rawQuery.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: "Search query cannot be empty." };
    }
    if (trimmed.length > MAX_SEARCH_QUERY_LENGTH) {
      return {
        valid: false,
        error: `Search query exceeds maximum allowed limit of ${MAX_SEARCH_QUERY_LENGTH} characters.`
      };
    }
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('file:') || lower.startsWith('javascript:') || lower.startsWith('data:')) {
      return { valid: false, error: "Security violation: Forbidden URI scheme in search query." };
    }
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)) {
      return { valid: false, error: "Search query contains forbidden control characters." };
    }

    return {
      valid: true,
      command: {
        action: 'search_web',
        parameters: {
          query: trimmed
        }
      }
    };
  }

  // 13. Validation for task
  if (action === 'task') {
    const rawSteps = parameters.steps;
    if (!rawSteps || !Array.isArray(rawSteps)) {
      return { valid: false, error: "Parameter 'steps' must be an array of steps." };
    }
    if (rawSteps.length === 0) {
      return { valid: false, error: "Task must contain at least one step." };
    }
    if (rawSteps.length > MAX_TASK_STEPS) {
      return {
        valid: false,
        error: `Task step count (${rawSteps.length}) exceeds maximum allowed limit of ${MAX_TASK_STEPS} steps.`
      };
    }

    const validatedSteps = [];
    for (let i = 0; i < rawSteps.length; i++) {
      const step = rawSteps[i];
      if (!step || typeof step !== 'object') {
        return { valid: false, error: `Task step ${i + 1} must be an object.` };
      }
      if (typeof step.action !== 'string') {
        return { valid: false, error: `Task step ${i + 1} is missing action.` };
      }
      const stepAction = step.action.trim().toLowerCase();
      if (stepAction === 'task') {
        return {
          valid: false,
          error: `Security violation: Nested task recursion in step ${i + 1} is strictly forbidden.`
        };
      }
      if (!ALLOWED_ACTIONS.has(stepAction)) {
        return {
          valid: false,
          error: `Disallowed action '${stepAction}' in task step ${i + 1}.`
        };
      }

      // Validate each step using validateCommand
      const stepValidation = validateCommand({ action: stepAction, parameters: step.parameters || {} });
      if (!stepValidation.valid) {
        return {
          valid: false,
          error: `Task step ${i + 1} validation failed: ${stepValidation.error}`
        };
      }
      validatedSteps.push(stepValidation.command);
    }

    return {
      valid: true,
      command: {
        action: 'task',
        parameters: {
          steps: validatedSteps
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
  MAX_FILE_CONTENT_LENGTH,
  MAX_TASK_STEPS,
  MAX_TYPE_TEXT_LENGTH,
  MAX_WAIT_MS,
  MAX_SEARCH_QUERY_LENGTH
};
