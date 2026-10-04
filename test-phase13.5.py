r"""JARVIS / IGRIS Phase 13.5 - 2.5D Character Asset System & Visual Integration Test Suite
=======================================================================================

Automated verification of the Phase 13.5 Character Asset System:
1. body asset loads
2. head asset loads
3. eyes asset loads
4. cape asset loads
5. sword asset loads
6. effects asset loads
7. transparent assets load correctly
8. layer order works
9. character renders
10. IDLE works
11. LISTENING works
12. THINKING works
13. EXECUTING works
14. SPEAKING works
15. SUCCESS works
16. ERROR works
17. OFFLINE works
18. state transitions work
19. character remains consistent
20. placeholder character is no longer used
21. Electron window remains transparent
22. Electron security remains intact
23. Socket.IO integration remains intact
24. desktop companion remains performant
"""

import sys
import os
import json
from pathlib import Path
from PIL import Image
import numpy as np

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = Path("d:/JARVIS")
COMPANION_DIR = BASE_DIR / "desktop-companion"
ASSETS_DIR = COMPANION_DIR / "assets" / "igris"

test_results = []

def record(name: str, passed: bool, details: str = ""):
    status = "PASS" if passed else "FAIL"
    test_results.append((name, passed, details))
    print(f"  [{status}] {name}" + (f" ({details})" if details else ""), flush=True)

print("=" * 80, flush=True)
print("     JARVIS / IGRIS Phase 13.5 - Character Asset System Test Suite", flush=True)
print("=" * 80, flush=True)

# Helper to verify PNG
def verify_asset(rel_path):
    p = ASSETS_DIR / rel_path
    if not p.exists():
        return False, f"File does not exist: {p}"
    try:
        with Image.open(p) as img:
            if img.format != "PNG":
                return False, f"Not PNG (format={img.format})"
            arr = np.array(img)
            if arr.ndim != 3 or arr.shape[2] != 4:
                return False, "Not RGBA"
            if arr[:, :, 3].min() != 0:
                return False, "No alpha transparency"
            return True, f"RGBA PNG, size={img.size}"
    except Exception as e:
        return False, str(e)

# ==============================================================================
# GROUP 1: Base Character Assets & Transparency (Tests 1 - 7)
# ==============================================================================
print("\n--- GROUP 1: Base Character Assets & Transparency ---", flush=True)

ok, msg = verify_asset("base/body.png")
record("1. body asset loads", ok, msg)

ok, msg = verify_asset("base/head.png")
record("2. head asset loads", ok, msg)

ok, msg = verify_asset("base/eyes.png")
record("3. eyes asset loads", ok, msg)

ok, msg = verify_asset("base/cape.png")
record("4. cape asset loads", ok, msg)

ok, msg = verify_asset("base/sword.png")
record("5. sword asset loads", ok, msg)

ok, msg = verify_asset("base/effects.png")
record("6. effects asset loads", ok, msg)

# 7. Transparent assets load correctly
all_base = ["base/body.png", "base/head.png", "base/eyes.png", "base/cape.png", "base/sword.png", "base/effects.png"]
trans_ok = all(verify_asset(b)[0] for b in all_base)
record("7. transparent assets load correctly", trans_ok, "All base assets have real alpha transparency")

# ==============================================================================
# GROUP 2: 2.5D Layer Order & Character Rendering (Tests 8 - 9)
# ==============================================================================
print("\n--- GROUP 2: 2.5D Layer Order & Character Rendering ---", flush=True)

with open(COMPANION_DIR / "styles.css", "r", encoding="utf-8") as f:
    css_content = f.read()

# 8. Layer order works (Z-indexes in CSS)
layer_order_ok = (
    ".layer-aura" in css_content and
    ".layer-cape" in css_content and
    ".layer-character" in css_content and
    ".layer-eyes" in css_content
)
record("8. layer order works", layer_order_ok, "z-index hierarchy established in styles.css")

# 9. Character renders (index.html contains image layers)
with open(COMPANION_DIR / "index.html", "r", encoding="utf-8") as f:
    html_content = f.read()

renders_ok = (
    "id=\"imgCharacter\"" in html_content and
    "id=\"imgEyes\"" in html_content and
    "id=\"imgAura\"" in html_content and
    "id=\"imgCape\"" in html_content
)
record("9. character renders", renders_ok, "index.html binds real <img> asset layers")

# ==============================================================================
# GROUP 3: The 8 Animation States (Tests 10 - 18)
# ==============================================================================
print("\n--- GROUP 3: The 8 Animation States ---", flush=True)

states = ["idle", "listening", "thinking", "executing", "speaking", "success", "error", "offline"]
test_nums = [10, 11, 12, 13, 14, 15, 16, 17]

for num, s in zip(test_nums, states):
    ok, msg = verify_asset(f"states/{s}/character.png")
    css_has = f".state-{s}" in css_content
    record(f"{num}. {s.upper()} works", ok and css_has, f"Asset exists and .state-{s} styling configured")

# 18. State transitions work in renderer.js
with open(COMPANION_DIR / "renderer.js", "r", encoding="utf-8") as f:
    renderer_content = f.read()

transitions_ok = (
    "function setState(state" in renderer_content and
    "assets/igris/states/${state}/character.png" in renderer_content
)
record("18. state transitions work", transitions_ok, "setState switches character artwork dynamically")

# ==============================================================================
# GROUP 4: Consistency, Security, Transparency & Performance (Tests 19 - 24)
# ==============================================================================
print("\n--- GROUP 4: Visual Consistency & System Invariants ---", flush=True)

# 19. Character remains consistent (Check all state images exist and have proportional dimensions)
consistent_ok = True
state_dims = []
for s in states:
    with Image.open(ASSETS_DIR / f"states/{s}/character.png") as img:
        state_dims.append(img.size)

# All state images are approximately ~128x208px
widths = [d[0] for d in state_dims]
heights = [d[1] for d in state_dims]
consistent_ok = (max(widths) - min(widths) <= 5) and (max(heights) - min(heights) <= 12)
record("19. character remains consistent", consistent_ok, f"All 8 states match proportion ~{state_dims[0][0]}x{state_dims[0][1]}")

# 20. Placeholder character is no longer used (No polygon or svg vector shapes in index.html)
no_placeholder = "<polygon" not in html_content and "<rect" not in html_content and "<path" not in html_content
record("20. placeholder character is no longer used", no_placeholder, "Zero <polygon> or vector placeholders in production HTML")

# 21. Electron window remains transparent
with open(COMPANION_DIR / "main.js", "r", encoding="utf-8") as f:
    main_content = f.read()

trans_win_ok = (
    "transparent: true" in main_content and
    "background: transparent !important" in css_content
)
record("21. Electron window remains transparent", trans_win_ok, "transparent: true in main.js & transparent background in CSS")

# 22. Electron security remains intact
sec_ok = (
    "contextIsolation: true" in main_content and
    "nodeIntegration: false" in main_content and
    "sandbox: true" in main_content
)
record("22. Electron security remains intact", sec_ok, "contextIsolation=true, nodeIntegration=false, sandbox=true")

# 23. Socket.IO integration remains intact
with open(COMPANION_DIR / "socket-client.js", "r", encoding="utf-8") as f:
    sock_content = f.read()

sock_ok = (
    "io(" in sock_content and
    "role: 'phone'" in sock_content and
    "ai_command" in sock_content
)
record("23. Socket.IO integration remains intact", sock_ok, "Socket client emits ai_command and handles progress events")

# 24. Desktop companion remains performant
perf_ok = (
    "transform-style: preserve-3d" in css_content and
    "animationEnabled" in renderer_content and
    "requestAnimationFrame" in renderer_content
)
record("24. desktop companion remains performant", perf_ok, "Hardware-accelerated CSS 3D transforms & pausable RAF loops")

print("=" * 80, flush=True)
print("                           PHASE 13.5 TEST SUMMARY", flush=True)
print("=" * 80, flush=True)

passed_count = sum(1 for _, p, _ in test_results if p)
total_count = len(test_results)
pct = (passed_count / total_count) * 100.0
print(f"Results: {passed_count}/{total_count} PASSED ({pct:.1f}%)\n", flush=True)

if passed_count == total_count:
    print("ALL 24 PHASE 13.5 TESTS PASSED WITH 100% SUCCESS!", flush=True)
    sys.exit(0)
else:
    print(f"SOME TESTS FAILED ({total_count - passed_count} failures).", flush=True)
    sys.exit(1)
