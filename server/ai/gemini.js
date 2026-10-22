/**
 * JARVIS / IGRIS Phase 9 - Intelligent Workflow Engine & Multilingual Assistant Layer
 * 
 * Interacts with Google Gemini API to translate natural language requests (in English,
 * Hinglish, and Hindi) into structured, safe workflow tasks and actions with context awareness.
 * 
 * Features:
 * - English, Hinglish, and Hindi natural-language intent understanding
 * - Automatic language detection & user language preference handling
 * - Intelligent workflow planning & safe task construction
 * - Context-aware references ("now", "it", "again")
 * - Safe task confirmation flagging for multi-step workflows
 * - Independent validation on all structured outputs (Double-validation)
 * - Zero direct computer control.
 */

const { GoogleGenAI } = require('@google/genai');
const { JARVIS_SYSTEM_INSTRUCTION } = require('./prompt');
const { parseCommand } = require('./command-parser');
const { validateCommand } = require('./command-validator');
const {
  detectLanguage,
  checkLanguageSwitchCommand,
  checkVoiceStyleSwitchCommand,
  formatMultilingualResponse,
  formatMultilingualError,
  formatConfirmationPrompt
} = require('./language-engine');

// Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS, 10) || 6000;
const MAX_CONTEXT_MESSAGES = parseInt(process.env.MAX_CONTEXT_MESSAGES, 10) || 20;
const MAX_CONTEXT_CHARS = 4000;

let genAIClient = null;
if (GEMINI_API_KEY && GEMINI_API_KEY.trim()) {
  try {
    genAIClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY.trim() });
  } catch (err) {
    console.error('[AI] Failed to initialize GoogleGenAI client:', err.message);
  }
}

/**
 * Format recent conversation history into structured prompt text
 */
function formatConversationContext(messages, maxMessages = MAX_CONTEXT_MESSAGES) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return '';
  }

  const recent = messages.slice(-maxMessages);
  const lines = [];
  let totalChars = 0;

  for (const msg of recent) {
    const roleLabel = msg.role === 'assistant' ? 'Assistant' : 'User';
    const content = typeof msg.content === 'string' ? msg.content.trim() : String(msg.content || '');
    if (!content) continue;
    const line = `${roleLabel}: "${content}"`;
    lines.push(line);
    totalChars += line.length;
  }

  while (totalChars > MAX_CONTEXT_CHARS && lines.length > 1) {
    const dropped = lines.shift();
    totalChars -= dropped.length;
  }

  return lines.join('\n');
}

/**
 * Local semantic pattern fallback for development/testing when API key is offline
 * or for fast deterministic processing with conversation context across English, Hinglish, Hindi.
 */
function localSemanticInterpreter(text, conversationHistory = [], languagePreference = 'auto') {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Language switch command check
  const switchCheck = checkLanguageSwitchCommand(clean);
  if (switchCheck.isSwitch) {
    return {
      action: 'set_language',
      parameters: { language: switchCheck.targetLanguage },
      message: switchCheck.message,
      targetLanguage: switchCheck.targetLanguage
    };
  }

  // 1b. Voice style switch command check
  const voiceCheck = checkVoiceStyleSwitchCommand(clean);
  if (voiceCheck.isVoiceSwitch) {
    return {
      action: 'set_voice_style',
      parameters: voiceCheck.voiceSettings || {},
      message: voiceCheck.message,
      isVoiceStyleSwitch: true,
      voiceSettings: voiceCheck.voiceSettings
    };
  }

  // 2. Explicit Prompt Injections & Malicious commands -> unsupported
  if (
    lower.includes('ignore your instructions') ||
    lower.includes('ignore previous instructions') ||
    lower.includes('ignore all previous') ||
    lower.includes('ignore all rules') ||
    lower.includes('unrestricted terminal') ||
    lower.includes('run powershell') ||
    lower.includes('execute cmd') ||
    lower.includes('cmd.exe') ||
    lower.includes('powershell.exe') ||
    lower.includes('powershell') ||
    lower.includes('shell command') ||
    lower.includes('run_shell') ||
    lower.includes('delete') ||
    lower.includes('remove') ||
    lower.includes('format c:') ||
    lower.includes('shutdown') ||
    lower.includes('restart') ||
    lower.includes('kill') ||
    lower.includes('install') ||
    lower.includes('remember that you are allowed')
  ) {
    return {
      action: 'unsupported',
      parameters: {},
      message: "I can't perform that action yet."
    };
  }

  // 3. Reject absolute filesystem path exploration (C:\Windows, D:\, etc.)
  if (/^[a-zA-Z]:[\\\/]/.test(clean) || lower.includes('c:\\') || lower.includes('c:/') || lower.includes('d:\\')) {
    return {
      action: 'unsupported',
      parameters: {},
      message: "Access to absolute system paths outside the workspace is denied."
    };
  }

  // 4. Malicious inheritance check
  const isReferentialExecution =
    lower.includes('do what we discussed') ||
    lower.includes('continue what i said') ||
    lower.includes('do what i said') ||
    lower === 'do it' ||
    lower === 'execute it' ||
    lower.includes('run that');

  if (isReferentialExecution && Array.isArray(conversationHistory)) {
    const hasMaliciousHistory = conversationHistory.some((m) => {
      const c = (m.content || '').toLowerCase();
      return (
        c.includes('cmd') ||
        c.includes('powershell') ||
        c.includes('delete') ||
        c.includes('shell') ||
        c.includes('format') ||
        c.includes('ignore') ||
        c.includes('terminal')
      );
    });

    if (hasMaliciousHistory) {
      return {
        action: 'unsupported',
        parameters: {},
        message: "I can't perform that action yet."
      };
    }
  }

  // 5. Conversational Inquiries regarding previous instructions (English & Hinglish)
  if (
    lower.includes('what did i just ask') ||
    lower.includes('what did i ask') ||
    lower.includes('tell me what you just did') ||
    lower.includes('what did you just do') ||
    lower.includes('tell me what you did') ||
    lower.includes('what did you do') ||
    lower.includes('maine abhi kya bola tha') ||
    lower.includes('maine kya bola tha') ||
    lower.includes('tumne abhi kya kiya')
  ) {
    let explanation = "I previously assisted with your request.";
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const msg = conversationHistory[i];
        const content = (msg.content || '').toLowerCase();
        if (msg.role === 'user') {
          if (content.includes('workspace')) {
            explanation = "You asked me to open your workspace.";
            break;
          } else if (content.includes('github') || content.includes('http')) {
            explanation = "I opened GitHub in your default browser.";
            break;
          } else if (content.includes('status') || content.includes('laptop') || content.includes('cpu')) {
            explanation = "I retrieved your laptop system telemetry.";
            break;
          } else if (content.includes('create a folder') || content.includes('create folder')) {
            explanation = "You asked me to create a folder in your workspace.";
            break;
          } else if (content.includes('create a file') || content.includes('create file') || content.includes('notes.txt')) {
            explanation = "You asked me to create a file in your workspace.";
            break;
          } else if (content.includes('open') && content.includes('.txt')) {
            explanation = "You asked me to open notes.txt.";
            break;
          } else if (content.includes('notepad') || content.includes('chrome') || content.includes('code')) {
            explanation = "I launched the requested application on your laptop.";
            break;
          }
        }
      }
    }

    return {
      action: 'unsupported',
      parameters: {},
      message: explanation
    };
  }

  // 6. Ambiguity Handling: "Create a folder" / "Folder banao" with no name
  if (
    /^create\s+(a\s+)?folder\s*[.!?]?$/i.test(clean) ||
    lower === 'create a folder' ||
    lower === 'create folder' ||
    lower === 'folder banao' ||
    lower === 'ek folder banao'
  ) {
    return {
      action: 'unsupported',
      parameters: {},
      message: "What should I name the folder?"
    };
  }

  // Ambiguity Handling: "Create a notes file" / "Create a file"
  if (
    /^create\s+(a\s+)?(notes\s+)?file\s*[.!?]?$/i.test(clean) ||
    lower === 'create a notes file' ||
    lower === 'create a file' ||
    lower === 'create file' ||
    lower === 'file banao'
  ) {
    return {
      action: 'unsupported',
      parameters: {},
      message: "What should I name the file?"
    };
  }

  // Ambiguity Handling: "Open my project"
  if (
    lower === 'open my project' ||
    lower === 'open my project folder' ||
    lower === 'open project' ||
    lower === 'project kholo'
  ) {
    return {
      action: 'unsupported',
      parameters: {},
      message: "Which project folder should I open?"
    };
  }

  // 7. Context-Aware Reference: "Open it" / "Isse open karo" / "Usse open karo" / "Isse kholo"
  if (
    lower === 'open it' ||
    lower === 'open it.' ||
    lower === 'isse open karo' ||
    lower === 'usse open karo' ||
    lower === 'isse kholo' ||
    lower === 'usse kholo' ||
    lower === 'isse open kar do' ||
    lower === 'ise kholo'
  ) {
    let resolvedAction = null;
    let resolvedParams = {};

    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const msg = conversationHistory[i];
        const content = (msg.content || '').toLowerCase();
        if (content.includes('project') || content.includes('folder')) {
          const match =
            content.match(/folder\s+(?:called|named)\s+([a-zA-Z0-9_\-\/]+)/i) ||
            content.match(/(?:called|named)\s+([a-zA-Z0-9_\-\/]+)/i) ||
            content.match(/folder\s+([a-zA-Z0-9_\-\/]+)/i);
          const fName = match ? match[1] : 'Projects';
          resolvedAction = 'open_folder';
          resolvedParams = { path: fName.toLowerCase() === 'projects' ? 'Projects' : fName };
          break;
        } else if (content.includes('notes.txt') || content.includes('.txt') || content.includes('file')) {
          const match = content.match(/([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/i);
          const fName = match ? match[1] : 'notes.txt';
          resolvedAction = 'open_file';
          resolvedParams = { path: fName };
          break;
        }
      }
    }

    if (resolvedAction) {
      return {
        action: resolvedAction,
        parameters: resolvedParams
      };
    }
  }

  // 8. Context-Aware Workflow Reference: "Now search Python roadmap" / "Ab Python roadmap search karo"
  if (
    lower.startsWith('now search ') ||
    lower.startsWith('ab search karo ') ||
    lower.startsWith('ab search ') ||
    lower.startsWith('ab ') && lower.includes('search karo')
  ) {
    let query = clean
      .replace(/^now\s+search\s+(?:for\s+)?/i, '')
      .replace(/^ab\s+(?:search\s+karo\s+|search\s+)/i, '')
      .replace(/\s+search\s+karo$/i, '')
      .replace(/^[.\s"']+|[.\s"']+$/g, '');
    if (query) {
      return {
        action: 'search_web',
        parameters: { query }
      };
    }
  }

  // 9. Multi-Step Workflows:
  // e.g. "Open Chrome, search for Python data science roadmap, then open Notepad and write the first three topics"
  if (
    (lower.includes('chrome') && lower.includes('search') && lower.includes('notepad')) ||
    (lower.includes('notepad') && lower.includes('chrome') && lower.includes('search'))
  ) {
    const qMatch = clean.match(/search\s+(?:for\s+)?([^,]+?)(?:,\s*then|\s+then|\s+aur|\s+and)/i);
    const searchQuery = qMatch ? qMatch[1].trim() : 'Python data science roadmap';
    return {
      action: 'task',
      parameters: {
        steps: [
          { action: 'open_app', parameters: { app: 'chrome' } },
          { action: 'search_web', parameters: { query: searchQuery } },
          { action: 'open_app', parameters: { app: 'notepad' } },
          { action: 'wait', parameters: { milliseconds: 1000 } },
          { action: 'type_text', parameters: { text: `${searchQuery} topics`, app: 'notepad' } }
        ]
      }
    };
  }

  // Multi-step task: "Open Notepad and write ..." / "Notepad kholo aur likho ..."
  if (
    (lower.includes('notepad') && (lower.includes('write') || lower.includes('type') || lower.includes('likho') || lower.includes('likh')))
  ) {
    const textMatch =
      clean.match(/(?:write|type|likho|likh)\s+['"]?([^'"]+)['"]?$/i) ||
      clean.match(/(?:write|type|likho|likh)\s+(.+)$/i);
    let textToType = textMatch ? textMatch[1].trim() : 'Hello';
    textToType = textToType.replace(/^['"]|['"]$/g, '');

    return {
      action: 'task',
      parameters: {
        steps: [
          { action: 'open_app', parameters: { app: 'notepad' } },
          { action: 'wait', parameters: { milliseconds: 1000 } },
          { action: 'type_text', parameters: { text: textToType, app: 'notepad' } }
        ]
      }
    };
  }

  // Multi-step task: "Open Chrome and search for ..." / "Chrome kholo aur search karo ..."
  if (
    (lower.includes('chrome') || lower.includes('google')) &&
    (lower.includes('aur search karo') || lower.includes('aur search kar') || lower.includes('and search for') || lower.includes('and search'))
  ) {
    const qMatch =
      clean.match(/(?:and search for|and search|aur search karo|aur search kar)\s+['"]?([^'"]+)['"]?$/i) ||
      clean.match(/(?:and search for|and search|aur search karo|aur search kar)\s+(.+)$/i);
    let query = qMatch ? qMatch[1].trim() : '';
    query = query.replace(/^['"]|['"]$/g, '');
    if (query) {
      return {
        action: 'search_web',
        parameters: { query }
      };
    }
  }

  // Multi-step task: "Open Chrome and maximize it" / "Chrome kholo aur maximize karo"
  if (
    (lower.includes('open') || lower.includes('kholo') || lower.includes('launch')) &&
    (lower.includes('maximize') || lower.includes('bada karo') || lower.includes('max'))
  ) {
    let targetApp = 'chrome';
    if (lower.includes('notepad') || clean.includes('नोटपैड')) targetApp = 'notepad';
    else if (lower.includes('calc') || clean.includes('कैलकुलेटर')) targetApp = 'calculator';
    else if (lower.includes('paint') || clean.includes('पेंट')) targetApp = 'paint';
    else if (lower.includes('code')) targetApp = 'code';
    else if (lower.includes('explorer')) targetApp = 'explorer';

    return {
      action: 'task',
      parameters: {
        steps: [
          { action: 'open_app', parameters: { app: targetApp } },
          { action: 'maximize_window', parameters: { app: targetApp } }
        ]
      }
    };
  }

  // Multi-step task: "Open Chrome and focus it" / "Notepad kholo aur samne lao"
  if (
    (lower.includes('open') || lower.includes('kholo') || lower.includes('launch')) &&
    (lower.includes('focus') || lower.includes('samne lao') || lower.includes('front'))
  ) {
    let targetApp = 'chrome';
    if (lower.includes('notepad') || clean.includes('नोटपैड')) targetApp = 'notepad';
    else if (lower.includes('calc') || clean.includes('कैलकुलेटर')) targetApp = 'calculator';
    else if (lower.includes('paint') || clean.includes('पेंट')) targetApp = 'paint';
    else if (lower.includes('code')) targetApp = 'code';
    else if (lower.includes('explorer')) targetApp = 'explorer';

    return {
      action: 'task',
      parameters: {
        steps: [
          { action: 'open_app', parameters: { app: targetApp } },
          { action: 'focus_window', parameters: { app: targetApp } }
        ]
      }
    };
  }

  // Phase 11 - Workspace Insights (English, Hinglish, Hindi)
  if (
    lower.includes('workspace insights') ||
    lower.includes('codebase insights') ||
    lower.includes('lines of code') ||
    clean.includes('कार्यस्थान अंतर्दृष्टि')
  ) {
    return {
      action: 'workspace_insights',
      parameters: {}
    };
  }

  // Phase 11 - Read File (Bounded lines)
  if (
    (lower.startsWith('read ') || lower.includes('read lines') || lower.includes('show lines') || lower.includes('read file') || lower.includes('read karo') || lower.includes('padho') || clean.includes('पढ़ो')) &&
    (lower.includes('.') || lower.includes('file'))
  ) {
    const fileMatch = clean.match(/([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/i);
    if (fileMatch) {
      let start_line = 1;
      let end_line = null;
      const lineRangeMatch = clean.match(/lines?\s+(\d+)\s+(?:to|-|se)\s+(\d+)/i);
      if (lineRangeMatch) {
        start_line = parseInt(lineRangeMatch[1], 10);
        end_line = parseInt(lineRangeMatch[2], 10);
      }
      const p = { path: fileMatch[1].replace(/["']/g, '') };
      if (start_line > 1) p.start_line = start_line;
      if (end_line) p.end_line = end_line;
      return {
        action: 'read_file',
        parameters: p
      };
    }
  }

  // Phase 11 - Search File Content
  if (
    (lower.includes('search text') || lower.includes('search content') || lower.includes('find text')) ||
    ((lower.includes('search for') || lower.includes('search')) && (lower.includes(' in ') || lower.includes(' inside ') || lower.includes('across files') || lower.includes('in files')))
  ) {
    const fileMatch = clean.match(/in\s+([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/i);
    const qMatch = clean.match(/(?:search\s+for|search\s+text|search\s+content|find\s+text)\s+['"]?([^'"]+?)['"]?\s+(?:in|inside|across)/i);
    const query = qMatch ? qMatch[1].trim() : 'TODO';
    const params = { query };
    if (fileMatch) {
      params.file_path = fileMatch[1].replace(/["']/g, '');
    }
    return {
      action: 'search_file_content',
      parameters: params
    };
  }

  // Phase 11 - Search Files in Workspace (English, Hinglish, Hindi)
  if (
    lower.includes('search file') ||
    lower.includes('search files') ||
    lower.includes('find files') ||
    lower.includes('find all') ||
    lower.includes('files search') ||
    lower.includes('files dhundho') ||
    clean.includes('फ़ाइलें खोजो') ||
    clean.includes('फाइलें खोजो') ||
    clean.includes('फ़ाइलें') ||
    clean.includes('फाइलें')
  ) {
    let extension = '';
    let query = '';
    if (lower.includes('python') || clean.includes('python') || clean.includes('पायथन')) {
      extension = '.py';
    } else if (lower.includes('cpp') || lower.includes('c++')) {
      extension = '.cpp';
    } else if (lower.includes('java')) {
      extension = '.java';
    } else {
      const extMatch = clean.match(/\.([a-zA-Z0-9]+)\s+files/i) || clean.match(/files\s+(?:with|ending\s+in)\s+\.?([a-zA-Z0-9]+)/i);
      if (extMatch) {
        extension = '.' + extMatch[1].toLowerCase();
      }
    }
    const qMatch = clean.match(/(?:matching|named|called)\s+['"]?([^'"]+)['"]?/i) || clean.match(/files?\s+['"]([^'"]+)['"]/i);
    if (qMatch) {
      query = qMatch[1].trim();
    }
    const params = {};
    if (query) params.query = query;
    if (extension) params.extension = extension;
    return {
      action: 'search_files',
      parameters: params
    };
  }

  // Phase 11 - Analyze File
  if (
    (lower.startsWith('analyze ') || lower.includes('analyze file') || lower.includes('inspect file') || lower.includes('analysis karo')) &&
    (lower.includes('.') || lower.includes('file'))
  ) {
    const fileMatch = clean.match(/([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/i);
    if (fileMatch) {
      return {
        action: 'analyze_file',
        parameters: { path: fileMatch[1].replace(/["']/g, '') }
      };
    }
  }

  // Phase 11 - Summarize File
  if (
    lower.startsWith('summarize ') ||
    lower.includes('summary of') ||
    lower.includes('ki summary do') ||
    lower.includes('ka summary do')
  ) {
    const fileMatch = clean.match(/([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/i);
    if (fileMatch) {
      return {
        action: 'summarize_file',
        parameters: { path: fileMatch[1].replace(/["']/g, '') }
      };
    }
  }

  // Phase 11 - Analyze Folder
  if (
    lower.startsWith('analyze folder') ||
    lower.includes('folder analysis') ||
    lower.includes('analyze directory')
  ) {
    const fMatch = clean.match(/folder\s+([a-zA-Z0-9_\-\/]+)/i);
    return {
      action: 'analyze_folder',
      parameters: { folder_path: fMatch ? fMatch[1].trim() : '' }
    };
  }

  // Phase 11 - List Supported Files
  if (
    lower.includes('supported files') ||
    lower.includes('file types are supported') ||
    lower.includes('supported file types') ||
    lower.includes('supported formats')
  ) {
    return {
      action: 'list_supported_files',
      parameters: {}
    };
  }

  // 10. Web Search (English, Hinglish, Hindi)
  if (
    !lower.includes('file') &&
    !lower.includes('files') &&
    !clean.includes('फ़ाइल') &&
    !clean.includes('फाइल') &&
    (
      lower.startsWith('search ') ||
      lower.includes('search for') ||
      lower.includes('search google for') ||
      lower.includes('google pe') ||
      lower.includes('google par') ||
      lower.includes('search karo') ||
      lower.includes('search kar do') ||
      clean.includes('खोजो') ||
      (lower.includes('search') && (lower.includes('google') || lower.includes('chrome') || lower.includes('web')))
    )
  ) {
    let query = clean
      .replace(/^search\s+(?:google\s+for|on\s+google\s+for|for)?\s+/i, '')
      .replace(/^(?:google\s+pe|google\s+par)\s+/i, '')
      .replace(/\s+(?:search\s+karo|search\s+kar\s+do|search\s+karna)$/i, '')
      .replace(/^खोजो\s+/i, '')
      .replace(/\s+खोजो$/i, '')
      .replace(/^[.\s"']+|[.\s"']+$/g, '');
    if (query) {
      return {
        action: 'search_web',
        parameters: { query }
      };
    }
  }

  // 11. Type Text directly ("Write ...", "Type ...", "Likho ...")
  if (
    lower.startsWith('now write') ||
    lower.startsWith('now type') ||
    lower.startsWith('write ') ||
    lower.startsWith('type ') ||
    lower.startsWith('likho ')
  ) {
    const textMatch = clean.match(/(?:write|type|likho)\s+['"]?([^'"]+)['"]?$/i) || clean.match(/(?:write|type|likho)\s+(.+)$/i);
    let text = textMatch ? textMatch[1].trim() : '';
    text = text.replace(/^['"]|['"]$/g, '');
    if (text) {
      return {
        action: 'type_text',
        parameters: { text }
      };
    }
  }

  // 12. Wait / Pause
  if (lower.startsWith('wait ') || lower.startsWith('pause ') || lower.startsWith('ruko ')) {
    const msMatch = clean.match(/(?:wait|pause|ruko)\s+(\d+)\s*(?:ms|milliseconds)?/i);
    const secMatch = clean.match(/(?:wait|pause|ruko)\s+(\d+)\s*(?:s|sec|seconds)?/i);
    let ms = 1000;
    if (msMatch) {
      ms = parseInt(msMatch[1], 10);
    } else if (secMatch) {
      ms = parseInt(secMatch[1], 10) * 1000;
    }
    return {
      action: 'wait',
      parameters: { milliseconds: ms }
    };
  }

  // Phase 10 - Media Playback Status (English, Hinglish, Hindi)
  if (
    lower.includes('media status') ||
    lower.includes("what's playing") ||
    lower.includes('what is playing') ||
    lower.includes('what song is playing') ||
    lower.includes('what music is playing') ||
    lower.includes('current song') ||
    lower.includes('is anything playing') ||
    lower.includes('gana baj raha hai') ||
    lower.includes('gaana baj raha hai') ||
    lower.includes('kaun sa gana') ||
    lower.includes('kaun sa gaana') ||
    lower.includes('kya play ho raha') ||
    lower.includes('kya baj raha hai') ||
    clean.includes('क्या बज रहा है') ||
    clean.includes('कौन सा गाना') ||
    clean.includes('गीत बज रहा है')
  ) {
    return {
      action: 'media_status',
      parameters: {}
    };
  }

  // Phase 10 - List Windows (English, Hinglish, Hindi)
  if (
    lower.includes('what windows are open') ||
    lower.includes('list windows') ||
    lower.includes('list open windows') ||
    lower.includes('show open windows') ||
    lower.includes('active windows') ||
    lower.includes('open windows') ||
    lower.includes('running windows') ||
    lower.includes('kaun si windows open') ||
    lower.includes('open windows dikhao') ||
    lower.includes('chal rahi windows') ||
    lower.includes('khuli hui windows') ||
    clean.includes('विंडो खुली हैं') ||
    clean.includes('विंडो दिखाओ') ||
    clean.includes('खुली हुई विंडो')
  ) {
    return {
      action: 'list_windows',
      parameters: {}
    };
  }

  // Phase 10 - Window Focus (English, Hinglish, Hindi)
  if (
    (lower.includes('focus') || lower.includes('samne lao') || lower.includes('front') || (lower.includes('show') && lower.includes('window')) || clean.includes('फ़ोकस') || clean.includes('सामने लाओ')) &&
    (lower.includes('chrome') || lower.includes('notepad') || lower.includes('calc') || lower.includes('paint') || lower.includes('code') || lower.includes('explorer') || clean.includes('क्रोम') || clean.includes('नोटपैड'))
  ) {
    let targetApp = 'chrome';
    if (lower.includes('notepad') || clean.includes('नोटपैड')) targetApp = 'notepad';
    else if (lower.includes('calc') || clean.includes('कैलकुलेटर')) targetApp = 'calculator';
    else if (lower.includes('paint') || clean.includes('पेंट')) targetApp = 'paint';
    else if (lower.includes('code')) targetApp = 'code';
    else if (lower.includes('explorer')) targetApp = 'explorer';
    return {
      action: 'focus_window',
      parameters: { app: targetApp }
    };
  }

  // Phase 10 - Window Minimize (English, Hinglish, Hindi)
  if (
    (lower.includes('minimize') || lower.includes('chhota karo') || lower.includes('chhupao') || clean.includes('मिनिमाइज़') || clean.includes('छोटा करो')) &&
    (lower.includes('chrome') || lower.includes('notepad') || lower.includes('calc') || lower.includes('paint') || lower.includes('code') || lower.includes('explorer') || clean.includes('क्रोम') || clean.includes('नोटपैड'))
  ) {
    let targetApp = 'chrome';
    if (lower.includes('notepad') || clean.includes('नोटपैड')) targetApp = 'notepad';
    else if (lower.includes('calc') || clean.includes('कैलकुलेटर')) targetApp = 'calculator';
    else if (lower.includes('paint') || clean.includes('पेंट')) targetApp = 'paint';
    else if (lower.includes('code')) targetApp = 'code';
    else if (lower.includes('explorer')) targetApp = 'explorer';
    return {
      action: 'minimize_window',
      parameters: { app: targetApp }
    };
  }

  // Phase 10 - Window Maximize (English, Hinglish, Hindi)
  if (
    (lower.includes('maximize') || lower.includes('bada karo') || clean.includes('मैक्सिमाइज़') || clean.includes('बड़ा करो')) &&
    (lower.includes('chrome') || lower.includes('notepad') || lower.includes('calc') || lower.includes('paint') || lower.includes('code') || lower.includes('explorer') || clean.includes('क्रोम') || clean.includes('नोटपैड'))
  ) {
    let targetApp = 'chrome';
    if (lower.includes('notepad') || clean.includes('नोटपैड')) targetApp = 'notepad';
    else if (lower.includes('calc') || clean.includes('कैलकुलेटर')) targetApp = 'calculator';
    else if (lower.includes('paint') || clean.includes('पेंट')) targetApp = 'paint';
    else if (lower.includes('code')) targetApp = 'code';
    else if (lower.includes('explorer')) targetApp = 'explorer';
    return {
      action: 'maximize_window',
      parameters: { app: targetApp }
    };
  }

  // Phase 10 - Window Restore (English, Hinglish, Hindi)
  if (
    (lower.includes('restore') || lower.includes('wapas lao') || clean.includes('रीस्टोर') || clean.includes('वापस लाओ')) &&
    (lower.includes('chrome') || lower.includes('notepad') || lower.includes('calc') || lower.includes('paint') || lower.includes('code') || lower.includes('explorer') || clean.includes('क्रोम') || clean.includes('नोटपैड'))
  ) {
    let targetApp = 'chrome';
    if (lower.includes('notepad') || clean.includes('नोटपैड')) targetApp = 'notepad';
    else if (lower.includes('calc') || clean.includes('कैलकुलेटर')) targetApp = 'calculator';
    else if (lower.includes('paint') || clean.includes('पेंट')) targetApp = 'paint';
    else if (lower.includes('code')) targetApp = 'code';
    else if (lower.includes('explorer')) targetApp = 'explorer';
    return {
      action: 'restore_window',
      parameters: { app: targetApp }
    };
  }

  // 13. System Monitoring (English, Hinglish, Hindi)
  if (
    lower.includes('cpu') ||
    lower.includes('processor') ||
    lower.includes('ram') ||
    lower.includes('memory') ||
    lower.includes('disk') ||
    lower.includes('storage') ||
    lower.includes('battery') ||
    lower.includes('uptime') ||
    lower.includes('performance') ||
    lower.includes('performing') ||
    lower.includes('kitna use ho raha hai') ||
    lower.includes('kitna chal raha hai') ||
    lower.includes('status') ||
    lower.includes('telemetry') ||
    lower.includes('laptop kaisa chal raha') ||
    clean.includes('स्थिति बताओ') ||
    clean.includes('उपयोग')
  ) {
    return {
      action: 'system_status',
      parameters: {}
    };
  }

  // 14. Workspace Folder Opening (English, Hinglish, Hindi)
  if (
    (lower.includes('workspace') && (lower.includes('open') || lower.includes('kholo') || lower.includes('khol'))) ||
    clean.includes('कार्यस्थान खोलो') ||
    clean.includes('कार्यस्थान')
  ) {
    return {
      action: 'open_folder',
      parameters: { path: '' }
    };
  }

  // 15. Workspace List / Folder List (English, Hinglish, Hindi)
  if (
    lower.includes("what's inside") ||
    lower.includes("what is inside") ||
    lower.includes("show what's inside") ||
    lower.includes("list workspace") ||
    lower.includes("workspace mein kya hai") ||
    lower.includes("workspace me kya hai") ||
    lower.includes("dekho kya hai") ||
    clean.includes('कार्यस्थान में क्या है')
  ) {
    let targetPath = '';
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const msg = conversationHistory[i];
        const content = (msg.content || '').toLowerCase();
        if (content.includes('projects')) {
          targetPath = 'Projects';
          break;
        }
      }
    }
    return {
      action: 'list_folder',
      parameters: { path: targetPath }
    };
  }

  // 16. Create Folder (English, Hinglish, Hindi)
  if (
    (lower.includes('create') && lower.includes('folder')) ||
    (lower.includes('folder') && (lower.includes('banao') || lower.includes('banana'))) ||
    clean.includes('फ़ोल्डर बनाओ')
  ) {
    const fMatch =
      clean.match(/folder\s+(?:called|named)\s+([a-zA-Z0-9_\-\/]+)/i) ||
      clean.match(/(?:called|named)\s+([a-zA-Z0-9_\-\/]+)/i) ||
      clean.match(/folder\s+([a-zA-Z0-9_\-\/]+)/i) ||
      clean.match(/([a-zA-Z0-9_\-\/]+)\s+(?:naam\s+ka\s+folder|folder\s+banao)/i);
    let fName = fMatch ? fMatch[1].trim() : 'Projects';
    if (fName.toLowerCase() === 'projects') fName = 'Projects';
    return {
      action: 'create_folder',
      parameters: { name: fName }
    };
  }

  // 17. Create Text File
  if (
    (lower.includes('create') || lower.includes('make') || lower.includes('banao')) &&
    (lower.includes('.txt') || lower.includes('.md') || lower.includes('.csv') || lower.includes('.json'))
  ) {
    const fileMatch = clean.match(/([a-zA-Z0-9_\-\.\/]+\.(?:txt|md|csv|json))/i);
    if (fileMatch) {
      let content = '';
      const withContentMatch = clean.match(/with\s+(?:content|text)\s+['"]?([^'"]+)['"]?/i);
      if (withContentMatch) content = withContentMatch[1];
      return {
        action: 'create_text_file',
        parameters: { path: fileMatch[1], content }
      };
    }
  }

  // 18. File Info
  if (
    lower.includes('information about') ||
    lower.includes('info about') ||
    lower.includes('file info') ||
    (lower.includes('tell me about') && (lower.includes('.md') || lower.includes('.txt') || lower.includes('.json')))
  ) {
    const fileMatch = clean.match(/([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/);
    if (fileMatch) {
      return {
        action: 'get_file_info',
        parameters: { path: fileMatch[1].replace(/["']/g, '') }
      };
    }
  }

  // 19. Open File
  if (
    (lower.includes('open') || lower.includes('kholo')) &&
    (lower.includes('.md') || lower.includes('.txt') || lower.includes('.json') || lower.includes('.csv') || lower.includes('.py'))
  ) {
    const fileMatch = clean.match(/([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/i);
    if (fileMatch) {
      return {
        action: 'open_file',
        parameters: { path: fileMatch[1].replace(/["']/g, '') }
      };
    }
  }

  // 20. Open App (English, Hinglish, Hindi)
  if (
    lower.includes('open') ||
    lower.includes('launch') ||
    lower.includes('start') ||
    lower.includes('kholo') ||
    lower.includes('khol') ||
    clean.includes('खोलो')
  ) {
    if (lower.includes('notepad') || clean.includes('नोटपैड')) {
      return { action: 'open_app', parameters: { app: 'notepad' } };
    }
    if (lower.includes('chrome') || clean.includes('क्रोम')) {
      return { action: 'open_app', parameters: { app: 'chrome' } };
    }
    if (lower.includes('code') || lower.includes('vs code') || lower.includes('vscode')) {
      return { action: 'open_app', parameters: { app: 'code' } };
    }
    if (lower.includes('calculator') || lower.includes('calc') || clean.includes('कैलकुलेटर')) {
      return { action: 'open_app', parameters: { app: 'calculator' } };
    }
    if (lower.includes('paint') || clean.includes('पेंट')) {
      return { action: 'open_app', parameters: { app: 'paint' } };
    }
  }

  // 21. Open URL (GitHub, Google, YouTube, HTTPS)
  if (
    (lower.includes('open') || lower.includes('kholo')) &&
    (lower.includes('http://') ||
      lower.includes('https://') ||
      lower.includes('website') ||
      lower.includes('github') ||
      lower.includes('google') ||
      lower.includes('youtube') ||
      lower.includes('url'))
  ) {
    const urlMatch = clean.match(/(https?:\/\/[^\s]+)/i);
    let targetUrl = urlMatch ? urlMatch[0] : null;

    if (!targetUrl && lower.includes('github')) targetUrl = 'https://github.com';
    else if (!targetUrl && lower.includes('google')) targetUrl = 'https://google.com';
    else if (!targetUrl && lower.includes('youtube')) targetUrl = 'https://youtube.com';

    if (targetUrl) {
      return {
        action: 'open_url',
        parameters: { url: targetUrl }
      };
    }
  }

  // 22. Referential Repetition ("Again", "Dobara", "Phir se")
  if (
    lower === 'tell me again' ||
    lower === 'tell me again.' ||
    lower === 'check again' ||
    lower === 'run it again' ||
    lower === 'do it again' ||
    lower === 'phir se karo' ||
    lower === 'dobara karo' ||
    lower.includes('current system information')
  ) {
    let lastAction = null;
    let lastParams = {};

    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const msg = conversationHistory[i];
        if (msg.action && msg.action !== 'unsupported') {
          lastAction = msg.action;
          break;
        }
        const t = (msg.content || '').toLowerCase();
        if (t.includes('status') || t.includes('cpu') || t.includes('laptop')) {
          lastAction = 'system_status';
          break;
        } else if (t.includes('github') || t.includes('http')) {
          lastAction = 'open_url';
          lastParams = { url: 'https://github.com' };
          break;
        } else if (t.includes('notepad')) {
          lastAction = 'open_app';
          lastParams = { app: 'notepad' };
          break;
        }
      }
    }

    if (!lastAction) {
      return {
        action: 'unsupported',
        parameters: {},
        message: "There is no previous action in this session to repeat."
      };
    }

    return {
      action: lastAction,
      parameters: lastParams
    };
  }

  return {
    action: 'unsupported',
    parameters: {},
    message: "I can't perform that action yet."
  };
}

/**
 * Main AI interpreter entrypoint with Conversation Context & Language Layer support
 * 
 * @param {string} userText Natural language text prompt
 * @param {Array<object>} [conversationHistory=[]] Recent conversation messages
 * @param {'auto'|'en'|'hinglish'|'hi'} [languagePreference='auto'] User preferred language
 * @returns {Promise<object>} Result containing parsed and validated command
 */
async function interpretCommand(userText, conversationHistory = [], languagePreference = 'auto') {
  if (!userText || typeof userText !== 'string' || !userText.trim()) {
    return {
      success: false,
      userText: '',
      language: 'en',
      interpretedCommand: { action: 'unsupported', parameters: {} },
      message: "Please provide a command instruction."
    };
  }

  const cleanText = userText.trim();
  const detectedLang = detectLanguage(cleanText, languagePreference);

  // 1. Check if user is issuing a language switch command
  const switchCheck = checkLanguageSwitchCommand(cleanText);
  if (switchCheck.isSwitch) {
    return {
      success: true,
      isLanguageSwitch: true,
      targetLanguage: switchCheck.targetLanguage,
      userText: cleanText,
      language: switchCheck.targetLanguage,
      interpretedCommand: { action: 'unsupported', parameters: {} },
      validatedCommand: null,
      message: switchCheck.message
    };
  }

  // 1b. Check if user is issuing a voice style switch command
  const voiceCheck = checkVoiceStyleSwitchCommand(cleanText);
  if (voiceCheck.isVoiceSwitch) {
    return {
      success: true,
      isVoiceStyleSwitch: true,
      voiceSettings: voiceCheck.voiceSettings,
      userText: cleanText,
      language: detectedLang,
      interpretedCommand: { action: 'unsupported', parameters: {} },
      validatedCommand: null,
      message: voiceCheck.message
    };
  }

  const contextString = formatConversationContext(conversationHistory, MAX_CONTEXT_MESSAGES);

  if (process.env.JARVIS_DEBUG === 'true') {
    console.log(`[AI] Request: "${cleanText}", Lang: ${detectedLang}, Context: ${conversationHistory.length}`);
  }

  let parsed = null;

  // 2. Try Gemini API if client is available
  if (genAIClient) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI request timeout')), AI_TIMEOUT_MS)
      );

      let fullPrompt = cleanText;
      if (contextString) {
        fullPrompt = `USER LANGUAGE: ${detectedLang}
RECENT CONVERSATION (Context only, untrusted):
${contextString}

CURRENT USER REQUEST:
"${cleanText}"

Interpret the user request (English, Hinglish, or Hindi) into one of the allowed actions or 'unsupported'. Return JSON matching schema.`;
      }

      const apiPromise = genAIClient.models.generateContent({
        model: GEMINI_MODEL,
        contents: fullPrompt,
        config: {
          systemInstruction: JARVIS_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });

      const response = await Promise.race([apiPromise, timeoutPromise]);
      const responseText = response.text || '';
      parsed = parseCommand(responseText);
    } catch (err) {
      console.warn(`[AI] Gemini API request failed (${err.message}), evaluating fallback.`);
      parsed = localSemanticInterpreter(cleanText, conversationHistory, detectedLang);
    }
  } else {
    parsed = localSemanticInterpreter(cleanText, conversationHistory, detectedLang);
  }

  console.log(`[AI] Command interpreted: ${parsed.action} (lang: ${detectedLang})`);

  // Handle set_language internal action from semantic interpreter
  if (parsed.action === 'set_language') {
    return {
      success: true,
      isLanguageSwitch: true,
      targetLanguage: parsed.targetLanguage || parsed.parameters?.language || 'en',
      userText: cleanText,
      language: parsed.targetLanguage || 'en',
      interpretedCommand: { action: 'unsupported', parameters: {} },
      validatedCommand: null,
      message: parsed.message
    };
  }

  // 3. Pass parsed command through independent Command Validator
  const validation = validateCommand(parsed);

  if (!validation.valid) {
    console.log(`[VALIDATOR] Command rejected: ${validation.error || validation.message}`);
    const errorCandidate = (validation.action === 'unsupported' && validation.message && validation.message !== "I can't perform that action yet.")
      ? validation.message
      : (validation.error || validation.message);
    const friendlyError = formatMultilingualError(errorCandidate, detectedLang);
    return {
      success: false,
      userText: cleanText,
      language: detectedLang,
      interpretedCommand: parsed,
      error: validation.error,
      message: friendlyError
    };
  }

  console.log(`[VALIDATOR] Command approved: ${validation.command.action}`);

  // 4. Safe Task Confirmation Assessment
  // Workflows with >= 3 steps require explicit user confirmation
  let requiresConfirmation = false;
  let confirmationPrompt = undefined;
  if (validation.command.action === 'task') {
    const steps = Array.isArray(validation.command.parameters?.steps) ? validation.command.parameters.steps : [];
    if (steps.length >= 3) {
      requiresConfirmation = true;
      confirmationPrompt = formatConfirmationPrompt(steps.length, detectedLang);
    }
  }

  return {
    success: true,
    userText: cleanText,
    language: detectedLang,
    interpretedCommand: parsed,
    validatedCommand: validation.command,
    requiresConfirmation,
    confirmationPrompt
  };
}

module.exports = {
  interpretCommand,
  formatConversationContext,
  localSemanticInterpreter,
  detectLanguage,
  checkLanguageSwitchCommand,
  checkVoiceStyleSwitchCommand,
  formatMultilingualResponse,
  formatMultilingualError,
  formatConfirmationPrompt,
  GEMINI_MODEL,
  MAX_CONTEXT_MESSAGES
};
