# LastLook v2.0: Architecture & Technical Specs

**Status:** Beta (Batch & Sync Logic Active)
**Stack:** Tauri (Rust) + React (TypeScript) + Tailwind CSS + Zustand
**Date:** January 3, 2026

---

## 1. High-Level Architecture

LastLook v2 uses a **Hybrid Architecture**:

1.  **Frontend (The Face):** A React Single Page Application (SPA).
2.  **Backend (The Muscle):** A Rust binary acting as the "Sidecar" for File I/O.
3.  **State (The Brain):** A Global Zustand Store (`appStore`) that creates a Single Source of Truth.

### The Stack

- **Language:** TypeScript (Frontend) / Rust (Backend)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4.0
- **State:** Zustand

---

## 2. Directory Structure & File Glossary

### 2.1 Root Configuration

_Files that control the build environment._

| File                     | Purpose                                                                 | Dependencies           |
| :----------------------- | :---------------------------------------------------------------------- | :--------------------- |
| **`package.json`**       | Defines project scripts (`dev`, `build`) and installed libraries.       | Node.js                |
| **`vite.config.ts`**     | Configures the Vite build server. Handles Hot Module Replacement (HMR). | `vite`, `tauri`        |
| **`tsconfig.json`**      | Rules for the TypeScript compiler (strict mode, target version).        | TypeScript             |
| **`tailwind.config.js`** | Configures Tailwind's theme and content scanner.                        | Tailwind CSS           |
| **`postcss.config.js`**  | Configures the CSS post-processor (required for Tailwind v4).           | `@tailwindcss/postcss` |
| **`index.html`**         | The HTML entry point that loads the React JavaScript bundle.            | -                      |

### 2.2 Source Code (`src/`)

_The React Frontend logic._

#### Entry & Layout

- **`main.tsx`**
  - **Purpose:** Bootstraps React and mounts it to the DOM.
  - **Dependencies:** `react-dom/client`, `App.tsx`
- **`App.tsx`**
  - **Purpose:** The main layout container (Source/Dest/Inspector Grid). It composes the UI but contains **no logic**.
  - **Dependencies:** `FileList.tsx`, `DestFileList.tsx`, `Inspector.tsx`, `useFileSystem`, `appStore`
- **`App.css`**
  - **Purpose:** Entry point for Tailwind directives (`@import "tailwindcss"`).
  - **Dependencies:** Tailwind

#### Components (`src/components/`)

_Pure UI elements (Presentation Layer)._

- **`FileList.tsx`**
  - **Purpose:** Renders the scrollable list of source files OR the "Select Source" empty state.
  - **Dependencies:** `FileRow.tsx`, `DirEntry` (type), `appStore`
- **`DestFileList.tsx`**
  - **Purpose:** Renders the destination file list. Supports auto-scrolling and synced highlighting.
  - **Dependencies:** `appStore`
- **`FileRow.tsx`**
  - **Purpose:** Renders a single file row. Contains the "Traffic Light" logic (Green/Red dot), Checkboxes, and click handlers.
  - **Dependencies:** `DirEntry` (type)
- **`Inspector.tsx`**
  - **Purpose:** Displays metadata (Size, Date, Preview) for the currently selected file. Handles `fs.stat` calls and batch size calculations.
  - **Dependencies:** `appStore`, `@tauri-apps/plugin-fs`

#### Hooks (`src/hooks/`)

_Reusable Logic Layer._

- **`useFileSystem.ts`**
  - **Purpose:** The Bridge between React and Tauri. Handles opening dialogs, scanning folders, and mounting destinations.
  - **Dependencies:** `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `appStore`
- **`useTransfer.ts`**
  - **Purpose:** The Controller. Manages the transfer loop, listens for Rust events (`transfer-progress`), and enforces batch selection rules.
  - **Dependencies:** `appStore`, `@tauri-apps/api/core`

#### Store (`src/store/`)

_Global State Management._

- **`appStore.ts`**
  - **Purpose:** The Single Source of Truth. Holds `sourcePath`, `destPath`, `fileList`, `destFiles`, `verifiedFiles`, `checkedFiles` (Batch), and `selectedFile`.
  - **Dependencies:** `zustand`

### 2.3 Backend (`src-tauri/`)

_The Rust Core._

- **`tauri.conf.json`**
  - **Purpose:** Configures window size, permissions, and bundle identifiers (`com.lastlook.app`).
- **`capabilities/default.json`**
  - **Purpose:** Security rules defining what the frontend is allowed to do.
  - **Permissions:**
    - `fs:default` (Read/Write files)
    - `fs:allow-stat` (Read Metadata like Size/Date)
    - `dialog:default` (Open System Pickers)
- **`src/main.rs`**
  - **Purpose:** The Rust entry point. Spins up the WebView.
- **`src/lib.rs`**
  - **Purpose:** The Engine. Contains:
    - `calculate_hash`: Independent MD5 check.
    - `copy_file`: Pipelined Transfer + Verification loop (Read -> Hash -> Write -> Read -> Verify).

---

## 3. Data Flow

1.  **Action:** User clicks "Select Source" in UI.
2.  **Hook:** `useFileSystem.selectSource()` is called.
3.  **Bridge:** Calls Tauri `dialog.open()`.
4.  **Backend:** Rust opens Windows native picker.
5.  **State:** Path is saved to `appStore`.
6.  **Reaction:** `FileList` component re-renders because it subscribes to `appStore`.
7.  **Interaction:** User checks a box -> `checkedFiles` Set updates -> `Inspector` calculates total batch size via `fs.stat`.

---

## 4. Style Guide (Tailwind)

- **Backgrounds:** `bg-zinc-950` (App BG), `bg-zinc-900` (Panels)
- **Borders:** `border-zinc-800`
- **Text:** `text-zinc-300` (Body), `text-zinc-100` (Headers)
- **Accents:**
  - **Success:** `text-emerald-400`, `bg-emerald-500` (Synced)
  - **Error:** `text-red-400`, `bg-red-500` (Missing)
  - **Folder:** `text-blue-400`, `bg-blue-500` (Directory)

---

## 5. Implementation Roadmap

### ✅ Phase 1: Foundation (Completed)

- [x] Initialize Tauri v2 + React + TypeScript.
- [x] Configure Tailwind v4.0.
- [x] Implement 3-Pane Layout.

### ✅ Phase 2: The Core Logic (Completed)

- [x] **Source Bridge:** Open Native Folder Dialog.
- [x] **File System:** Read directory contents.
- [x] **Traffic Light:** "Call and Response" comparison logic.
- [x] **Refactor:** Break `App.tsx` into Components, Hooks, and Store.

### ✅ Phase 3: The Inspector (Completed)

- [x] **Selection State:** Track which file is clicked.
- [x] **Metadata Display:** Show File Size and Date in the right panel.
- [x] **Error Handling:** Graceful failure/reporting for permissions.
- [x] **Security:** Enable `fs:allow-stat` capability.

### ✅ Phase 4: Rust Backend (The Engine) (Completed)

- [x] **Custom Commands:** Create `src-tauri/src/lib.rs` functions.
- [x] **MD5 Hashing:** Multithreaded file verification.
- [x] **Transfer Loop:** The copy process with progress events.
- [x] **Real-Time UI:** `useTransfer` hook updates the Traffic Lights instantly.

### ✅ Phase 5: Verification & Polish (Completed)

- [x] **xxHash/MD5 Integration:** Hashing occurs _during_ the transfer stream.
- [x] **Verification Logic:** Compare Source Hash vs. Dest Hash.
- [x] **UI Cleanup:** Remove debug buttons.
- [x] **Verified Badge:** Show a Shield icon for confirmed transfers.

### ✅ Phase 6: The Batch Commander (Completed)

_Goal: Restore v1 Parity for Selection & Stats._

- [x] **Checkbox System:** Add multi-select checkboxes to `FileRow`.
- [x] **Batch Store:** Update `appStore` to track a Set of `selectedFileIds`.
- [x] **Smart Select:** "Select All Missing" button.
- [x] **Batch Stats:** Calculate "Total Size" of selected files in Inspector.
- [x] **Synced Highlight:** Clicking a file highlights it in both Source & Dest lists.
- [x] **Cleanup:** Remove the debug "Generate Hash" button.

### 🔮 Phase 7: The Controller

_Goal: Performance Optimization & Flow Control._

- [ ] **I/O Optimization:** Increase buffer size (1MB -> 64MB) to maximize disk throughput.
- [ ] **Async Verification:** Decouple the final MD5 check from the UI thread so the app remains responsive during validation.
- [ ] **Cancel/Pause Logic:** Implement a Rust `Receiver` channel (using `tokio::sync::mpsc` or `std::sync::mpsc`) to interrupt the loop when the user clicks Stop.
- [ ] **Job Modal:** A persistent status bar (or modal) that displays progress even if the user navigates away or changes selection.
- [ ] **Overwrite Protection:** Add a pre-flight check to warn the user before overwriting existing files in the Destination.

### 🔮 Phase 8: The Visualizer

_Goal: Media features powered by FFmpeg._

- [ ] **Sidecar Binary Integration:** Bundle `ffmpeg.exe` and `ffprobe.exe` with the Tauri installer.
- [ ] **Thumbnail Generator:** Create a background command to extract a frame at 00:01 and cache it for the Inspector.
- [ ] **Advanced Metadata:** Use `ffprobe` to extract Resolution, Codec, Bitrate, and Frame Rate info.
- [ ] **Comparators:** A "Compare Mode" that places the Source and Destination files side-by-side visually to verify quality manually.
