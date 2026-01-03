# LastLook v2.0: Architecture & Technical Specs

**Status:** Alpha (Inspector Functional)
**Stack:** Tauri (Rust) + React (TypeScript) + Tailwind CSS + Zustand
**Date:** January 2, 2026

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
  - **Dependencies:** `FileList.tsx`, `Inspector.tsx`, `useFileSystem`, `appStore`
- **`App.css`**
  - **Purpose:** Entry point for Tailwind directives (`@import "tailwindcss"`).
  - **Dependencies:** Tailwind

#### Components (`src/components/`)

_Pure UI elements (Presentation Layer)._

- **`FileList.tsx`**
  - **Purpose:** Renders the scrollable list of files OR the "Select Source" empty state.
  - **Dependencies:** `FileRow.tsx`, `DirEntry` (type), `appStore`
- **`FileRow.tsx`**
  - **Purpose:** Renders a single file row. Contains the "Traffic Light" logic (Green/Red dot) and click handlers.
  - **Dependencies:** `DirEntry` (type)
- **`Inspector.tsx`**
  - **Purpose:** Displays metadata (Size, Date, Preview) for the currently selected file. Handles `fs.stat` calls and error reporting.
  - **Dependencies:** `appStore`, `@tauri-apps/plugin-fs`

#### Hooks (`src/hooks/`)

_Reusable Logic Layer._

- **`useFileSystem.ts`**
  - **Purpose:** The Bridge between React and Tauri. Handles opening dialogs and scanning folders.
  - **Dependencies:** `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `appStore`

#### Store (`src/store/`)

_Global State Management._

- **`appStore.ts`**
  - **Purpose:** The Single Source of Truth. Holds `sourcePath`, `destPath`, `fileList`, and `selectedFile`.
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
  - **Purpose:** Registers plugins (`tauri-plugin-fs`, `tauri-plugin-dialog`).

---

## 3. Data Flow

1.  **Action:** User clicks "Select Source" in UI.
2.  **Hook:** `useFileSystem.selectSource()` is called.
3.  **Bridge:** Calls Tauri `dialog.open()`.
4.  **Backend:** Rust opens Windows native picker.
5.  **State:** Path is saved to `appStore`.
6.  **Reaction:** `FileList` component re-renders because it subscribes to `appStore`.
7.  **Interaction:** User clicks a file -> `selectedFile` updates -> `Inspector` fetches metadata via `fs.stat`.

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

### 🔮 Phase 4: Rust Backend (The Engine)

- [x] **Custom Commands:** Create `src-tauri/src/lib.rs` functions accessible from React.
- [x] **MD5 Hashing:** Multithreaded file verification (CPU-intensive task moved to Rust).
- [ ] **Transfer Loop:** The actual copy process (with buffer control and progress updates).
