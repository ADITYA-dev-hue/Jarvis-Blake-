import os
import json
from PIL import Image

def test_icons():
    print("=== JARVIS BLAKE LOGO & ICON VERIFICATION ===")
    base_dir = r"d:\JARVIS\phone-ui\public"
    dist_dir = r"d:\JARVIS\phone-ui\dist"

    required_public_files = [
        "favicon.ico",
        "favicon.png",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "favicon.svg",
        "icon-48x48.png",
        "icon-72x72.png",
        "icon-96x96.png",
        "icon-144x144.png",
        "icon-192x192.png",
        "icon-384x384.png",
        "icon-512x512.png",
        "android-chrome-192x192.png",
        "android-chrome-512x512.png",
        "maskable-icon-192x192.png",
        "maskable-icon-512x512.png",
        "apple-touch-icon.png",
        "apple-touch-icon-180x180.png",
        "jarvis_blake_logo.png",
        "jarvis_blake_round.png",
        "manifest.json",
        "sw.js",
        "android/ic_launcher.png",
        "android/ic_launcher_round.png",
        "android/ic_launcher_foreground.png",
        "android/ic_launcher_background.png",
        "android/ic_notification.png",
    ]

    print("\n1. Verifying Phone-UI Public files:")
    all_ok = True
    for f in required_public_files:
        p = os.path.join(base_dir, f)
        if os.path.exists(p) and os.path.getsize(p) > 0:
            print(f"  [PASS] public/{f} exists ({os.path.getsize(p)} bytes)")
        else:
            print(f"  [FAIL] public/{f} missing or empty!")
            all_ok = False

    print("\n2. Verifying Phone-UI Dist files:")
    for f in required_public_files:
        p = os.path.join(dist_dir, f)
        if os.path.exists(p) and os.path.getsize(p) > 0:
            print(f"  [PASS] dist/{f} exists ({os.path.getsize(p)} bytes)")
        else:
            print(f"  [FAIL] dist/{f} missing or empty!")
            all_ok = False

    print("\n3. Validating Image Dimensions & Alpha:")
    dim_checks = {
        "favicon-16x16.png": (16, 16),
        "favicon-32x32.png": (32, 32),
        "icon-48x48.png": (48, 48),
        "icon-72x72.png": (72, 72),
        "icon-96x96.png": (96, 96),
        "icon-144x144.png": (144, 144),
        "icon-192x192.png": (192, 192),
        "icon-384x384.png": (384, 384),
        "icon-512x512.png": (512, 512),
        "android-chrome-192x192.png": (192, 192),
        "android-chrome-512x512.png": (512, 512),
        "maskable-icon-192x192.png": (192, 192),
        "maskable-icon-512x512.png": (512, 512),
        "apple-touch-icon-180x180.png": (180, 180),
        "apple-touch-icon.png": (180, 180),
        "android/ic_launcher.png": (192, 192),
        "android/ic_launcher_round.png": (192, 192),
        "android/ic_launcher_foreground.png": (432, 432),
        "android/ic_launcher_background.png": (432, 432),
        "android/ic_notification.png": (96, 96),
    }

    for name, expected_dim in dim_checks.items():
        img_path = os.path.join(dist_dir, name)
        with Image.open(img_path) as im:
            if im.size == expected_dim:
                print(f"  [PASS] {name} dimension matches {expected_dim}")
            else:
                print(f"  [FAIL] {name} dimension mismatch: got {im.size}, expected {expected_dim}")
                all_ok = False

    print("\n4. Validating manifest.json:")
    manifest_path = os.path.join(dist_dir, "manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as mf:
        data = json.load(mf)
        assert data["name"] == "JARVIS — BLAKE", f"Unexpected name: {data.get('name')}"
        assert data["short_name"] == "JARVIS", f"Unexpected short_name: {data.get('short_name')}"
        assert data["description"] == "Personal Control System", f"Unexpected description: {data.get('description')}"
        assert len(data["icons"]) >= 7, f"Not enough icons in manifest: {len(data['icons'])}"
        print(f"  [PASS] manifest.json is valid with {len(data['icons'])} icons defined.")

    print("\n5. Validating index.html:")
    index_path = os.path.join(dist_dir, "index.html")
    with open(index_path, "r", encoding="utf-8") as inf:
        html = inf.read()
        assert "JARVIS — BLAKE | Personal Control System" in html, "Missing page title"
        assert 'href="/favicon.ico"' in html, "Missing favicon.ico link"
        assert 'href="/favicon-32x32.png"' in html, "Missing favicon-32x32 link"
        assert 'href="/apple-touch-icon.png"' in html, "Missing apple-touch-icon link"
        assert 'href="/manifest.json"' in html, "Missing manifest.json link"
        print("  [PASS] index.html links and titles verified.")

    if all_ok:
        print("\n>>> ALL ICON & BRANDING ASSET CHECKS PASSED SUCCESSFULLY! <<<")
    else:
        print("\n>>> SOME CHECKS FAILED! <<<")
        exit(1)

if __name__ == "__main__":
    test_icons()
