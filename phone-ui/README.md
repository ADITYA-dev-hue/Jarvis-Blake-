# JARVIS Mobile Control UI (Phase 2)

A mobile-first control dashboard for the JARVIS personal phone-to-laptop control system, built with React, TypeScript, Tailwind CSS, Vite, and Socket.IO.

---

## Architecture

```text
📱 Phone Browser (Vite / React)
       │
       │ Socket.IO (role: "phone")
       ▼
🌐 Node.js JARVIS Server
       │
       │ Socket.IO (role: "agent")
       ▼
💻 Python Laptop Agent
       │
       ▼
🛡️ Safe Command Engine
```

The phone interface connects strictly to the Node.js JARVIS Server. It never communicates directly with the Python laptop agent or executes arbitrary commands.

---

## Prerequisites

- Node.js v18+ (tested on Node.js v25)
- Running JARVIS Node.js Server on port 3000
- Connected and authenticated Laptop Agent (`LAPTOP-01`)

---

## Setup & Running

### 1. Install Dependencies

```bash
cd phone-ui
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configuration variables:

```ini
# URL to the Node.js JARVIS Server
VITE_JARVIS_SERVER_URL=http://localhost:3000

# Development authentication token for the Phone UI
VITE_JARVIS_PHONE_TOKEN=jarvis_phone_dev_token_884192
```

> **For Mobile Phone Testing on Wi-Fi:**
> 1. Find your laptop's Wi-Fi IPv4 address using `ipconfig` (e.g., `192.168.1.100`).
> 2. Change `VITE_JARVIS_SERVER_URL=http://192.168.1.100:3000`.
> 3. Start the dev server with `npm run dev` (runs on `0.0.0.0:5173`).
> 4. Open `http://192.168.1.100:5173` on your phone browser.

### 3. Start Development Server

```bash
npm run dev
```

---

## Features

- **Futuristic HUD Design:** Dark palette, cyan glow accents, glassmorphic panels, and responsive layout.
- **Dual Connectivity Badges:** Distinguishes between Server connection (`ONLINE`/`OFFLINE`) and Laptop Agent status (`ONLINE`/`OFFLINE`).
- **Safe Quick Actions:**
  - `System Status` (live CPU %, RAM %, Disk %, OS telemetry)
  - `Open VS Code` (`open_app` with `app: "code"`)
  - `Open GitHub` (`open_url` with `url: "https://github.com"`)
  - `Open Notepad` (`open_app` with `app: "notepad"`)
  - `Create Folder` (modal with safe relative path validation)
- **Recent Commands History:** Local timestamped command audit log with status badges and error details.
- **Error Handling & Protection:** User-friendly toasts for security blocks, timeouts, and offline states.
- **Microphone Pill:** Visually present but disabled: *"Voice — Coming in Phase 4"*.
