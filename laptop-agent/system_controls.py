"""Windows System Volume & Screen Brightness Management for IGRIS (Phase 14).

Provides safe hardware controls:
- Windows Master System Volume: set, adjust, get, mute, unmute.
- Windows Screen Brightness: set, adjust, get with graceful hardware support fallback.
- Guarantees:
  * Strict percentage validation (0-100%).
  * No arbitrary shell commands.
  * Graceful handling of unsupported displays or audio devices.
"""

from typing import Any, Dict, Optional


# ==============================================================================
# System Volume Control via PyCAW
# ==============================================================================

def _get_audio_endpoint():
    """Retrieve the master audio endpoint volume interface."""
    try:
        from pycaw.pycaw import AudioUtilities
        speakers = AudioUtilities.GetSpeakers()
        if not speakers:
            return None
        return speakers.EndpointVolume
    except Exception:
        return None


def get_system_volume() -> Dict[str, Any]:
    """Retrieve current system master volume percentage and mute status."""
    ep = _get_audio_endpoint()
    if not ep:
        return {
            "success": False,
            "error": "No active audio endpoint device found.",
            "message": "Audio device is unavailable."
        }

    try:
        scalar = ep.GetMasterVolumeLevelScalar()
        vol = round(scalar * 100)
        is_muted = bool(ep.GetMute())
        return {
            "success": True,
            "volume": vol,
            "muted": is_muted,
            "message": f"Current system volume is {vol} percent{' (muted)' if is_muted else ''}."
        }
    except Exception as exc:
        return {
            "success": False,
            "error": str(exc),
            "message": f"Failed to read volume: {exc}"
        }


def set_system_volume(level: Optional[int] = None, mute: Optional[bool] = None) -> Dict[str, Any]:
    """Set Windows master volume (0-100%) and/or mute state."""
    ep = _get_audio_endpoint()
    if not ep:
        return {
            "success": False,
            "error": "No active audio endpoint device found.",
            "message": "Audio device is unavailable."
        }

    try:
        # Handle mute / unmute flag
        if mute is not None:
            ep.SetMute(1 if mute else 0, None)

        # Handle volume level
        if level is not None:
            if not isinstance(level, (int, float)):
                raise ValueError("Volume level must be a number between 0 and 100.")
            int_level = int(round(level))
            if int_level < 0 or int_level > 100:
                raise ValueError(f"Volume level {int_level} is outside permitted range (0-100%).")

            ep.SetMasterVolumeLevelScalar(int_level / 100.0, None)
            # If setting a non-zero volume and currently muted, unmute automatically
            if int_level > 0 and mute is None and ep.GetMute():
                ep.SetMute(0, None)

        # Read back actual state
        actual_vol = round(ep.GetMasterVolumeLevelScalar() * 100)
        actual_mute = bool(ep.GetMute())

        msg = f"System volume set to {actual_vol} percent."
        if actual_mute and (mute is True or (level is not None and int(round(level)) == 0)):
            msg = "System muted."
        elif actual_mute:
            msg = f"System volume set to {actual_vol} percent (muted)."
        elif mute is False:
            msg = f"System unmuted. Volume is {actual_vol} percent."

        return {
            "success": True,
            "volume": actual_vol,
            "muted": actual_mute,
            "message": msg
        }
    except Exception as exc:
        return {
            "success": False,
            "error": str(exc),
            "message": f"Failed to set volume: {exc}"
        }


def adjust_system_volume(delta: int) -> Dict[str, Any]:
    """Increase or decrease Windows master volume relative to current level."""
    ep = _get_audio_endpoint()
    if not ep:
        return {
            "success": False,
            "error": "No active audio endpoint device found.",
            "message": "Audio device is unavailable."
        }

    try:
        if not isinstance(delta, (int, float)):
            raise ValueError("Volume adjustment delta must be a number.")
        int_delta = int(round(delta))
        if int_delta < -100 or int_delta > 100:
            raise ValueError(f"Adjustment delta {int_delta} exceeds maximum allowed range (-100 to 100).")

        current = round(ep.GetMasterVolumeLevelScalar() * 100)
        new_vol = max(0, min(100, current + int_delta))

        ep.SetMasterVolumeLevelScalar(new_vol / 100.0, None)
        if new_vol > 0 and ep.GetMute():
            ep.SetMute(0, None)

        action_word = "increased" if int_delta > 0 else "decreased"
        return {
            "success": True,
            "previous_volume": current,
            "volume": new_vol,
            "delta": int_delta,
            "message": f"System volume {action_word} to {new_vol} percent."
        }
    except Exception as exc:
        return {
            "success": False,
            "error": str(exc),
            "message": f"Failed to adjust volume: {exc}"
        }


# ==============================================================================
# Screen Brightness Control via screen_brightness_control
# ==============================================================================

def get_screen_brightness() -> Dict[str, Any]:
    """Retrieve current display brightness percentage."""
    try:
        import screen_brightness_control as sbc
        b_list = sbc.get_brightness()
        if not b_list:
            return {
                "success": False,
                "error": "Brightness control is unavailable for the current display.",
                "message": "Brightness control is unavailable for the current display."
            }
        current_b = int(b_list[0] if isinstance(b_list, list) else b_list)
        return {
            "success": True,
            "brightness": current_b,
            "message": f"Current screen brightness is {current_b} percent."
        }
    except Exception as exc:
        return {
            "success": False,
            "error": "Brightness control is unavailable for the current display.",
            "details": str(exc),
            "message": "Brightness control is unavailable for the current display."
        }


def set_screen_brightness(level: int) -> Dict[str, Any]:
    """Set screen brightness (0-100%) on supported displays."""
    if not isinstance(level, (int, float)):
        raise ValueError("Brightness level must be a number between 0 and 100.")

    int_level = int(round(level))
    if int_level < 0 or int_level > 100:
        raise ValueError(f"Brightness level {int_level} is outside permitted range (0-100%).")

    try:
        import screen_brightness_control as sbc
        sbc.set_brightness(int_level)
        b_list = sbc.get_brightness()
        actual_b = int(b_list[0] if isinstance(b_list, list) else b_list) if b_list else int_level
        return {
            "success": True,
            "brightness": actual_b,
            "message": f"Screen brightness set to {actual_b} percent."
        }
    except Exception as exc:
        return {
            "success": False,
            "error": "Brightness control is unavailable for the current display.",
            "details": str(exc),
            "message": "Brightness control is unavailable for the current display."
        }


def adjust_screen_brightness(delta: int) -> Dict[str, Any]:
    """Increase or decrease screen brightness relative to current level."""
    if not isinstance(delta, (int, float)):
        raise ValueError("Brightness adjustment delta must be a number.")

    int_delta = int(round(delta))
    if int_delta < -100 or int_delta > 100:
        raise ValueError(f"Adjustment delta {int_delta} exceeds maximum allowed range (-100 to 100).")

    cur_res = get_screen_brightness()
    if not cur_res.get("success"):
        return cur_res

    current = cur_res.get("brightness", 50)
    new_b = max(0, min(100, current + int_delta))
    return set_screen_brightness(new_b)
