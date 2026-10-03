"""JARVIS / IGRIS Phase 11 - Safe PDF Document Analyzer

Capabilities:
1. Safe PDF text extraction with page numbers (1-indexed).
2. PDF text search across pages with matching page numbers & excerpts.
3. Outline and section extraction where available.
4. Maximum PDF size limit (20 MB default) and max page/character bounds.
5. Absolute security: NEVER executes embedded JavaScript or executable annotations.
"""

import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from sensitive_data import redact_secrets

MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
MAX_EXTRACT_PAGES = 50
MAX_CHARS_PER_PAGE = 5000
MAX_EXCERPTS = 20
EXCERPT_WINDOW = 120


def extract_pdf_info(pdf_path: Path) -> Dict[str, Any]:
    """Inspect basic metadata and page count of a PDF file safely.
    
    Args:
        pdf_path: Absolute Path object to the PDF file.
        
    Returns:
        Dict with total pages, title, author, and size.
    """
    if not pdf_path.is_file():
        raise FileNotFoundError(f"PDF file not found: '{pdf_path.name}'")

    file_size = pdf_path.stat().st_size
    if file_size > MAX_PDF_SIZE_BYTES:
        raise ValueError(
            f"PDF file size ({file_size / (1024*1024):.1f} MB) exceeds maximum allowed limit of 20 MB."
        )

    try:
        import pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        num_pages = len(reader.pages)
        meta = reader.metadata or {}

        title = str(meta.get("/Title") or meta.get("title") or pdf_path.stem)
        author = str(meta.get("/Author") or meta.get("author") or "Unknown")

        # Extract outline / bookmarks if available
        outline_titles = []
        try:
            if reader.outline:
                for item in reader.outline:
                    if isinstance(item, dict) and "/Title" in item:
                        outline_titles.append(str(item["/Title"]))
                    elif hasattr(item, "title"):
                        outline_titles.append(str(item.title))
        except Exception:
            pass

        return {
            "valid": True,
            "filename": pdf_path.name,
            "num_pages": num_pages,
            "total_pages": num_pages,
            "title": title,
            "author": author,
            "metadata": meta,
            "size_bytes": file_size,
            "outline": outline_titles[:15]
        }
    except Exception as e:
        raise ValueError(f"Corrupted or invalid PDF file: {str(e)}")


def extract_pdf_text(
    pdf_path: Path,
    max_pages: int = MAX_EXTRACT_PAGES,
    max_chars: int = 50000,
    start_page: int = 1,
    end_page: Optional[int] = None
) -> Dict[str, Any]:
    """Extract bounded plain text from a PDF document with page numbers.
    
    Args:
        pdf_path: Absolute Path object.
        max_pages: Maximum number of pages to read.
        max_chars: Maximum characters to accumulate across pages.
        start_page: 1-indexed starting page number.
        end_page: Optional 1-indexed ending page number.
        
    Returns:
        Dict containing pages list with 1-indexed page numbers and extracted text.
    """
    if not pdf_path.is_file():
        raise FileNotFoundError(f"PDF file not found: '{pdf_path.name}'")

    file_size = pdf_path.stat().st_size
    if file_size > MAX_PDF_SIZE_BYTES:
        raise ValueError(f"PDF file size exceeds 20 MB limit ({file_size} bytes).")

    import pypdf
    try:
        reader = pypdf.PdfReader(str(pdf_path))
    except Exception as e:
        raise ValueError(f"Corrupted or invalid PDF: {str(e)}")

    total_pages = len(reader.pages)

    s_idx = max(0, start_page - 1)
    if end_page is not None and end_page >= start_page:
        e_idx = min(total_pages, end_page)
    else:
        e_idx = min(total_pages, s_idx + max_pages)

    pages_data = []
    total_extracted_chars = 0

    for i in range(s_idx, e_idx):
        if total_extracted_chars >= max_chars:
            break

        try:
            page = reader.pages[i]
            text = page.extract_text() or ""
            text = redact_secrets(text.strip())
            if len(text) > MAX_CHARS_PER_PAGE:
                text = text[:MAX_CHARS_PER_PAGE] + " ... [Page text truncated]"

            total_extracted_chars += len(text)
            pages_data.append({
                "page_number": i + 1,
                "char_count": len(text),
                "text": text
            })
        except Exception as e:
            pages_data.append({
                "page_number": i + 1,
                "error": f"Page extraction error: {str(e)}",
                "text": ""
            })

    return {
        "filename": pdf_path.name,
        "total_pages": total_pages,
        "extracted_pages": len(pages_data),
        "pages": pages_data,
        "truncated": total_pages > (e_idx - s_idx) or total_extracted_chars >= max_chars
    }


def search_pdf_content(
    pdf_path: Path,
    query: str,
    max_excerpts: int = MAX_EXCERPTS
) -> List[Dict[str, Any]]:
    """Search for a keyword or phrase across all pages of a PDF document.
    
    Args:
        pdf_path: Absolute Path object to the PDF.
        query: Case-insensitive search query string.
        max_excerpts: Maximum matching excerpts to return.
        
    Returns:
        List of match dicts: [{ page, excerpt, match_index }]
    """
    if not query or not query.strip():
        return []

    clean_query = query.strip().lower()
    matches = []

    try:
        import pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        total_pages = len(reader.pages)

        for page_idx in range(total_pages):
            if len(matches) >= max_excerpts:
                break

            try:
                page = reader.pages[page_idx]
                text = page.extract_text() or ""
                if not text:
                    continue

                lower_text = text.lower()
                start_pos = 0

                while len(matches) < max_excerpts:
                    found_idx = lower_text.find(clean_query, start_pos)
                    if found_idx == -1:
                        break

                    # Window excerpt around match
                    left = max(0, found_idx - 60)
                    right = min(len(text), found_idx + len(clean_query) + 60)
                    excerpt_str = text[left:right].replace("\n", " ").strip()
                    if left > 0:
                        excerpt_str = "..." + excerpt_str
                    if right < len(text):
                        excerpt_str = excerpt_str + "..."

                    matches.append({
                        "page": page_idx + 1,
                        "excerpt": redact_secrets(excerpt_str),
                        "position": found_idx
                    })

                    start_pos = found_idx + len(clean_query)
            except Exception:
                continue

    except Exception as e:
        return [{"page": 0, "excerpt": f"PDF search error: {str(e)}"}]

    return matches
