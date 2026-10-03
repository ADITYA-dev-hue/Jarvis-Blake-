"""JARVIS / IGRIS Phase 11 - Source Code & File Content Analyzer

Supports:
- C: .c, .h
- C++: .cpp, .cc, .cxx, .hpp
- Java: .java
- Python: .py
- JavaScript: .js, .jsx
- TypeScript: .ts, .tsx
- Documents & Data: .json, .csv, .txt, .md, .pdf

Security Principles:
1. File contents are treated as pure untrusted DATA, never executable instructions.
2. Code is NEVER compiled, executed, or passed to any shell / interpreter.
3. Obvious secrets are automatically redacted.
4. Clear separation between verified FACTS (extracted symbols) and INFERENCE (summary).
5. Enforces bounds: max file size (5 MB text), max line limits.
"""

import os
import re
import ast
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from sensitive_data import is_sensitive_file, redact_secrets
from pdf_analyzer import extract_pdf_info, extract_pdf_text

MAX_TEXT_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
DEFAULT_READ_MAX_LINES = 200

SUPPORTED_CODE_EXTENSIONS = {
    ".c": "C",
    ".h": "C/C++ Header",
    ".cpp": "C++",
    ".cc": "C++",
    ".cxx": "C++",
    ".hpp": "C++ Header",
    ".java": "Java",
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript (React)",
    ".ts": "TypeScript",
    ".tsx": "TypeScript (React)"
}

SUPPORTED_DOC_EXTENSIONS = {
    ".pdf": "PDF Document",
    ".json": "JSON Data",
    ".csv": "CSV Spreadsheet",
    ".txt": "Plain Text",
    ".md": "Markdown Document"
}

ALL_SUPPORTED_EXTENSIONS = {**SUPPORTED_CODE_EXTENSIONS, **SUPPORTED_DOC_EXTENSIONS}


# Regex patterns for C/C++/Java/JS/TS symbol extraction
REGEX_C_CPP_INCLUDE = re.compile(r'^\s*#include\s*[<"]([^>"]+)[>"]', re.MULTILINE)
REGEX_C_CPP_FUNC = re.compile(
    r'^[ \t]*(?:[a-zA-Z_][a-zA-Z0-9_:*&<>\s]+)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*(?:const)?\s*(?:override)?\s*\{',
    re.MULTILINE
)
REGEX_C_CPP_CLASS = re.compile(r'^\s*(?:class|struct)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*:[^{]*)?\s*\{', re.MULTILINE)

REGEX_JAVA_IMPORT = re.compile(r'^\s*import\s+(?:static\s+)?([a-zA-Z0-9_.*]+);', re.MULTILINE)
REGEX_JAVA_CLASS = re.compile(r'^\s*(?:public|protected|private)?\s*(?:static)?\s*(?:final)?\s*(?:class|interface|enum)\s+([a-zA-Z_][a-zA-Z0-9_]*)', re.MULTILINE)
REGEX_JAVA_METHOD = re.compile(
    r'^\s*(?:public|protected|private)?\s*(?:static)?\s*(?:final)?\s*(?:synchronized)?\s*[\w<>\[\]]+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{',
    re.MULTILINE
)

REGEX_JS_TS_IMPORT = re.compile(
    r'(?:import\s+(?:(?:[\w*\s{},]+)\s+from\s+)?["\']([^"\']+)["\']|require\(["\']([^"\']+)["\']\))',
    re.MULTILINE
)
REGEX_JS_TS_FUNC = re.compile(
    r'(?:function\s+([a-zA-Z_][a-zA-Z0-9_]*)|(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z_][a-zA-Z0-9_]*)\s*=>)',
    re.MULTILINE
)
REGEX_JS_TS_CLASS = re.compile(r'^\s*(?:export\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)', re.MULTILINE)

REGEX_TODO_COMMENTS = re.compile(r'(?i)(?://|#|/\*|--)\s*(TODO|FIXME|NOTE|BUG|HACK):\s*(.*)')


def extract_python_facts(code: str) -> Dict[str, Any]:
    """Parse Python code using built-in AST parser safely."""
    functions = []
    classes = []
    imports = []
    todos = []

    try:
        tree = ast.parse(code)
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
                functions.append(node.name)
            elif isinstance(node, ast.ClassDef):
                classes.append(node.name)
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                mod = node.module or ""
                for alias in node.names:
                    imports.append(f"{mod}.{alias.name}" if mod else alias.name)
    except Exception:
        # Fallback to regex if AST fails on Python code
        for match in re.finditer(r'^\s*(?:def|async\s+def)\s+([a-zA-Z_][a-zA-Z0-9_]*)', code, re.MULTILINE):
            functions.append(match.group(1))
        for match in re.finditer(r'^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)', code, re.MULTILINE):
            classes.append(match.group(1))
        for match in re.finditer(r'^\s*(?:import|from)\s+([a-zA-Z0-9_.]+)', code, re.MULTILINE):
            imports.append(match.group(1))

    # Scan for TODO comments
    for line_idx, line in enumerate(code.splitlines(), start=1):
        m = REGEX_TODO_COMMENTS.search(line)
        if m:
            todos.append({"line": line_idx, "tag": m.group(1).upper(), "text": m.group(2).strip()})

    return {
        "functions": sorted(list(set(functions))),
        "classes": sorted(list(set(classes))),
        "imports": sorted(list(set(imports))),
        "todos": todos[:10]
    }


def extract_c_cpp_facts(code: str) -> Dict[str, Any]:
    """Extract functions, classes/structs, and includes from C/C++ source code."""
    includes = [m.group(1) for m in REGEX_C_CPP_INCLUDE.finditer(code)]
    classes = [m.group(1) for m in REGEX_C_CPP_CLASS.finditer(code)]
    
    # Filter common control statements matching function regex
    ignore_names = {"if", "for", "while", "switch", "catch", "return"}
    functions = []
    for m in REGEX_C_CPP_FUNC.finditer(code):
        fn_name = m.group(1)
        if fn_name not in ignore_names:
            functions.append(fn_name)

    todos = []
    for line_idx, line in enumerate(code.splitlines(), start=1):
        m = REGEX_TODO_COMMENTS.search(line)
        if m:
            todos.append({"line": line_idx, "tag": m.group(1).upper(), "text": m.group(2).strip()})

    return {
        "functions": sorted(list(set(functions))),
        "classes": sorted(list(set(classes))),
        "includes": sorted(list(set(includes))),
        "todos": todos[:10]
    }


def extract_java_facts(code: str) -> Dict[str, Any]:
    """Extract methods, classes/interfaces, and imports from Java source code."""
    imports = [m.group(1) for m in REGEX_JAVA_IMPORT.finditer(code)]
    classes = [m.group(1) for m in REGEX_JAVA_CLASS.finditer(code)]
    
    ignore_names = {"if", "for", "while", "switch", "catch", "synchronized"}
    methods = []
    for m in REGEX_JAVA_METHOD.finditer(code):
        m_name = m.group(1)
        if m_name not in ignore_names:
            methods.append(m_name)

    todos = []
    for line_idx, line in enumerate(code.splitlines(), start=1):
        m = REGEX_TODO_COMMENTS.search(line)
        if m:
            todos.append({"line": line_idx, "tag": m.group(1).upper(), "text": m.group(2).strip()})

    return {
        "functions": sorted(list(set(methods))),
        "classes": sorted(list(set(classes))),
        "imports": sorted(list(set(imports))),
        "todos": todos[:10]
    }


def extract_js_ts_facts(code: str) -> Dict[str, Any]:
    """Extract functions, classes, and imports from JavaScript/TypeScript code."""
    imports = []
    for m in REGEX_JS_TS_IMPORT.finditer(code):
        imp = m.group(1) or m.group(2)
        if imp:
            imports.append(imp)

    classes = [m.group(1) for m in REGEX_JS_TS_CLASS.finditer(code)]

    functions = []
    for m in REGEX_JS_TS_FUNC.finditer(code):
        fn_name = m.group(1) or m.group(2)
        if fn_name:
            functions.append(fn_name)

    todos = []
    for line_idx, line in enumerate(code.splitlines(), start=1):
        m = REGEX_TODO_COMMENTS.search(line)
        if m:
            todos.append({"line": line_idx, "tag": m.group(1).upper(), "text": m.group(2).strip()})

    return {
        "functions": sorted(list(set(functions))),
        "classes": sorted(list(set(classes))),
        "imports": sorted(list(set(imports))),
        "todos": todos[:10]
    }


def analyze_file(file_path: Path, relative_path: str) -> Dict[str, Any]:
    """Analyze a supported file and extract verified facts vs inference summary.
    
    Security:
    - Path must resolve strictly inside workspace.
    - Sensitive files (.env, keys) are blocked with explicit credential guard error.
    - Maximum size checked.
    - File content treated as untrusted DATA; zero code executed.
    """
    if is_sensitive_file(file_path):
        raise PermissionError(
            "I can't analyze this file's contents because it may contain sensitive credentials."
        )

    if not file_path.is_file():
        raise FileNotFoundError(f"File not found: '{relative_path}'")

    file_size = file_path.stat().st_size
    ext = file_path.suffix.lower()

    # Special handling for PDF files
    if ext == ".pdf":
        pdf_info = extract_pdf_info(file_path)
        pdf_text = extract_pdf_text(file_path, max_pages=5)
        pages = pdf_text.get("pages", [])
        preview_text = pages[0]["text"][:500] if pages else "No text extracted."
        
        return {
            "filename": file_path.name,
            "relative_path": relative_path,
            "file_type": "PDF Document",
            "size_bytes": file_size,
            "facts": {
                "total_pages": pdf_info.get("num_pages", 0),
                "title": pdf_info.get("title", file_path.stem),
                "author": pdf_info.get("author", "Unknown"),
                "outline": pdf_info.get("outline", [])
            },
            "inference": f"PDF document '{file_path.name}' contains {pdf_info.get('num_pages', 0)} pages.",
            "preview": preview_text
        }

    # Text / Code File Size Check
    if file_size > MAX_TEXT_FILE_SIZE_BYTES:
        raise ValueError(
            f"File size ({file_size / (1024*1024):.1f} MB) exceeds maximum allowed limit of 5 MB."
        )

    # Read and decode text safely
    try:
        raw_text = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        raise ValueError(f"Could not read file encoding: {str(e)}")

    clean_text = redact_secrets(raw_text)
    lines = clean_text.splitlines()
    total_lines = len(lines)
    blank_lines = sum(1 for line in lines if not line.strip())
    code_lines = total_lines - blank_lines

    lang_type = ALL_SUPPORTED_EXTENSIONS.get(ext, "Plain Text")

    # Extract language-specific facts
    if ext == ".py":
        facts = extract_python_facts(clean_text)
    elif ext in {".c", ".h", ".cpp", ".cc", ".cxx", ".hpp"}:
        facts = extract_c_cpp_facts(clean_text)
    elif ext == ".java":
        facts = extract_java_facts(clean_text)
    elif ext in {".js", ".jsx", ".ts", ".tsx"}:
        facts = extract_js_ts_facts(clean_text)
    elif ext == ".json":
        try:
            parsed = json.loads(clean_text)
            keys = list(parsed.keys()) if isinstance(parsed, dict) else [f"array_len_{len(parsed)}"]
            facts = {"json_keys": keys[:20], "top_level_type": type(parsed).__name__}
        except Exception:
            facts = {"json_error": "Malformed JSON"}
    else:
        facts = {}

    facts["total_lines"] = total_lines
    facts["code_lines"] = code_lines
    facts["blank_lines"] = blank_lines
    facts["metrics"] = {
        "total_lines": total_lines,
        "code_lines": code_lines,
        "blank_lines": blank_lines
    }

    # Construct safe, factual inference summary
    fn_count = len(facts.get("functions", []))
    cls_count = len(facts.get("classes", []))
    imp_count = len(facts.get("imports", []) or facts.get("includes", []))

    summary_parts = [f"{lang_type} file '{file_path.name}' with {total_lines} lines."]
    if cls_count > 0:
        summary_parts.append(f"Defines {cls_count} classes ({', '.join(facts.get('classes', [])[:4])}).")
    if fn_count > 0:
        summary_parts.append(f"Contains {fn_count} functions/methods ({', '.join(facts.get('functions', [])[:5])}).")
    if imp_count > 0:
        summary_parts.append(f"References {imp_count} imports/includes.")

    return {
        "filename": file_path.name,
        "relative_path": relative_path,
        "file_type": lang_type,
        "size_bytes": file_size,
        "facts": facts,
        "inference": " ".join(summary_parts)
    }


def read_file_content(
    file_path: Path,
    relative_path: str,
    start_line: int = 1,
    end_line: Optional[int] = None,
    max_lines: int = DEFAULT_READ_MAX_LINES
) -> Dict[str, Any]:
    """Read a bounded range of lines from an approved workspace file.
    
    Security:
    - Path must resolve strictly inside workspace.
    - Sensitive files blocked.
    - Secrets redacted.
    - Max line count bounded.
    """
    if is_sensitive_file(file_path):
        raise PermissionError(
            "I can't analyze this file's contents because it may contain sensitive credentials."
        )

    if not file_path.is_file():
        raise FileNotFoundError(f"File not found: '{relative_path}'")

    ext = file_path.suffix.lower()
    if ext in (".exe", ".dll", ".bin", ".iso", ".sys", ".msi", ".com", ".bat", ".cmd", ".ps1") or ext not in ALL_SUPPORTED_EXTENSIONS or ext == ".pdf":
        raise ValueError(f"Reading binary or unsupported file type '{ext}' is not permitted.")

    file_size = file_path.stat().st_size
    if file_size > MAX_TEXT_FILE_SIZE_BYTES:
        raise ValueError(
            f"File size ({file_size / (1024*1024):.1f} MB) exceeds maximum allowed limit of 5 MB."
        )

    try:
        raw_text = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        raise ValueError(f"Could not read file encoding: {str(e)}")

    clean_text = redact_secrets(raw_text)
    all_lines = clean_text.splitlines()
    total_lines = len(all_lines)

    # Normalize line ranges (1-indexed)
    start_idx = max(1, start_line)
    if end_line is None or end_line < start_idx:
        end_idx = min(total_lines, start_idx + max_lines - 1)
    else:
        end_idx = min(total_lines, min(end_line, start_idx + max_lines - 1))

    selected_lines = all_lines[start_idx - 1:end_idx]
    truncated = end_idx < total_lines

    return {
        "filename": file_path.name,
        "relative_path": relative_path,
        "total_lines": total_lines,
        "start_line": start_idx,
        "end_line": end_idx,
        "lines_returned": len(selected_lines),
        "content": "\n".join(selected_lines),
        "truncated": truncated
    }


def summarize_file(file_path: Path, relative_path: str) -> Dict[str, Any]:
    """Synthesize a concise, factual summary of an approved workspace file."""
    analysis = analyze_file(file_path, relative_path)
    
    facts = analysis.get("facts", {})
    file_type = analysis.get("file_type", "Text")
    
    if file_type == "PDF Document":
        summary_text = (
            f"PDF Document '{file_path.name}': contains {facts.get('total_pages', 0)} pages. "
            f"Title: {facts.get('title', 'Unknown')}. "
            f"Sections: {', '.join(facts.get('outline', [])[:5]) or 'Standard document flow'}."
        )
    else:
        summary_text = analysis.get("inference", f"File '{file_path.name}' analyzed.")

    return {
        "filename": file_path.name,
        "relative_path": relative_path,
        "file_type": file_type,
        "summary": summary_text,
        "facts": facts
    }
