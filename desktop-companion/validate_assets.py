"""
Asset validation script for IGRIS 2.5D desktop companion.
Validates:
- All required base assets exist (body, head, eyes, cape, sword, effects)
- All required particle assets exist (energy, sparks, fragments, aura)
- All 8 state directories exist and contain valid character assets
- Valid PNG format with real alpha transparency
- Valid non-zero dimensions
"""

import os
import sys
import json
from pathlib import Path
from PIL import Image
import numpy as np

COMPANION_DIR = Path(__file__).resolve().parent
ASSETS_DIR = COMPANION_DIR / "assets" / "igris"

REQUIRED_BASE = [
    "body.png",
    "head.png",
    "eyes.png",
    "cape.png",
    "sword.png",
    "effects.png"
]

REQUIRED_PARTICLES = [
    "energy.png",
    "sparks.png",
    "fragments.png",
    "aura.png"
]

REQUIRED_STATES = [
    "idle",
    "listening",
    "thinking",
    "executing",
    "speaking",
    "success",
    "error",
    "offline"
]

def validate():
    print("=" * 70)
    print("       IGRIS Phase 13.5 - Character Asset Verification Engine")
    print("=" * 70)
    
    errors = []
    
    # 1. Manifest Validation
    manifest_path = ASSETS_DIR / "manifest.json"
    if not manifest_path.exists():
        errors.append(f"Missing manifest file: {manifest_path}")
    else:
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            print("  [PASS] manifest.json is valid JSON")
        except Exception as e:
            errors.append(f"Invalid manifest.json: {e}")

    # Helper to check image
    def check_png(img_path, name):
        if not img_path.exists():
            errors.append(f"Missing asset: {name} ({img_path})")
            return
        
        try:
            with Image.open(img_path) as img:
                if img.format != "PNG":
                    errors.append(f"Asset not in PNG format: {name} (format={img.format})")
                    return
                w, h = img.size
                if w <= 0 or h <= 0:
                    errors.append(f"Invalid dimensions for {name}: {w}x{h}")
                    return
                
                arr = np.array(img)
                if arr.ndim != 3 or arr.shape[2] != 4:
                    errors.append(f"Asset lacks RGBA alpha channel: {name}")
                    return
                
                # Check real transparency
                alpha = arr[:, :, 3]
                if alpha.min() != 0 or alpha.max() == 0:
                    errors.append(f"Asset does not contain real alpha transparency: {name} (alpha min={alpha.min()}, max={alpha.max()})")
                    return
                
                print(f"  [PASS] {name:<25} Size={w:4d}x{h:<4d} RGBA=OK Transparency=OK")
        except Exception as e:
            errors.append(f"Error reading asset {name}: {e}")

    # 2. Base Assets Check
    print("\n--- Verifying Base Character Assets ---")
    base_dir = ASSETS_DIR / "base"
    for b in REQUIRED_BASE:
        check_png(base_dir / b, f"base/{b}")

    # 3. Particle Assets Check
    print("\n--- Verifying Particle & Aura Assets ---")
    part_dir = ASSETS_DIR / "particles"
    for p in REQUIRED_PARTICLES:
        check_png(part_dir / p, f"particles/{p}")

    # 4. State Assets Check
    print("\n--- Verifying 8 Animation State Assets ---")
    states_dir = ASSETS_DIR / "states"
    for s in REQUIRED_STATES:
        s_dir = states_dir / s
        if not s_dir.exists():
            errors.append(f"Missing state directory: states/{s}")
        else:
            check_png(s_dir / "character.png", f"states/{s}/character.png")

    print("\n" + "=" * 70)
    if errors:
        print(f"VERIFICATION FAILED: {len(errors)} error(s) detected:")
        for err in errors:
            print(f"  [ERROR] {err}")
        return False
    else:
        print("ALL REQUIRED IGRIS PRODUCTION ASSETS VERIFIED WITH 100% SUCCESS!")
        print("=" * 70)
        return True

if __name__ == "__main__":
    success = validate()
    sys.exit(0 if success else 1)
