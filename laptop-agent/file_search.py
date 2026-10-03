"""JARVIS / IGRIS Phase 11 - Safe Workspace File & Content Search

Capabilities:
1. Search files by filename, extension, subfolder, and category with bounded results (max 100).
2. Search inside file contents (source code, text, markdown, PDF) with line numbers & excerpts (max 20).
3. Enforces strict containment inside WORKSPACE_DIR; symlinks escaping workspace are skipped.
4. Automatically blocks sensitive credential files (.env, keys) from content search.
"""

import os
import re
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
from sensitive_data import is_sensitive_file, redact_secrets
from pdf_analyzer import search_pdf_content
from file_analyzer import ALL_SUPPORTED_EXTENSIONS, SUPPORTED_CODE_EXTENSIONS, MAX_TEXT_FILE_SIZE_BYTES

MAX_FILES_RETURNED = 100
MAX_DIRS_TRAVERSED = 500
MAX_CONTENT_EXCERPTS = 20
EXCERPT_CHAR_LIMIT = 160


def format_bytes(size: int) -> str:
    """Format bytes to human-readable string."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.1f} {unit}" if unit != 'B' else f"{size} B"
        size /= 1024.0
    return f"{size:.1f} TB"


def search_files(
    workspace_dir: Path,
    query: str = "",
    extension: str = "",
    folder_path: Optional[Path] = None,
    file_type: str = "",
    max_results: int = MAX_FILES_RETURNED
) -> Dict[str, Any]:
    """Search for files within the authorized workspace.
    
    Args:
        workspace_dir: Absolute canonical Path to WORKSPACE_DIR.
        query: Substring to match against filename (case-insensitive).
        extension: File extension filter, e.g. '.py', '.cpp', '.pdf' (case-insensitive).
        folder_path: Optional canonical subfolder to scope the search within.
        file_type: Optional category filter ('code', 'document', 'pdf', 'text', 'data').
        max_results: Hard limit on files returned (default: 100).
        
    Returns:
        Dict with count, list of file metadata items, and limited flag.
    """
    base_dir = workspace_dir.resolve()
    base_norm = os.path.normcase(str(base_dir))
    search_root = folder_path.resolve() if folder_path else base_dir

    clean_query = (query or "").strip().lower()
    clean_ext = (extension or "").strip().lower()
    if clean_ext and not clean_ext.startswith("."):
        clean_ext = "." + clean_ext

    # Map category shortcuts
    type_ext_filter = set()
    ft_lower = (file_type or "").strip().lower()
    if ft_lower in ("code", "source"):
        type_ext_filter = set(SUPPORTED_CODE_EXTENSIONS.keys())
    elif ft_lower in ("pdf", "document", "doc"):
        type_ext_filter = {".pdf", ".md", ".txt"}
    elif ft_lower in ("data", "config"):
        type_ext_filter = {".json", ".csv"}
    elif ft_lower in ("c", "c++", "cpp"):
        type_ext_filter = {".c", ".h", ".cpp", ".cc", ".cxx", ".hpp"}
    elif ft_lower in ("java",):
        type_ext_filter = {".java"}
    elif ft_lower in ("python", "py"):
        type_ext_filter = {".py"}
    elif ft_lower in ("js", "javascript", "ts", "typescript"):
        type_ext_filter = {".js", ".jsx", ".ts", ".tsx"}

    matched_items = []
    dirs_count = 0
    was_limited = False

    for root, dirs, files in os.walk(str(search_root)):
        dirs_count += 1
        if dirs_count > MAX_DIRS_TRAVERSED:
            was_limited = True
            break

        # Symlink / escape filter for subdirectories
        safe_dirs = []
        for d in dirs:
            dir_full = Path(root) / d
            dir_real = os.path.normcase(os.path.realpath(str(dir_full)))
            if dir_real.startswith(base_norm + os.sep) or dir_real == base_norm:
                safe_dirs.append(d)
        dirs[:] = safe_dirs

        for f in files:
            file_full = Path(root) / f
            file_real = os.path.normcase(os.path.realpath(str(file_full)))

            # Strict containment check
            if not (file_real.startswith(base_norm + os.sep) or file_real == base_norm):
                continue

            # Extension filter
            f_ext = file_full.suffix.lower()
            if clean_ext and f_ext != clean_ext:
                continue
            if type_ext_filter and f_ext not in type_ext_filter:
                continue

            # Query filter (matches filename)
            if clean_query and clean_query not in f.lower():
                continue

            try:
                st = file_full.stat()
                rel = str(file_full.relative_to(base_dir)).replace("\\", "/")
                mod_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(st.st_mtime))
                
                matched_items.append({
                    "name": f,
                    "filename": f,
                    "relative_path": rel,
                    "extension": f_ext,
                    "size": format_bytes(st.st_size),
                    "size_bytes": st.st_size,
                    "modified_time": mod_time,
                    "type": ALL_SUPPORTED_EXTENSIONS.get(f_ext, "File")
                })

                if len(matched_items) >= max_results:
                    was_limited = True
                    break
            except Exception:
                continue

        if len(matched_items) >= max_results:
            break

    message = f"Found {len(matched_items)} matching files."
    if was_limited:
        message += " Search results were limited to protect system performance."

    return {
        "count": len(matched_items),
        "query": clean_query,
        "extension": clean_ext,
        "limited": was_limited,
        "message": message,
        "files": matched_items
    }


def search_file_content(
    workspace_dir: Path,
    query: str,
    target_file: Optional[Path] = None,
    folder_path: Optional[Path] = None,
    extension: str = "",
    max_excerpts: int = MAX_CONTENT_EXCERPTS
) -> Dict[str, Any]:
    """Search for text within one or more supported files in the workspace.
    
    Args:
        workspace_dir: Absolute canonical Path to WORKSPACE_DIR.
        query: Required substring to search for.
        target_file: Optional single file to search inside.
        folder_path: Optional subfolder to search inside.
        extension: Optional extension filter, e.g. '.py' or '.pdf'.
        max_excerpts: Maximum matching excerpts to return (default: 20).
        
    Returns:
        Dict with query, matches_count, list of match items, and limited flag.
    """
    if not query or not query.strip():
        raise ValueError("Missing search 'query' parameter.")

    clean_query = query.strip()
    base_dir = workspace_dir.resolve()
    matches = []
    was_limited = False

    # Case A: Single Target File Content Search
    if target_file:
        if is_sensitive_file(target_file):
            raise PermissionError(
                "I can't analyze this file's contents because it may contain sensitive credentials."
            )

        if not target_file.is_file():
            raise FileNotFoundError(f"File not found: '{target_file.name}'")

        rel_path = str(target_file.relative_to(base_dir)).replace("\\", "/")
        ext = target_file.suffix.lower()

        if ext == ".pdf":
            pdf_matches = search_pdf_content(target_file, clean_query, max_excerpts)
            for m in pdf_matches:
                matches.append({
                    "filename": target_file.name,
                    "relative_path": rel_path,
                    "page": m.get("page", 1),
                    "excerpt": m.get("excerpt", "")
                })
        else:
            # Text file search
            if target_file.stat().st_size > MAX_TEXT_FILE_SIZE_BYTES:
                raise ValueError("File exceeds maximum allowed size of 5 MB for content search.")

            lines = target_file.read_text(encoding="utf-8", errors="replace").splitlines()
            lower_q = clean_query.lower()
            for line_idx, line in enumerate(lines, start=1):
                if lower_q in line.lower():
                    clean_excerpt = redact_secrets(line.strip())
                    if len(clean_excerpt) > EXCERPT_CHAR_LIMIT:
                        clean_excerpt = clean_excerpt[:EXCERPT_CHAR_LIMIT] + "..."
                    matches.append({
                        "filename": target_file.name,
                        "relative_path": rel_path,
                        "line_number": line_idx,
                        "excerpt": clean_excerpt
                    })
                    if len(matches) >= max_excerpts:
                        was_limited = True
                        break

        message = f"Found {len(matches)} matches in '{target_file.name}'."
        if was_limited:
            message += " Search results were limited to protect system performance."

        return {
            "query": clean_query,
            "matches_count": len(matches),
            "total_matches": len(matches),
            "files_searched": 1,
            "limited": was_limited,
            "message": message,
            "matches": matches,
            "excerpts": matches
        }

    # Case B: Multi-file Search across Workspace / Subfolder
    file_search_res = search_files(
        workspace_dir=workspace_dir,
        folder_path=folder_path,
        extension=extension,
        max_results=50
    )

    for item in file_search_res.get("files", []):
        if len(matches) >= max_excerpts:
            was_limited = True
            break

        f_path = base_dir / item["relative_path"]
        if is_sensitive_file(f_path):
            continue

        ext = f_path.suffix.lower()
        if ext not in ALL_SUPPORTED_EXTENSIONS:
            continue

        if ext == ".pdf":
            pdf_matches = search_pdf_content(f_path, clean_query, max_excerpts - len(matches))
            for m in pdf_matches:
                matches.append({
                    "filename": f_path.name,
                    "relative_path": item["relative_path"],
                    "page": m.get("page", 1),
                    "excerpt": m.get("excerpt", "")
                })
        else:
            if f_path.stat().st_size > MAX_TEXT_FILE_SIZE_BYTES:
                continue

            try:
                lines = f_path.read_text(encoding="utf-8", errors="replace").splitlines()
            except Exception:
                continue

            lower_q = clean_query.lower()
            for line_idx, line in enumerate(lines, start=1):
                if lower_q in line.lower():
                    clean_excerpt = redact_secrets(line.strip())
                    if len(clean_excerpt) > EXCERPT_CHAR_LIMIT:
                        clean_excerpt = clean_excerpt[:EXCERPT_CHAR_LIMIT] + "..."
                    matches.append({
                        "filename": f_path.name,
                        "relative_path": item["relative_path"],
                        "line_number": line_idx,
                        "excerpt": clean_excerpt
                    })
                    if len(matches) >= max_excerpts:
                        was_limited = True
                        break

    message = f"Found {len(matches)} matches for '{clean_query}' across workspace."
    if was_limited:
        message += " Search results were limited to protect system performance."

    return {
        "query": clean_query,
        "matches_count": len(matches),
        "total_matches": len(matches),
        "files_searched": len(file_search_res.get("files", [])),
        "limited": was_limited,
        "message": message,
        "matches": matches,
        "excerpts": matches
    }
