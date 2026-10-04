# JARVIS / IGRIS Phase 13.5: 2.5D Character Asset System & Visual Integration

## 1. Overview & Architectural Scope
Phase 13.5 replaces the vector/polygon placeholder character from Phase 13 with an original, high-definition 2.5D visual asset system extracted directly from project artwork. The companion retains its lightweight, transparent, always-on-top architecture while presenting a dark futuristic knight character with crimson energy glow, true alpha transparency, multi-layer depth parallax, and 8 state-synchronized animation presets.

```
                    DESKTOP COMPANION RENDERER RIG
                    ┌────────────────────────────┐
                    │     #companionViewport     │
                    │   (perspective: 1000px)    │
                    │             │              │
                    │      #characterRig         │
                    │   (transform-style: 3D)    │
                    └─────────────┬──────────────┘
                                  │
    ┌──────────────┬──────────────┼──────────────┬──────────────┐
    │              │              │              │              │
[#imgAura]    [#imgCape]   [#imgCharacter]  [#imgBody]    [#imgSword]
(Z: -40px)    (Z: -20px)    (Base/States)   (Z: +10px)    (Z: +15px)
 (Spinning)   (Swaying)      (Hover/Tilt)   (Breathing)   (Crimson Glow)
                                  │
                   ┌──────────────┴──────────────┐
                   │                             │
              [#imgHead]                    [#imgEyes]
              (Z: +25px)                    (Z: +35px)
             (Armor Helm)              (Variable Glow CSS)
                                                 │
                                           [#imgEnergy]
                                            (Z: +45px)
                                         (Embers/Particles)
```

---

## 2. Asset Extraction & Alpha Processing

1. **Artwork Provenance**:
   - Source artwork was sourced from high-resolution character turnarounds, UI mockups, and state sheets provided in the project artifact directory (`.user_uploaded/` and `brain/`).
2. **True Alpha Transparency (`black_to_transparent`)**:
   - Because raw source graphics were created against deep black or studio backgrounds, an un-premultiplication alpha channel pipeline (`desktop-companion/extract_assets.py`) was applied.
   - Preserves high-density metallic armor plating at 100% opacity (`alpha = 255`).
   - Linearly feather-interpolates dark edges and luminous crimson embers down to zero opacity (`alpha = 0`), completely eliminating halos, white matte lines, or checkerboard artifacts.
3. **Automated Validation**:
   - `desktop-companion/validate_assets.py` inspects all 18 PNG files:
     - Verifies format is PNG and mode is RGBA.
     - Confirms true transparency exists (`alpha.min() == 0`).
     - Checks dimension constraints and file existence.

---

## 3. Directory Structure & Asset Specifications

All assets reside in `desktop-companion/assets/igris/`:

```
desktop-companion/assets/igris/
├── base/
│   ├── body.png        (682x1024, RGBA) - Main torso & leg armor plates
│   ├── head.png        (948x938, RGBA)  - Armored knight helmet & visor
│   ├── eyes.png        (1024x344, RGBA) - Crimson ocular glow mask
│   ├── cape.png        (1024x904, RGBA) - Shadow fabric cape / pauldrons
│   ├── sword.png       (93x185, RGBA)   - Dark energy broadsword
│   └── effects.png     (140x130, RGBA)  - Peripheral plasma distortion
├── states/
│   ├── idle/character.png       (128x210, RGBA) - Relaxed guardian posture
│   ├── listening/character.png  (128x210, RGBA) - Alert forward-lean pose
│   ├── thinking/character.png   (128x210, RGBA) - Contemplative energy charge
│   ├── executing/character.png  (128x210, RGBA) - Action-ready command posture
│   ├── speaking/character.png   (128x210, RGBA) - Vocalizing energy modulation
│   ├── success/character.png    (128x210, RGBA) - Resonant crimson triumph aura
│   ├── error/character.png      (128x210, RGBA) - Unstable crimson flare
│   └── offline/character.png    (128x210, RGBA) - Desaturated low-power stance
├── particles/
│   ├── energy.png      (165x130, RGBA)  - Rising core mana flame
│   ├── sparks.png      (122x130, RGBA)  - Dispersed red embers
│   ├── fragments.png   (115x65, RGBA)   - Shattered shadow armor shards
│   └── aura.png        (140x130, RGBA)  - Radial ground summoning ring
├── images/
│   ├── hero.png        (512x512, RGBA)  - Full body master portrait
│   └── badge.png       (512x512, RGBA)  - Armored emblem graphic
├── icon.png            (512x512, RGBA)  - High-res Windows app icon
└── manifest.json       (JSON)           - Layer configuration & timings
```

---

## 4. 2.5D Layer Rig & Parallax Engine

- **Perspective Viewport**:
  - `#companionViewport` configures `perspective: 1000px`.
  - `#characterRig` uses `transform-style: preserve-3d; transition: transform 0.12s ease-out;`.
- **Mouse Parallax**:
  - Pointer movements across the companion compute normalized offsets `(-1.0 to +1.0)`.
  - Tilts the central character rig up to `±8deg` pitch and `±10deg` yaw.
  - Multi-layer depth offsets shift foreground elements (Eyes: Z=+35px, Head: Z=+25px) faster than background elements (Cape: Z=-20px, Aura: Z=-40px), generating genuine 2.5D parallax depth.
- **Ambient Levitation & Aura**:
  - `levitateFloat`: Continuous 4.5s sinusoidal hovering animation.
  - `spinAura`: Elliptical ground rotation creating a perpetual dark-energy foundation.

---

## 5. Visual State Synchronization

The companion updates visually via `window.companionAPI.onStateChange(state)`:

| State | Character Asset | Eye Glow Styling | Animation Behavior |
| :--- | :--- | :--- | :--- |
| **IDLE** | `states/idle/character.png` | `drop-shadow(0 0 6px #ff1a1a)` | Subtle breathing, low-intensity aura |
| **LISTENING** | `states/listening/character.png` | `drop-shadow(0 0 16px #ff0033)` | Fast pulse (0.75s), attentive stance |
| **THINKING** | `states/thinking/character.png` | `drop-shadow(0 0 14px #ff3b30)` | Shimmering ocular charge cycle |
| **EXECUTING** | `states/executing/character.png` | `drop-shadow(0 0 22px #ff2a2a)` | Fast oscillation (0.45s), aura flared |
| **SPEAKING** | `states/speaking/character.png` | `drop-shadow(0 0 18px #ff4d4d)` | Audio-reactive waveform modulation |
| **SUCCESS** | `states/success/character.png` | `drop-shadow(0 0 25px #00ff88)` | Emerald/crimson triumph flare |
| **ERROR** | `states/error/character.png` | `drop-shadow(0 0 25px #ff0055)` | Rapid glitch jitter & alert flare |
| **OFFLINE** | `states/offline/character.png` | `opacity: 0.15; filter: grayscale(1)` | Dim dormant low-power mode |

---

## 6. Packaging & Distribution Pipeline

- **Tooling**: Built using `electron-builder` (`v25.1.8`).
- **Configuration (`package.json`)**:
  ```json
  "build": {
    "appId": "com.jarvis.igris-companion",
    "productName": "IGRIS Companion",
    "win": {
      "target": ["portable", "dir"],
      "icon": "assets/igris/icon.png"
    },
    "files": [
      "main.js",
      "preload.js",
      "index.html",
      "styles.css",
      "renderer.js",
      "assets/**/*"
    ]
  }
  ```
- **Distribution Output**:
  - Output Directory: `D:\JARVIS\desktop-companion\dist\win-unpacked\`
  - Binary: `IGRIS Companion.exe`
  - Bundled Archives: All 18 PNG assets verified inside `resources/app.asar`.

---

## 7. Security & Compatibility Invariants

1. **Complete Removal of Placeholders**:
   - Zero SVG polygon, vector, or geometric stick figures remain in the production DOM.
   - If an asset fails to load, the engine logs an explicit developer warning without falling back to crude shapes.
2. **Context Isolation**:
   - Renderer processes have no direct Node.js or OS shell access.
   - All interactions route through `contextBridge` in `preload.js`.
3. **No Regressions**:
   - Seamlessly binds to the existing Socket.IO backend (`/companion` or default namespace).
   - Compatible with Phase 1 through Phase 13.

---

## 8. Verification & Test Summary

- **Asset Validation (`desktop-companion/validate_assets.py`)**: 18/18 Assets Validated (100% Pass).
- **Phase 13.5 Suite (`test-phase13.5.py`)**: 24/24 Tests Passed (100% Pass).
- **Phase 13 Suite (`test-phase13.py`)**: 30/30 Tests Passed (100% Pass).
- **Full System Regression (`run-all-tests.py`)**: 100% Passed across Phases 2, 3, 4, 5, 6, 7, 8, 9, 9.5, 10, 11, 12, 13, and 13.5.
