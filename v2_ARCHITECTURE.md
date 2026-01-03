# LastLook v2.0: Architecture & Technical Specs

**Status:** Prototype (Traffic Light Logic Working)
**Stack:** Tauri (Rust) + React (TypeScript) + Tailwind CSS
**Date:** January 2, 2026

---

## 1. High-Level Architecture

LastLook v2 uses a **Hybrid Architecture**:

1.  **Frontend (The Face):** A React Single Page Application (SPA) running in a system WebView. It handles all UI, State, and Animations.
2.  **Backend (The Muscle):** A Rust binary that acts as the "Sidecar." It handles heavy I/O, File System access, and Shell commands (FFmpeg).
3.  **The Bridge:** Tauri's IPC (Inter-Process Communication) allows React to call Rust functions asynchronously.

### The Stack

- **Language:** TypeScript (Frontend) / Rust (Backend)
- **Build Tool:** Vite (Fast HMR)
- **Styling:** Tailwind CSS v4.0 (Utility-first)
- **State Management:** React State (Migration to Zustand planned)

---

## 2. Current Implementation (The "God Component")

_As of Commit "Traffic Light Logic Working"_

Currently, all logic resides in `src/App.tsx`.

- **Imports:** `@tauri-apps/plugin-fs` (Reading Disk), `@tauri-apps/plugin-dialog` (Native Picker).
- **State:**
  - `sourcePath`: String (Selected Folder Path)
  - `destPath`: String (Backup Destination Path)
  - `fileList`: Array of `DirEntry` (Files in Source)
  - `destFiles`: Set<String> (Files in Dest - optimized for O(1) lookup)
- **Logic:**
  - `useEffect` triggers a scan of Destination whenever `destPath` changes.
  - **Traffic Light:** Iterates through `fileList` and checks `destFiles.has(name)` to determine Green/Red status.

---

## 3. The Refactor Plan (Next Steps)

We are moving away from the monolithic `App.tsx` to a modular structure.

### 3.1 Directory Structure

```text
src/
├── components/          # "Dumb" UI Elements (Presentation only)
│   ├── Layout.tsx       # The 3-Pane Grid
│   ├── FileRow.tsx      # A single file item (Traffic Light logic)
│   ├── Button.tsx       # Reusable styled buttons
│   └── Badge.tsx        # "CONNECTED" / "MISSING" badges
├── hooks/               # "Smart" Logic (Data only)
│   ├── useFileSystem.ts # Handles scanning and scanning logic
│   └── useTransfer.ts   # Will handle the copy process
├── store/               # Global State
│   └── appState.ts      # (Zustand) Holds sourcePath, destPath
└── App.tsx              # Main entry, strictly for Layout composition
```

### 3.2 The Data Flow

1.  **User** clicks "Select Source" -> Calls `useFileSystem`.
2.  **`useFileSystem`** calls Tauri `plugin-dialog`.
3.  **Result** is stored in `appState`.
4.  **`FileList` Component** reads `appState` and renders `FileRow` components.

---

## 4. Style Guide (Tailwind)

- **Backgrounds:** `bg-zinc-950` (App BG), `bg-zinc-900` (Panels)
- **Borders:** `border-zinc-800`
- **Text:** `text-zinc-300` (Body), `text-zinc-100` (Headers)
- **Accents:**
  - **Success:** `text-emerald-400`, `bg-emerald-500`
  - **Error:** `text-red-400`, `bg-red-500`
  - **Folder:** `text-blue-400`, `bg-blue-500`

---

## 5. Rust Capabilities (To Be Ported)

Features currently in Python (v1.0) that need Rust implementations:

- [ ] **MD5 Hashing:** Need a threaded Rust function to hash files without freezing the UI.
- [ ] **FFmpeg Bridge:** Need `Command::new("ffmpeg")` logic to generate thumbnails.
- [ ] **Transfer Engine:** Need a buffer-controlled Copy function to report progress.
