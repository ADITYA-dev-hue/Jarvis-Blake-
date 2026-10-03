"""JARVIS / IGRIS Phase 11 - Workspace Structure & Codebase Insights Analyzer

Capabilities:
1. analyze_folder: Folder-level metrics (total files, size, extension breakdown, largest/recent files, subfolders).
2. workspace_insights: Deep codebase analysis (LOC by language: C/C++, Java, Python, JS/TS, PDFs, TODOs, complexity).
3. Enforces strict containment inside WORKSPACE_DIR; skips symlinks escaping the workspace.
4. Strictly protects sensitive credential files (masks/flags without reading content).
5. Accurate, disk-grounded metrics with zero hallucination.
"""

import os
import re
import time
from pathlib import Path
from typing import Dict, Any, List, Optional

from sensitive_data import is_sensitive_file
from pdf_analyzer import extract_pdf_info
from file_analyzer import (
    SUPPORTED_CODE_EXTENSIONS,
    SUPPORTED_DOC_EXTENSIONS,
    ALL_SUPPORTED_EXTENSIONS,
    MAX_TEXT_FILE_SIZE_BYTES,
    extract_python_facts,
    extract_c_cpp_facts,
    extract_java_facts,
    extract_js_ts_facts,
)

MAX_DIRS_TRAVERSED = 500
MAX_INSIGHTS_FILES_SCANNED = 200


def format_bytes(size: int) -> str:
    """Format bytes to human-readable string."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.1f} {unit}" if unit != 'B' else f"{size} B"
        size /= 1024.0
    return f"{size:.1f} TB"


def count_line_metrics(text: str, comment_prefix: str = "#") -> Dict[str, int]:
    """Count total, blank, comment, and code lines for source code text."""
    total = 0
    blank = 0
    comment = 0
    code = 0

    c_style = comment_prefix in ("//", "/*")

    for line in text.splitlines():
        total += 1
        stripped = line.strip()
        if not stripped:
            blank += 1
        elif c_style and (stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*")):
            comment += 1
        elif not c_style and stripped.startswith(comment_prefix):
            comment += 1
        else:
            code += 1

    return {
        "total_lines": total,
        "blank_lines": blank,
        "comment_lines": comment,
        "code_lines": code
    }


def analyze_folder(
    workspace_dir: Path,
    folder_path: Optional[Path] = None,
    max_depth: int = 10
) -> Dict[str, Any]:
    """Generate structural metrics for a specific folder within the workspace.
    
    Args:
        workspace_dir: Canonical Path to WORKSPACE_DIR.
        folder_path: Canonical Path to target subfolder (defaults to workspace_dir).
        max_depth: Maximum directory traversal depth.
        
    Returns:
        Dict with total files, size, extension breakdown, largest/recent files, and subfolders.
    """
    base_dir = workspace_dir.resolve()
    base_norm = os.path.normcase(str(base_dir))
    target_dir = folder_path.resolve() if folder_path else base_dir
    target_norm = os.path.normcase(str(target_dir))

    # Verify containment
    if not (target_norm == base_norm or target_norm.startswith(base_norm + os.sep)):
        raise PermissionError(f"Access denied: Target folder '{folder_path}' is outside the authorized workspace.")

    if not target_dir.is_dir():
        raise FileNotFoundError(f"Folder not found: '{folder_path}'")

    try:
        rel_folder = target_dir.relative_to(base_dir).as_posix()
    except ValueError:
        rel_folder = "."

    total_files = 0
    total_subdirs = 0
    total_size_bytes = 0
    files_by_ext: Dict[str, int] = {}
    files_by_cat = {"code": 0, "documents": 0, "data": 0, "other": 0}
    all_files_list = []
    subfolders_dict: Dict[str, int] = {}
    sensitive_files_count = 0

    dirs_traversed = 0

    # Collect immediate subfolders first
    for item in target_dir.iterdir():
        if item.is_dir():
            real_item = os.path.normcase(os.path.realpath(str(item)))
            if real_item.startswith(base_norm + os.sep) or real_item == base_norm:
                subfolders_dict[item.name] = 0

    for root, dirs, files in os.walk(str(target_dir)):
        dirs_traversed += 1
        if dirs_traversed > MAX_DIRS_TRAVERSED:
            break

        # Symlink / escape filter for subdirectories
        safe_dirs = []
        for d in dirs:
            dir_full = Path(root) / d
            dir_real = os.path.normcase(os.path.realpath(str(dir_full)))
            if dir_real.startswith(base_norm + os.sep) or dir_real == base_norm:
                safe_dirs.append(d)
        dirs[:] = safe_dirs

        total_subdirs += len(dirs)

        for filename in files:
            file_full = Path(root) / filename
            file_real = os.path.normcase(os.path.realpath(str(file_full)))
            if not (file_real.startswith(base_norm + os.sep) or file_real == base_norm):
                continue

            try:
                rel_path = file_full.relative_to(base_dir).as_posix()
            except ValueError:
                rel_path = filename

            # Track immediate subfolder file counts
            try:
                rel_from_target = file_full.relative_to(target_dir).parts
                if len(rel_from_target) > 1 and rel_from_target[0] in subfolders_dict:
                    subfolders_dict[rel_from_target[0]] += 1
            except Exception:
                pass

            total_files += 1

            if is_sensitive_file(file_full):
                sensitive_files_count += 1

            try:
                stat = file_full.stat()
                sz = stat.st_size
                mtime = stat.st_mtime
            except Exception:
                sz = 0
                mtime = 0

            total_size_bytes += sz
            ext = file_full.suffix.lower() or "none"
            files_by_ext[ext] = files_by_ext.get(ext, 0) + 1

            if ext in SUPPORTED_CODE_EXTENSIONS:
                files_by_cat["code"] += 1
            elif ext in (".pdf", ".md", ".txt"):
                files_by_cat["documents"] += 1
            elif ext in (".json", ".csv"):
                files_by_cat["data"] += 1
            else:
                files_by_cat["other"] += 1

            all_files_list.append({
                "name": filename,
                "relative_path": rel_path,
                "size_bytes": sz,
                "size_formatted": format_bytes(sz),
                "mtime": mtime,
                "modified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime)) if mtime else "Unknown"
            })

    # Sort largest & recent
    largest_files = sorted(all_files_list, key=lambda x: x["size_bytes"], reverse=True)[:5]
    for f in largest_files:
        f.pop("mtime", None)

    recent_files = sorted(all_files_list, key=lambda x: x.get("mtime", 0), reverse=True)[:5]
    for f in recent_files:
        f.pop("mtime", None)

    subfolders_list = [
        {"name": name, "file_count": count}
        for name, count in sorted(subfolders_dict.items(), key=lambda x: x[0])
    ]

    return {
        "folder_path": rel_folder if rel_folder else ".",
        "total_files": total_files,
        "total_subdirectories": total_subdirs,
        "total_size_bytes": total_size_bytes,
        "total_size_formatted": format_bytes(total_size_bytes),
        "files_by_extension": files_by_ext,
        "files_by_category": files_by_cat,
        "largest_files": largest_files,
        "recent_files": recent_files,
        "subfolders": subfolders_list,
        "sensitive_files_detected": sensitive_files_count
    }


def workspace_insights(
    workspace_dir: Path,
    folder_path: Optional[Path] = None
) -> Dict[str, Any]:
    """Deep analysis of workspace source code, documents, and complexity metrics.
    
    Args:
        workspace_dir: Canonical Path to WORKSPACE_DIR.
        folder_path: Optional subfolder to scope the insights within.
        
    Returns:
        Structured dictionary of codebase languages, lines of code, complexity, and documents.
    """
    base_dir = workspace_dir.resolve()
    base_norm = os.path.normcase(str(base_dir))
    target_dir = folder_path.resolve() if folder_path else base_dir
    target_norm = os.path.normcase(str(target_dir))

    if not (target_norm == base_norm or target_norm.startswith(base_norm + os.sep)):
        raise PermissionError(f"Access denied: Target folder '{folder_path}' is outside the authorized workspace.")

    if not target_dir.is_dir():
        raise FileNotFoundError(f"Folder not found: '{folder_path}'")

    # Metrics containers
    languages = {
        "c_cpp": {"files": 0, "total_lines": 0, "code_lines": 0, "comment_lines": 0, "blank_lines": 0, "functions": 0, "classes": 0},
        "java": {"files": 0, "total_lines": 0, "code_lines": 0, "comment_lines": 0, "blank_lines": 0, "classes": 0, "methods": 0},
        "python": {"files": 0, "total_lines": 0, "code_lines": 0, "comment_lines": 0, "blank_lines": 0, "functions": 0, "classes": 0},
        "js_ts": {"files": 0, "total_lines": 0, "code_lines": 0, "comment_lines": 0, "blank_lines": 0, "functions": 0, "classes": 0},
        "pdf": {"files": 0, "total_pages": 0, "total_size_bytes": 0},
        "markdown_text": {"files": 0, "total_lines": 0},
        "json_csv": {"files": 0, "total_lines": 0, "total_size_bytes": 0}
    }

    total_files_scanned = 0
    sensitive_files_count = 0
    all_files_meta = []
    complex_files_list = []
    total_todos = 0

    dirs_traversed = 0

    for root, dirs, files in os.walk(str(target_dir)):
        dirs_traversed += 1
        if dirs_traversed > MAX_DIRS_TRAVERSED:
            break

        safe_dirs = []
        for d in dirs:
            dir_full = Path(root) / d
            dir_real = os.path.normcase(os.path.realpath(str(dir_full)))
            if dir_real.startswith(base_norm + os.sep) or dir_real == base_norm:
                safe_dirs.append(d)
        dirs[:] = safe_dirs

        for filename in files:
            file_full = Path(root) / filename
            file_real = os.path.normcase(os.path.realpath(str(file_full)))
            if not (file_real.startswith(base_norm + os.sep) or file_real == base_norm):
                continue

            try:
                rel_path = file_full.relative_to(base_dir).as_posix()
            except ValueError:
                rel_path = filename

            if is_sensitive_file(file_full):
                sensitive_files_count += 1
                continue  # Never read sensitive files for insights

            total_files_scanned += 1
            ext = file_full.suffix.lower()

            try:
                file_size = file_full.stat().st_size
            except Exception:
                file_size = 0

            all_files_meta.append({
                "name": filename,
                "relative_path": rel_path,
                "size_bytes": file_size,
                "size_formatted": format_bytes(file_size)
            })

            # 1. PDF Documents
            if ext == ".pdf":
                languages["pdf"]["files"] += 1
                languages["pdf"]["total_size_bytes"] += file_size
                try:
                    pdf_info = extract_pdf_info(file_full)
                    languages["pdf"]["total_pages"] += pdf_info.get("total_pages", 0)
                except Exception:
                    pass
                continue

            # Skip huge text files > 5MB
            if file_size > MAX_TEXT_FILE_SIZE_BYTES:
                continue

            # 2. Markdown & Plain Text
            if ext in (".md", ".txt"):
                languages["markdown_text"]["files"] += 1
                try:
                    txt = file_full.read_text(encoding="utf-8", errors="replace")
                    languages["markdown_text"]["total_lines"] += len(txt.splitlines())
                except Exception:
                    pass
                continue

            # 3. JSON & CSV Data
            if ext in (".json", ".csv"):
                languages["json_csv"]["files"] += 1
                languages["json_csv"]["total_size_bytes"] += file_size
                try:
                    txt = file_full.read_text(encoding="utf-8", errors="replace")
                    languages["json_csv"]["total_lines"] += len(txt.splitlines())
                except Exception:
                    pass
                continue

            # 4. Code Files Analysis
            if ext in SUPPORTED_CODE_EXTENSIONS:
                try:
                    code_text = file_full.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    continue

                if ext in (".c", ".h", ".cpp", ".cc", ".cxx", ".hpp"):
                    metrics = count_line_metrics(code_text, comment_prefix="//")
                    facts = extract_c_cpp_facts(code_text)
                    fn_cnt = len(facts.get("functions", []))
                    cls_cnt = len(facts.get("classes", []))
                    todo_cnt = len(facts.get("todos", []))

                    l_grp = languages["c_cpp"]
                    l_grp["files"] += 1
                    l_grp["total_lines"] += metrics["total_lines"]
                    l_grp["code_lines"] += metrics["code_lines"]
                    l_grp["comment_lines"] += metrics["comment_lines"]
                    l_grp["blank_lines"] += metrics["blank_lines"]
                    l_grp["functions"] += fn_cnt
                    l_grp["classes"] += cls_cnt
                    total_todos += todo_cnt

                    complex_files_list.append({
                        "name": filename,
                        "relative_path": rel_path,
                        "language": "C/C++",
                        "total_lines": metrics["total_lines"],
                        "functions": fn_cnt,
                        "classes": cls_cnt,
                        "complexity_score": fn_cnt * 2 + cls_cnt * 3 + (metrics["total_lines"] // 50)
                    })

                elif ext == ".java":
                    metrics = count_line_metrics(code_text, comment_prefix="//")
                    facts = extract_java_facts(code_text)
                    fn_cnt = len(facts.get("functions", []))
                    cls_cnt = len(facts.get("classes", []))
                    todo_cnt = len(facts.get("todos", []))

                    l_grp = languages["java"]
                    l_grp["files"] += 1
                    l_grp["total_lines"] += metrics["total_lines"]
                    l_grp["code_lines"] += metrics["code_lines"]
                    l_grp["comment_lines"] += metrics["comment_lines"]
                    l_grp["blank_lines"] += metrics["blank_lines"]
                    l_grp["methods"] += fn_cnt
                    l_grp["classes"] += cls_cnt
                    total_todos += todo_cnt

                    complex_files_list.append({
                        "name": filename,
                        "relative_path": rel_path,
                        "language": "Java",
                        "total_lines": metrics["total_lines"],
                        "functions": fn_cnt,
                        "classes": cls_cnt,
                        "complexity_score": fn_cnt * 2 + cls_cnt * 3 + (metrics["total_lines"] // 50)
                    })

                elif ext == ".py":
                    metrics = count_line_metrics(code_text, comment_prefix="#")
                    facts = extract_python_facts(code_text)
                    fn_cnt = len(facts.get("functions", []))
                    cls_cnt = len(facts.get("classes", []))
                    todo_cnt = len(facts.get("todos", []))

                    l_grp = languages["python"]
                    l_grp["files"] += 1
                    l_grp["total_lines"] += metrics["total_lines"]
                    l_grp["code_lines"] += metrics["code_lines"]
                    l_grp["comment_lines"] += metrics["comment_lines"]
                    l_grp["blank_lines"] += metrics["blank_lines"]
                    l_grp["functions"] += fn_cnt
                    l_grp["classes"] += cls_cnt
                    total_todos += todo_cnt

                    complex_files_list.append({
                        "name": filename,
                        "relative_path": rel_path,
                        "language": "Python",
                        "total_lines": metrics["total_lines"],
                        "functions": fn_cnt,
                        "classes": cls_cnt,
                        "complexity_score": fn_cnt * 2 + cls_cnt * 3 + (metrics["total_lines"] // 50)
                    })

                elif ext in (".js", ".jsx", ".ts", ".tsx"):
                    metrics = count_line_metrics(code_text, comment_prefix="//")
                    facts = extract_js_ts_facts(code_text)
                    fn_cnt = len(facts.get("functions", []))
                    cls_cnt = len(facts.get("classes", []))
                    todo_cnt = len(facts.get("todos", []))

                    l_grp = languages["js_ts"]
                    l_grp["files"] += 1
                    l_grp["total_lines"] += metrics["total_lines"]
                    l_grp["code_lines"] += metrics["code_lines"]
                    l_grp["comment_lines"] += metrics["comment_lines"]
                    l_grp["blank_lines"] += metrics["blank_lines"]
                    l_grp["functions"] += fn_cnt
                    l_grp["classes"] += cls_cnt
                    total_todos += todo_cnt

                    complex_files_list.append({
                        "name": filename,
                        "relative_path": rel_path,
                        "language": "TypeScript/JavaScript",
                        "total_lines": metrics["total_lines"],
                        "functions": fn_cnt,
                        "classes": cls_cnt,
                        "complexity_score": fn_cnt * 2 + cls_cnt * 3 + (metrics["total_lines"] // 50)
                    })

    # Summary calculations
    total_code_files = sum(languages[k]["files"] for k in ("c_cpp", "java", "python", "js_ts"))
    total_code_lines = sum(languages[k]["code_lines"] for k in ("c_cpp", "java", "python", "js_ts"))
    total_comment_lines = sum(languages[k]["comment_lines"] for k in ("c_cpp", "java", "python", "js_ts"))
    total_blank_lines = sum(languages[k]["blank_lines"] for k in ("c_cpp", "java", "python", "js_ts"))
    total_source_lines = sum(languages[k]["total_lines"] for k in ("c_cpp", "java", "python", "js_ts"))

    comment_ratio = round((total_comment_lines / total_code_lines * 100), 1) if total_code_lines > 0 else 0.0

    top_largest = sorted(all_files_meta, key=lambda x: x["size_bytes"], reverse=True)[:5]
    top_complex = sorted(complex_files_list, key=lambda x: x["complexity_score"], reverse=True)[:5]
    for item in top_complex:
        item.pop("complexity_score", None)

    return {
        "total_files": total_files_scanned,
        "total_code_files": total_code_files,
        "total_code_lines": total_code_lines,
        "total_comment_lines": total_comment_lines,
        "total_blank_lines": total_blank_lines,
        "total_source_lines": total_source_lines,
        "comment_ratio_pct": comment_ratio,
        "total_todos": total_todos,
        "sensitive_files_count": sensitive_files_count,
        "languages": languages,
        "top_largest_files": top_largest,
        "top_complex_files": top_complex
    }
