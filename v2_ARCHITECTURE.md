# LastLook v2.0: Architecture & Technical Specs

**Status:** Beta (Job Manager & Safety Active)
**Stack:** Tauri (Rust) + React (TypeScript) + Tailwind CSS + Zustand
**Date:** January 4, 2026

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
  - **Purpose:** The main layout container (Source/Dest/Inspector Grid). Replaces the static footer with the `JobDrawer`.
  - **Dependencies:** `FileList`, `DestFileList`, `Inspector`, `JobDrawer`, `useFileSystem`, `appStore`
- **`App.css`**
  - **Purpose:** Entry point for Tailwind directives (`@import "tailwindcss"`) and Custom Keyframe Animations (e.g., `.progress-stripe`).
  - **Dependencies:** Tailwind

#### Components (`src/components/`)

_Pure UI elements (Presentation Layer)._

- **`FileList.tsx`**
  - **Purpose:** Renders the scrollable list of source files OR the "Select Source" empty state. Passes `hasDest` state to rows. Implements "Snap-To" scrolling via refs.
  - **Dependencies:** `FileRow.tsx`, `DirEntry` (type), `appStore`
- **`DestFileList.tsx`**
  - **Purpose:** Renders the destination file list. Supports auto-scrolling, synced highlighting, and neutral state (Grey dots) when no Source is active.
  - **Dependencies:** `appStore`
- **`FileRow.tsx`**
  - **Purpose:** Renders a single file row. Contains the "Traffic Light" logic (Green/Yellow/Red/Grey dot), Checkboxes, and click handlers. Wrapped in `forwardRef`.
  - **Dependencies:** `DirEntry` (type)
- **`Inspector.tsx`**
  - **Purpose:** Displays metadata (Size, Date, Preview) for the currently selected file. Handles `fs.stat` calls and batch size calculations.
  - **Dependencies:** `appStore`, `@tauri-apps/plugin-fs`
- **`ConflictModal.tsx`**
  - **Purpose:** A modal dialog that appears when source files already exist in the destination. Offers options to "Overwrite All", "Skip Existing", or "Cancel".
  - **Dependencies:** None (Pure UI)
- **`JobDrawer.tsx`**
  - **Purpose:** The expandable bottom sheet that acts as the transfer controller. Displays Micro (File) & Macro (Batch) progress, live speed/ETA, and the transfer manifest.
  - **Dependencies:** `appStore`, `formatters`

#### Hooks (`src/hooks/`)

_Reusable Logic Layer._

- **`useFileSystem.ts`**
  - **Purpose:** The Bridge between React and Tauri. Handles opening dialogs, scanning folders, and mounting destinations.
  - **Dependencies:** `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `appStore`
- **`useTransfer.ts`**
  - **Purpose:** The Controller. Manages the transfer loop, listens for Rust events (`transfer-progress`, `transfer-verifying`), handles Cancellation logic, performs Pre-Flight Conflict Checks, calculates Live Math (Speed/ETA), and enforces batch selection rules.
  - **Dependencies:** `appStore`, `@tauri-apps/api/core`

#### Store (`src/store/`)

_Global State Management._

- **`appStore.ts`**
  - **Purpose:** The Single Source of Truth. Holds `sourcePath`, `destPath`, `fileList`, `destFiles`, `verifiedFiles`, `verifyingFiles` (Amber State), `checkedFiles` (Batch), `conflicts` (Safety), `batchTotalBytes`, `completedBytes`, and `transferStartTime`.
  - **Dependencies:** `zustand`

#### Utils (`src/utils/`)

_Shared helper functions._

- **`formatters.ts`**
  - **Purpose:** Standardizes data display across the app.
  - **Exports:** `formatSize` (Bytes -> GB), `formatDate` (Timestamp -> String), `formatDuration` (ms -> HH:MM:SS).

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
    - `calculate_hash`: High-performance xxHash (xxh3) check using 64MB buffers.
    - `copy_file`: Pipelined Transfer + Verification loop. Emits `transfer-verifying` event between phases. Resets abort flag on start.
    - `cancel_transfer`: Sets atomic flag to interrupt active transfers.

---

## 3. Data Flow

1.  **Action:** User clicks "Select Source" in UI.
2.  **Hook:** `useFileSystem.selectSource()` is called.
3.  **Bridge:** Calls Tauri `dialog.open()`.
4.  **Backend:** Rust opens Windows native picker.
5.  **State:** Path is saved to `appStore`.
6.  **Reaction:** `FileList` component re-renders. Dots appear **Grey** (Neutral) until Dest is selected.
7.  **Action:** User clicks "Transfer".
8.  **Logic:** `useTransfer` performs **Pre-Flight Check**.
    - _Conflict:_ `ConflictModal` opens. User selects "Overwrite" or "Skip".
    - _No Conflict:_ Transfer begins.
9.  **Logic:** `useTransfer` calculates `batchTotalBytes` and sets `transferStartTime`.
10. **Event:** Rust emits `transfer-progress` -> `JobDrawer` updates "Micro" bar (Green) and "Macro" bar (Blue) via Live Math.
11. **Event:** Rust emits `transfer-verifying` -> `JobDrawer` updates UI to **Striped Yellow** (Verifying).
12. **Completion:** Verification passes -> UI updates to **Green** dot + Shield.

---

## 4. Style Guide (Tailwind)

- **Backgrounds:** `bg-zinc-950` (App BG), `bg-zinc-900` (Panels)
- **Borders:** `border-zinc-800`
- **Text:** `text-zinc-300` (Body), `text-zinc-100` (Headers)
- **Accents:**
  - **Success:** `text-emerald-400`, `bg-emerald-500` (Synced/Verified)
  - **Verifying:** `text-yellow-400`, `bg-yellow-500` (Pending Integrity Check)
  - **Error:** `text-red-400`, `bg-red-500` (Missing)
  - **Neutral:** `text-zinc-500`, `bg-zinc-600` (No Drive Connected)
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
- [x] **Hashing:** Multithreaded file verification (Upgraded to xxHash in Phase 7).
- [x] **Transfer Loop:** The copy process with progress events.
- [x] **Real-Time UI:** `useTransfer` hook updates the Traffic Lights instantly.

### ✅ Phase 5: Verification & Polish (Completed)

- [x] **Hashing Integration:** Hashing occurs _during_ the transfer stream.
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

### ✅ Phase 7: The Controller (Core Logic Completed)

_Goal: Performance Optimization & Flow Control._

- [x] **I/O Optimization:** Increase buffer size (1MB -> 64MB) and switch to xxHash engine.
- [x] **Async Verification:** Decouple verification from transfer loop using `transfer-verifying` event.
- [x] **Amber UI:** "Yellow Dot" and Striped Progress Bar for "Verifying" state.
- [x] **Cancel/Pause Logic:** Implement a Rust `Receiver` channel (using `AtomicBool`) to interrupt the loop when the user clicks Stop.
- [x] **Overwrite Protection:** Add a pre-flight check to warn the user before overwriting existing files in the Destination.
- [x] **Job Drawer (Core):** Implemented the expandable footer with Global Metrics (Micro/Macro progress) and Live Math.

### 🔮 Phase 7.5: UX Refinement & Layout Physics (Sprints)

_Goal: Address User Feedback, Fix Layout Glitches, and Improve Data Visualization._

#### Sprint 1: Physics & Layout (The "Glitch" Fixes)

- [ ] **Fix "Ground Breaking" Scroll:** Replace aggressive `scrollIntoView` with container-contained scroll logic to prevent the main Window/Header from shifting off-screen.
- [ ] **Fix Drawer Overlap:** Refactor `App.tsx` layout to use Flex-Column. The Drawer should physically push the list content up (reducing container height) rather than floating on top (`absolute` vs `flex`).
- [ ] **Drawer State Logic:** Decouple Drawer visibility from transfer state. Allow user to expand/collapse Drawer in "Idle" mode and ensure it stays open/closed based on user preference, not just transfer status.

#### Sprint 2: Data Logic & Features

- [ ] **Orphan Logic (The "Green Ghost"):** Update `DestFileList` to differentiate between "Synced" (Green) and "Orphan/Dest Only" (Red/Grey). Files in Dest but not Source should not be Green.
- [ ] **Swap Sources Button:** Add a utility button to swap `SourcePath` and `DestPath` variables to reverse transfer direction.
- [ ] **Destination Filters:** Add a toggle to `DestFileList` to show "All Files" vs "Synced Only".
- [ ] **Empty Space Fix:** Ensure the bottom of the application is properly sealed so scrolling doesn't reveal the "void" beneath the UI.

### 🔮 Phase 8: The Visualizer

_Goal: Media features powered by FFmpeg._

- [ ] **Sidecar Binary Integration:** Bundle `ffmpeg.exe` and `ffprobe.exe` with the Tauri installer.
- [ ] **Thumbnail Generator:** Create a background command to extract a frame at 00:01 and cache it for the Inspector.
- [ ] **Advanced Metadata:** Use `ffprobe` to extract Resolution, Codec, Bitrate, and Frame Rate info.
- [ ] **Comparators:** A "Compare Mode" that places the Source and Destination files side-by-side visually to verify quality manually.
