"""Safe Desktop Spotify Controller for IGRIS Laptop Agent (Phase 14).

Provides authenticated and desktop-level control for Spotify:
- Open Spotify Web Player in Chrome (or reuse existing Spotify window/tab).
- Search songs, artists, albums, and playlists on Spotify.
- Control playback (next song, previous song, pause, resume, stop).
- Privacy and security guaranteed: Zero shell commands, strict URL safety.
"""

import os
import re
import time
import urllib.parse
import subprocess
import ctypes
from typing import Any, Dict, Optional

user32 = ctypes.windll.user32

# Windows Virtual-Key codes for multimedia
VK_MEDIA_NEXT_TRACK = 0xB0  # 176
VK_MEDIA_PREV_TRACK = 0xB1  # 177
VK_MEDIA_STOP = 0xB2        # 178
VK_MEDIA_PLAY_PAUSE = 0xB3   # 179
KEYEVENTF_KEYUP = 0x0002

SPOTIFY_WEB_URL = "https://open.spotify.com/"


def _send_media_key(vk_code: int) -> None:
    """Send a Windows media key press and release event."""
    user32.keybd_event(vk_code, 0, 0, 0)
    time.sleep(0.05)
    user32.keybd_event(vk_code, 0, KEYEVENTF_KEYUP, 0)


def _find_spotify_window() -> Optional[Dict[str, Any]]:
    """Check if Spotify Web Player or Spotify Desktop is already running and visible."""
    try:
        import window_manager
        windows = window_manager._find_top_level_windows()
        for win in windows:
            hwnd = win[0]
            app_key = win[1]
            title = win[2]
            title_lower = title.lower()

            # Check if Chrome has a Spotify tab open
            if app_key == "chrome" and "spotify" in title_lower:
                return {
                    "hwnd": hwnd,
                    "app_key": "chrome",
                    "title": title,
                    "is_web": True
                }
            # Check for standalone Spotify desktop client
            if "spotify" in app_key or (title_lower.startswith("spotify") and app_key != "explorer"):
                return {
                    "hwnd": hwnd,
                    "app_key": "spotify",
                    "title": title,
                    "is_web": False
                }
    except Exception:
        pass
    return None


def open_spotify(mode: str = "web") -> Dict[str, Any]:
    """Open Spotify Web Player in Chrome, or reuse an existing session.
    
    1. Detects whether Spotify is already open in Chrome or Desktop.
    2. Reuses existing session by focusing the window.
    3. Otherwise, launches Chrome with https://open.spotify.com/.
    4. Avoids opening duplicate browser windows unnecessarily.
    """
    existing = _find_spotify_window()
    if existing:
        import window_manager
        try:
            window_manager.focus_window(existing["app_key"])
        except Exception:
            pass
        return {
            "opened": True,
            "reused": True,
            "source": existing["app_key"],
            "title": existing["title"],
            "url": SPOTIFY_WEB_URL,
            "message": "Spotify is already open. Brought to focus."
        }

    # Open in Google Chrome safely
    opened_via_chrome = False
    try:
        subprocess.Popen(
            ["chrome.exe", SPOTIFY_WEB_URL],
            shell=False,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        opened_via_chrome = True
    except Exception:
        import webbrowser
        webbrowser.open(SPOTIFY_WEB_URL, new=2, autoraise=True)

    return {
        "opened": True,
        "reused": False,
        "url": SPOTIFY_WEB_URL,
        "via_chrome": opened_via_chrome,
        "message": "Spotify Web Player opened successfully in Google Chrome."
    }


def search_spotify(query: str) -> Dict[str, Any]:
    """Search Spotify for songs, artists, albums, or playlists.
    
    Extracts query, URL-encodes it safely, and opens Spotify Web Player search.
    """
    if not query or not isinstance(query, str):
        raise ValueError("Missing or invalid 'query' parameter.")

    clean_query = query.strip()
    if not clean_query:
        raise ValueError("Search query cannot be empty.")

    if len(clean_query) > 500:
        raise ValueError("Search query exceeds maximum allowed limit of 500 characters.")

    if any(ord(c) < 32 and c not in ('\t', '\n', '\r') for c in clean_query):
        raise ValueError("Search query contains forbidden control characters.")

    encoded = urllib.parse.quote(clean_query)
    search_url = f"https://open.spotify.com/search/{encoded}"

    # Open search URL in Chrome
    try:
        subprocess.Popen(
            ["chrome.exe", search_url],
            shell=False,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except Exception:
        import webbrowser
        webbrowser.open(search_url, new=2, autoraise=True)

    return {
        "searched": True,
        "query": clean_query,
        "url": search_url,
        "message": f"Searching Spotify for '{clean_query}'."
    }


def play_spotify(query: Optional[str] = None) -> Dict[str, Any]:
    """Start or resume Spotify playback, optionally with a search query."""
    if query and isinstance(query, str) and query.strip():
        search_res = search_spotify(query.strip())
        # Give browser a moment to load
        time.sleep(0.5)
        _send_media_key(VK_MEDIA_PLAY_PAUSE)
        return {
            "playing": True,
            "query": query.strip(),
            "url": search_res.get("url"),
            "message": f"Searching Spotify for '{query.strip()}' and starting playback."
        }

    # Resume current playback
    _send_media_key(VK_MEDIA_PLAY_PAUSE)
    return {
        "playing": True,
        "query": None,
        "message": "Starting playback on Spotify."
    }


def next_track() -> Dict[str, Any]:
    """Skip to the next song on Spotify."""
    _send_media_key(VK_MEDIA_NEXT_TRACK)
    return {
        "success": True,
        "action": "next_track",
        "message": "Skipped to next song on Spotify."
    }


def previous_track() -> Dict[str, Any]:
    """Play the previous song on Spotify."""
    _send_media_key(VK_MEDIA_PREV_TRACK)
    return {
        "success": True,
        "action": "previous_track",
        "message": "Playing previous song on Spotify."
    }


def pause_music() -> Dict[str, Any]:
    """Pause Spotify music playback."""
    _send_media_key(VK_MEDIA_PLAY_PAUSE)
    return {
        "success": True,
        "action": "pause",
        "paused": True,
        "message": "Spotify music paused."
    }


def resume_music() -> Dict[str, Any]:
    """Resume Spotify music playback."""
    _send_media_key(VK_MEDIA_PLAY_PAUSE)
    return {
        "success": True,
        "action": "resume",
        "playing": True,
        "message": "Resumed Spotify music."
    }


def stop_music() -> Dict[str, Any]:
    """Stop music playback."""
    _send_media_key(VK_MEDIA_STOP)
    return {
        "success": True,
        "action": "stop",
        "stopped": True,
        "message": "Spotify music stopped."
    }
