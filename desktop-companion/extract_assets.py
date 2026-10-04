"""
Extract and process IGRIS 2.5D character assets with real alpha transparency
from user-provided project artwork.
"""

import os
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ART_DIR = Path(r"C:\Users\aditya prakash\.gemini\antigravity\brain\0c4e02e6-2dca-4991-9a6b-a00b24aec8cb\.user_uploaded")
OUT_DIR = Path(r"D:\JARVIS\desktop-companion\assets\igris")

BASE_DIR = OUT_DIR / "base"
STATES_DIR = OUT_DIR / "states"
PARTICLES_DIR = OUT_DIR / "particles"

for d in [BASE_DIR, STATES_DIR, PARTICLES_DIR]:
    d.mkdir(parents=True, exist_ok=True)

for state in ['idle', 'listening', 'thinking', 'executing', 'speaking', 'success', 'error', 'offline']:
    (STATES_DIR / state).mkdir(parents=True, exist_ok=True)

def black_to_transparent(pil_img, bg_thresh=12, soft_thresh=45):
    """
    Converts a black background to clean alpha transparency.
    Uses luminance and maximum RGB channel to calculate opacity.
    Inside solid armor, keeps full opacity. On edges/glow, creates smooth alpha falloff.
    """
    img = pil_img.convert("RGBA")
    arr = np.array(img, dtype=np.float32)
    rgb = arr[:, :, :3]
    
    # Max channel is a great indicator of dark black background
    max_c = np.max(rgb, axis=2)
    # Luminance
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    metric = np.maximum(max_c, lum)
    
    # Calculate alpha: 0 below bg_thresh, smoothly ramp to 255 at soft_thresh
    alpha = np.zeros_like(metric)
    mask_mid = (metric > bg_thresh) & (metric < soft_thresh)
    alpha[mask_mid] = ((metric[mask_mid] - bg_thresh) / (soft_thresh - bg_thresh)) * 255.0
    alpha[metric >= soft_thresh] = 255.0
    
    # Set alpha
    arr[:, :, 3] = np.clip(alpha, 0, 255)
    
    # Un-premultiply RGB slightly on glow edges so red doesn't darken
    glow_mask = (alpha > 0) & (alpha < 255)
    factor = np.clip(255.0 / (alpha[glow_mask] + 1e-5), 1.0, 2.5)
    for c in range(3):
        channel = arr[:, :, c]
        channel[glow_mask] = np.clip(channel[glow_mask] * factor, 0, 255)
        arr[:, :, c] = channel
        
    res = Image.fromarray(arr.astype(np.uint8), mode="RGBA")
    return res

def trim_transparent(pil_img, padding=4):
    """Trims empty transparent borders while adding slight padding."""
    bbox = pil_img.getbbox()
    if bbox:
        w, h = pil_img.size
        x0 = max(0, bbox[0] - padding)
        y0 = max(0, bbox[1] - padding)
        x1 = min(w, bbox[2] + padding)
        y1 = min(h, bbox[3] + padding)
        return pil_img.crop((x0, y0, x1, y1))
    return pil_img

print("Extracting Base Assets...")

# 1. HEAD (from media_1791079737133.jpg)
head_src = Image.open(ART_DIR / "media_1791079737133.jpg")
head_rgba = black_to_transparent(head_src, bg_thresh=10, soft_thresh=38)
head_trimmed = trim_transparent(head_rgba)
head_trimmed.save(BASE_DIR / "head.png", "PNG")
print(f"  [OK] head.png: {head_trimmed.size}")

# 2. BODY (from media_1791079751567.jpg)
body_src = Image.open(ART_DIR / "media_1791079751567.jpg")
body_rgba = black_to_transparent(body_src, bg_thresh=10, soft_thresh=35)
body_trimmed = trim_transparent(body_rgba)
body_trimmed.save(BASE_DIR / "body.png", "PNG")
print(f"  [OK] body.png: {body_trimmed.size}")

# 3. CAPE (from media_1791079760584.jpg)
cape_src = Image.open(ART_DIR / "media_1791079760584.jpg")
cape_rgba = black_to_transparent(cape_src, bg_thresh=10, soft_thresh=38)
cape_trimmed = trim_transparent(cape_rgba)
cape_trimmed.save(BASE_DIR / "cape.png", "PNG")
print(f"  [OK] cape.png: {cape_trimmed.size}")

# 4. EYES (from media_1791079768753.png - already transparent PNG)
eyes_src = Image.open(ART_DIR / "media_1791079768753.png")
eyes_trimmed = trim_transparent(eyes_src)
eyes_trimmed.save(BASE_DIR / "eyes.png", "PNG")
print(f"  [OK] eyes.png: {eyes_trimmed.size}")

# Load Master Sheet (media_1791079725544.jpg)
master_img = Image.open(ART_DIR / "media_1791079725544.jpg")

# 5. SWORD (from master sheet middle row swords section: x=660..760, y=248..440)
# Crop the iconic primary crimson energy sword
sword_crop = master_img.crop((680, 248, 775, 442))
sword_rgba = black_to_transparent(sword_crop, bg_thresh=12, soft_thresh=42)
sword_trimmed = trim_transparent(sword_rgba)
sword_trimmed.save(BASE_DIR / "sword.png", "PNG")
print(f"  [OK] sword.png: {sword_trimmed.size}")

# 6. EFFECTS & PARTICLES (from master sheet bottom row)
# Ground effect aura: x=170..315, y=530..660
ground_crop = master_img.crop((175, 530, 315, 660))
ground_rgba = black_to_transparent(ground_crop, bg_thresh=12, soft_thresh=35)
ground_trimmed = trim_transparent(ground_rgba)
ground_trimmed.save(BASE_DIR / "effects.png", "PNG")
ground_trimmed.save(PARTICLES_DIR / "aura.png", "PNG")
print(f"  [OK] effects.png & aura.png: {ground_trimmed.size}")

# Energy curves: x=0..175, y=530..660
energy_crop = master_img.crop((5, 530, 172, 660))
energy_rgba = black_to_transparent(energy_crop, bg_thresh=12, soft_thresh=35)
energy_trimmed = trim_transparent(energy_rgba)
energy_trimmed.save(PARTICLES_DIR / "energy.png", "PNG")
print(f"  [OK] energy.png: {energy_trimmed.size}")

# Sparks / Particles: x=315..440, y=530..660
sparks_crop = master_img.crop((318, 530, 440, 660))
sparks_rgba = black_to_transparent(sparks_crop, bg_thresh=12, soft_thresh=35)
sparks_trimmed = trim_transparent(sparks_rgba)
sparks_trimmed.save(PARTICLES_DIR / "sparks.png", "PNG")
# Fragments from upper region of particles
frag_crop = master_img.crop((320, 530, 435, 595))
frag_rgba = black_to_transparent(frag_crop, bg_thresh=12, soft_thresh=35)
frag_trimmed = trim_transparent(frag_rgba)
frag_trimmed.save(PARTICLES_DIR / "fragments.png", "PNG")
print(f"  [OK] sparks.png & fragments.png: {sparks_trimmed.size}")

# 7. THE 8 ANIMATION STATES (Top row of master sheet)
# 8 columns: width = 128px each, y = 5..215
state_names = ['idle', 'listening', 'thinking', 'executing', 'speaking', 'success', 'error', 'offline']
print("\nExtracting The 8 Animation States...")

for i, state in enumerate(state_names):
    x0 = i * 128
    x1 = (i + 1) * 128
    # y range 0 to 215 (just above the label text pills at y=218)
    state_crop = master_img.crop((x0, 0, x1, 216))
    state_rgba = black_to_transparent(state_crop, bg_thresh=10, soft_thresh=35)
    state_trimmed = trim_transparent(state_rgba, padding=2)
    
    out_path = STATES_DIR / state / "character.png"
    state_trimmed.save(out_path, "PNG")
    print(f"  [OK] states/{state}/character.png: {state_trimmed.size}")

print("\nAsset extraction completed successfully!")
