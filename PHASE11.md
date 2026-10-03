# JARVIS / IGRIS Phase 11: Smart File & Workspace Assistant

## 1. Overview & Architectural Scope
Phase 11 extends the JARVIS / IGRIS autonomous assistant framework with a **Smart File & Workspace Assistant**, enabling deep understanding, semantic search, AST-based symbol extraction, document parsing, and codebase metrics across the authorized workspace (`D:\JARVIS\workspace`) while guaranteeing strict read-only execution, sandbox containment, and prompt injection defense.

```
       📱 Phone / Web UI (English / Hinglish / Hindi)
         - File Explorer & Workspace Browser
         - Code Analysis Modal (AST Symbols, Metrics, Fact vs Inference)
         - Codebase Insights Dashboard (LOC, Languages, TODOs)
         - Bounded Line Reader with Secret Shield
                          ↕ HTTPS / WSS
    ╭────────────────────────────────────────────────────────╮
    │                 Node.js Gateway Server                 │
    │  ┌──────────────────────┐   ┌───────────────────────┐  │
    │  │ Language Engine      │   │ Command Validator     │  │
    │  │ (en / hinglish / hi) │   │ (Path & Action Guard) │  │
    │  └──────────────────────┘   └───────────────────────┘  │
    │  ┌──────────────────────┐   ┌───────────────────────┐  │
    │  │ Gemini 2.5 Flash /   │   │ Multi-Step Workflow   │  │
    │  │ Semantic Interpreter │   │ Engine (Phase 8 & 9)  │  │
    │  └──────────────────────┘   └───────────────────────┘  │
    ╰────────────────────────────────────────────────────────╯
                          ↕ Socket.IO (Authenticated)
               🐍 Python Laptop Agent (LAPTOP-01)
         - Workspace Sandbox Guard (D:\JARVIS\workspace)
         - Code Analyzer (Python AST + C/C++/Java/TS Regex)
         - Safe PDF Analyzer (pypdf with Strict Resource Bounds)
         - Sensitive File & Credential Redaction Engine
         - Command Registry & Audit Logger
                          ↕ Read-Only Safe APIs
               📁 Authorized Workspace Directory
```

---

## 2. Core Security & Privacy Invariants

1. **Workspace Sandbox Isolation**:
   - Every file operation is strictly contained within `D:\JARVIS\workspace`.
   - Path traversal attempts (`..`, absolute paths like `C:\Windows`, relative traversal `../../server.js`) and symlink escapes are rigorously rejected with a `PermissionError`.

2. **Strict Read-Only Enforcement**:
   - Zero file creation, modification, deletion, or renaming capabilities in Phase 11 commands.
   - All file handles are opened with read-only modes (`"r"`, `"rb"`).
   - Zero execution: **No code execution, no compiler calls (`gcc`, `python`, `node`), no shell interpreters**.

3. **Prompt Injection Defense**:
   - Content extracted from workspace files is treated as **untrusted data**, never as system instructions.
   - The AI prompt template encloses file content within strict data wrappers (`<UNTRUSTED_WORKSPACE_CONTENT>...</UNTRUSTED_WORKSPACE_CONTENT>`) with explicit instructions to ignore embedded directives.

4. **Sensitive File & Credential Shield**:
   - Critical configuration and key files are blocked by default: `.env`, `.env.*`, `credentials*`, `secrets*`, `*.pem`, `*.key`, `*.pfx`, `id_rsa*`, `service-account*.json`.
   - Content redaction scanner automatically replaces API keys, tokens, and private secrets with `[REDACTED_SECRET]`.

5. **Resource Bounds & DoS Prevention**:
   - Maximum text file read size: 20 MB.
   - Maximum line window: 200 lines per read request.
   - Maximum search results: Bounded (default 100, max 200).
   - PDF bounds: Maximum 20 MB file size, maximum 50 pages per extraction call.
   - Corrupted or malformed PDFs are handled safely with structured error messages without crashing the agent.

6. **Binary File Rejection**:
   - Executable, library, and raw binary formats (`.exe`, `.dll`, `.bin`, `.iso`, `.so`, `.dylib`) are blocked from reading or text analysis.

---

## 3. New Safe Actions & Command Registry

| Action | Parameters | Description |
|---|---|---|
| `search_files` | `query` (str, opt), `extension` (str, opt), `folder_path` (str, opt), `file_type` (str, opt), `max_results` (int, opt) | Search workspace files by name, extension, category (`code`, `data`, `document`), or subdirectory. |
| `read_file` | `path` (str), `start_line` (int, opt), `max_lines` (int, opt) | Read bounded lines of a text file with automatic credential redaction. |
| `search_file_content` | `query` (str), `file_path` (str, opt), `case_sensitive` (bool, opt), `max_results` (int, opt) | Search for text or regex patterns across workspace files or within a specific file, returning windowed excerpts. |
| `analyze_file` | `path` (str) | Perform AST / structural symbol extraction (functions, classes, structs, imports) and LOC metrics. |
| `summarize_file` | `path` (str) | Generate a structured summary of a code or document file separating verified facts from inference. |
| `analyze_folder` | `folder_path` (str, opt) | Analyze folder hierarchy, file counts, disk usage, extension breakdown, and largest files. |
| `workspace_insights` | `folder_path` (str, opt) | Comprehensive codebase audit: total LOC, code vs comment lines, language breakdown, and pending TODOs. |
| `list_supported_files` | *None* | Return specifications of all supported file extensions and categories. |

---

## 4. Subsystem Implementations

### A. Code Analysis Engine (`laptop-agent/file_analyzer.py`)
- **Python**: Uses native `ast.parse` for 100% accurate extraction of classes, async/sync functions, decorators, and imports.
- **C / C++**: Robust regex parser extracting functions, structs, classes, and `#include` directives.
- **Java**: Robust regex parser extracting class declarations, method signatures, package names, and imports.
- **JavaScript / TypeScript**: AST / regex extractors for ES6 classes, functions, arrow functions, and `export` statements.
- **Code Metrics**: Bounded line calculator determining total lines, code lines, blank lines, and comment lines.
- **Fact vs. Inference Separation**: Output explicitly partitions hard verified code facts (`facts: { functions, classes, imports, metrics }`) from descriptive summaries (`inference: "..."`).

### B. Safe PDF Document Analyzer (`laptop-agent/pdf_analyzer.py`)
- Powered by `pypdf>=6.0.0` with custom defensive wrapper.
- Extracts document metadata (`title`, `author`, `creation_date`), total page counts, and bookmarks/outlines.
- Provides windowed text extraction with page-range limits (`start_page`, `end_page`).
- Performs in-document keyword searches returning 1-indexed page locations and windowed context snippets.

### C. Workspace & Content Search (`laptop-agent/file_search.py` & `workspace_analyzer.py`)
- Non-blocking filesystem recursion using `Path.rglob`.
- Excludes transient directories (`node_modules`, `.git`, `__pycache__`, `venv`, `dist`, `build`).
- Content search reads line-by-line using streaming buffers to avoid memory spikes on larger text files.
- Disk usage metrics return human-formatted sizes (`B`, `KB`, `MB`, `GB`) and raw byte totals.

### D. Server Validator & Gateway (`server/ai/command-validator.js`)
- Enforces strict parameters for all 8 Phase 11 commands.
- Traversal validation: Blocks any path containing `..`, leading slashes, Windows drive letters, or forbidden sensitive file patterns.
- Validates line bounds (`start_line >= 1`, `max_lines <= 200`).

### E. Multilingual AI Assistant Layer (`server/ai/gemini.js` & `server/ai/language-engine.js`)
- Complete natural language comprehension and speech/text responses across **English**, **Hinglish**, and **Hindi**:
  - *"Search files matching 'sample'"* $\rightarrow$ `search_files(query='sample')`
  - *"sample.py read karo"* / *"sample.py पढ़ो"* $\rightarrow$ `read_file(path='sample.py')`
  - *"Python फ़ाइलें खोजो"* $\rightarrow$ `search_files(extension='.py')`
  - *"Give me workspace insights"* / *"Workspace insights dikhao"* $\rightarrow$ `workspace_insights()`
  - *"Analyze sample.py"* / *"sample.py ka analysis karo"* $\rightarrow$ `analyze_file(path='sample.py')`
- Structured response formatters in `language-engine.js` ensure natural, context-rich responses in the user's preferred language.

### F. Mobile UI Integration (`phone-ui`)
- Updated `FilesScreen.tsx` with:
  - **Workspace Insights Bar & Modal**: Quick view of LOC, top languages, and pending TODO counts.
  - **Analyze Action**: Instant structural inspection of classes and methods directly from the file list.
  - **Bounded Line Viewer**: Safe reader with line number gutters and credential masking.
- Clean TypeScript types defined in `phone-ui/src/types/command.ts`.

---

## 5. Verification & Test Results

### Phase 11 Test Suite (`test-phase11.py`)
A dedicated 47-test automated verification suite covers all 7 functional groups:
1. **Safe File Search Tests (1–8)**: Exact match, substring, case-insensitive, extension filter, category filter, subdirectories, empty handling, result limits.
2. **File Reading & Content Search (9–16)**: Full read, bounded lines, line limits, non-existent error, binary rejection, secret redaction, code search, markdown search.
3. **Safe PDF Document Analysis (17–23)**: Page count, range text extraction, metadata, keyword search, 20 MB cap, corrupted PDF handling, outline extraction.
4. **AST & Code Symbol Extraction (24–30)**: C/C++ funcs/structs, Java methods/classes, Python classes/funcs/imports, JS/TS exports, LOC metrics, fact vs inference separation, summary generation.
5. **Workspace & Folder Analysis (31–34)**: Folder breakdown, insights generation, supported files spec, nested subdirectory recursion.
6. **Security & Sandbox Containment (35–40)**: Path traversal rejection, sensitive file blocking, symlink containment, prompt injection defense, read-only enforcement, audit log verification.
7. **Server Validator & Live E2E (41–47)**: Command validator, English AI interpretation, Hinglish AI interpretation, Hindi AI interpretation, workspace insights NLP, Socket.IO E2E execution.

**Result: 47/47 PASSED (100.0%)**

### Full Regression Suite (`run-all-tests.py`)
The complete regression test runner was executed across all phases:
- Phase 2 (Socket.IO Communication): **PASSED**
- Phase 3 (Gemini Command Interpretation): **PASSED**
- Phase 4 (Voice Input & TTS): **PASSED**
- Phase 5 (Conversation Memory): **PASSED**
- Phase 6 (Laptop Control Center): **PASSED**
- Phase 7 (Live Telemetry Monitoring): **PASSED**
- Phase 8 (Multi-Step Task Automation): **PASSED**
- Phase 9 (Intelligent Workflows + Multilingual): **PASSED**
- Phase 9.5 (IGRIS Voice Personality): **PASSED**
- Phase 10 (Window & Desktop Media Control): **PASSED**
- Phase 11 (Smart File & Workspace Assistant): **PASSED**

**Overall Regression Suite: 100% PASSED**
