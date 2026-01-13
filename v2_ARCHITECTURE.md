# LastLook v2.0: Architecture & Technical Specs

**Status:** Release Candidate 3 (UX Polish & Bug Fixes - Stable)
**Stack:** Tauri (Rust) + React (TypeScript) + Tailwind CSS + Zustand
**Date:** January 8, 2026

---

## 1. High-Level Architecture

LastLook v2 uses a **Hybrid Architecture** enhanced with a **Sidecar Pattern**:

1.  **Frontend (The Face):** A React Single Page Application (SPA).
2.  **Backend (The Muscle):** A Rust binary handling IO, Hashing, and Threading.
3.  **Sidecar (The Eyes):** An external **FFmpeg** binary managed by Tauri to generate media thumbnails.
4.  **State (The Brain):** A Global Zustand Store (`appStore`) acting as the Single Source of Truth.

### The Stack

- **Language:** TypeScript (Frontend) / Rust (Backend)
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4.0
- **State:** Zustand
- **Media Engine:** FFmpeg (Static Binary)

### 1.1 Quick Start for Developers

1.  **Prerequisites:** Install [Node.js](https://nodejs.org/) and [Rust](https://www.rust-lang.org/tools/install).
2.  **Setup:** Run `npm install` in the root directory.
3.  **Binaries:** Download FFmpeg/FFprobe (see **Section 7.1** for critical renaming instructions) and place them in `src-tauri/binaries/`.
4.  **Run:** Execute `npm run tauri dev` to launch the app in debug mode.

---

## 2. Directory Structure & File Glossary

### 2.1 Root Configuration

_Files that control the build environment, dependency management, and compiler settings._

| File                            | Purpose                                                                                                                                                                                                                                    | Dependencies           |
| :------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------- |
| **`package.json`**              | Manifest file defining project scripts and dependencies.<br>• **`dev`**: Runs `vite` for HMR development.<br>• **`tauri`**: Wraps the Tauri CLI (`tauri dev`, `tauri build`).<br>• **`build`**: Runs `tsc` (Type check) then `vite build`. | Node.js                |
| **`vite.config.ts`**            | Configures the Vite build server. Handles proxying to the Tauri backend during dev and sets specific build targets (e.g., `esnext`) to ensure compatibility with the WebView's native capabilities.                                        | `vite`, `tauri`        |
| **`tsconfig.json`**             | Rules for the TypeScript compiler.<br>• **`strict: true`**: Enforces type safety.<br>• **`jsx: react-jsx`**: Enables React syntax.<br>• **`target: ESNext`**: Compiles for modern WebView renderers.                                       | TypeScript             |
| **`tailwind.config.js`**        | Configures Tailwind's theme and content scanner. Defines custom paths to ensure all `.tsx` files are scanned for utility classes during the build process.                                                                                 | Tailwind CSS           |
| **`postcss.config.js`**         | Configures the CSS post-processor. Specifically loads `@tailwindcss/postcss` to enable Tailwind v4 features.                                                                                                                               | `@tailwindcss/postcss` |
| **`index.html`**                | The entry point HTML file. Contains the `<div id="root"></div>` mount point and meta tags to disable zooming (`user-scalable=no`) for a native-app feel.                                                                                   | -                      |
| **`src-tauri/tauri.conf.json`** | **CRITICAL:** The Tauri manifest.<br>• **`bundle`**: Defines the unique ID (`com.lastlook.app`) and lists `externalBin` (FFmpeg/FFprobe).<br>• **`app`**: Sets default window size (1200x800) and security scopes (`assetProtocol`).       | Tauri Core             |

### 2.2 Source Code (`src/`)

_The React Frontend logic, split into semantic layers._

#### Entry & Layout

- **`main.tsx`**
  - **Purpose:** The application bootstrapper. Finds the root DOM element and hydrates the React tree inside `React.StrictMode`.
  - **Dependencies:** `react-dom/client`, `App.tsx`
- **`App.tsx`**
  - **Purpose:** The "Layout Frame". It creates the 3-column Flexbox grid (Source / Dest / Inspector) and handles global layout constraints (`h-screen`, `overflow-hidden`).
  - **Logic:**
    - **Drag & Drop Engine:** Uses `tauri://drag-drop` listener with `devicePixelRatio` normalization. Implements "Zone Math" (Source < 50% Width < Dest) to handle High-DPI scaling reliably. Supports "Intelligent Drop" where dropping a file auto-mounts the parent folder and selects the specific file.
    - **Startup Cleanup:** Triggers `clearTempCache` on mount to wipe previous session data.
    - **Drawer Reset:** Passes `key={transferStartTime}` to the `JobDrawer` component to force re-render on new jobs (Zombie Drawer Fix).
  - **Dependencies:** `FileList`, `DestFileList`, `Inspector`, `JobDrawer`, `useFileSystem`, `appStore`
- **`App.css`**
  - **Purpose:** Global styles and animation definitions.
  - **Key Rules:**
    - Imports `@theme` and `@utility` for Tailwind v4.
    - Defines `.progress-stripe` animation for the "Verifying" yellow bars.
    - Defines custom scrollbar styling (`.scrollbar-thin`).

#### Components (`src/components/`)

_Pure UI elements (Presentation Layer)._

- **`FileList.tsx`**
  - **Purpose:** Renders the source file list.
  - **Logic:**
    - **Virtualization/Refs:** Uses refs to manage scrolling behavior.
    - **Click-to-Deselect:** Wraps the list in a click handler that clears the selection if the user clicks the "empty space" background.
    - **Context:** Explicitly passes `origin="source"` to child rows to context-switch the Inspector logic.
  - **Visual Logic:**
    - **Standard:** Green Dot (Synced to Dest), Grey Dot (Not Synced).
    - **Verified Upgrade:** If a file exists in `destFiles` AND `manifestMap`, the dot is replaced by a **Green Shield**.
  - **Meaning:** "This file is safely backed up and verified. It is safe to delete from the source."
  - **Dependencies:** `FileRow.tsx`, `DirEntry` (type), `appStore`
- **`DestFileList.tsx`**
  - **Purpose:** Renders the destination file list with comparison logic.
  - **Logic:**
    - **Comparison:** Iterates through `destFiles` (Set) and compares against the Source list to determine file status (Synced vs Orphan).
    - **Filters:** Implements a local state toggle to "Hide Orphans" (files present in Dest but missing in Source).
    - **Visuals:** Renders "Green Dots" for synced files and "Red/Grey" indicators for orphans.
    - **Visual Logic:** Context-Aware Shields.
    - **Green Shield:** File is Verified in Manifest + Exists in current Source (Active Match).
    - **Red/Grey Dot:** File is in Destination but NOT in current Source (Orphan).
  - **UX Goal:** Prevents false positives. A "Green Shield" specifically implies an active, successful link between the currently connected drives.
  - **Dependencies:** `appStore`
- **`FileRow.tsx`**
  - **Purpose:** A memoized row component representing a single file.
  - **Logic:**
    - **Event Propagation:** Handlers use `e.stopPropagation()` to prevent clicks on checkboxes or the row itself from triggering the parent's "Deselect" background event.
    - **Traffic Light:** conditionally renders status dots (Green/Yellow/Red) based on the `verifiedFiles` and `verifyingFiles` Sets.
  - **Dependencies:** `DirEntry` (type)
- **`Inspector.tsx`**
  - **Purpose:** The details panel (Right Sidebar).
  - **Logic:**
    - **Hybrid Layout:** If a Batch is selected AND a specific file is clicked, it stacks the "Batch Header" (Macro stats) on top of the "File Preview" (Micro stats).
    - **Asset Protocol:** Transforms local paths into `asset://` URLs for secure image rendering.
    - **Advanced Metadata:** Triggers a Rust command to fetch `ffprobe` data (Codec, FPS) when a video file is mounted.
    - **Layout:** Enforced `w-[400px]` width with text truncation to accommodate long codec strings.
  - **Dependencies:** `appStore`, `@tauri-apps/plugin-fs`, `useMedia`
- **`ConflictModal.tsx`**
  - **Purpose:** A high-z-index overlay blocking interaction when naming collisions occur.
  - **Logic:** Provides 3 resolution paths: `Overwrite`, `Skip`, or `Cancel`. Maps directly to `useTransfer` resolution handlers.
- **`DeleteModal.tsx`** (The "Red Zone")
  - **Purpose:** The final safety barrier before data destruction.
  - **Logic:**
    - **Safety Check:** Before the delete button enables, the component iterates through the file list and performs a live `fs.exists()` check on the **Destination Drive**.
    - **Enforcement:** Only files that return `true` (confirmed physically present on backup right now) are allowed to be deleted.
- **`JobDrawer.tsx`**
  - **Purpose:** The persistent footer controller for active transfers.
  - **Logic:**
    - **State Isolation:** Maintains local state for the "Speed" and "ETA" ticker to prevent excessive global store re-renders.
    - **Ticker:** Runs a `setInterval` loop every **250ms**.
    - **Warm-up:** Ignores the first 250ms of data to prevent "Infinity" speed spikes, then calculates rolling average speed.
    - **Visuals:** Renders two progress bars: One for the current file (Micro) and one for the total batch (Macro).

#### Hooks (`src/hooks/`)

_Reusable Logic Layer encapsulating side effects._

- **`useFileSystem.ts`**
  - **Purpose:** Abstracts Tauri's File System plugins.
  - **Logic:**
    - **`scanDest(path)`**: Now performs a dual-scan.
      1. Reads the physical directory to populate `destFiles` (Physical Reality).
      2. Reads `lastlook_manifest.json` to populate `manifestMap` (Verification Truth).
    - **State Sync:** Ensures both physical presence and verification status are available to the UI simultaneously.
  - **Key Functions:**
    - `selectSource()`: Opens native folder picker.
    - `scanSource()`: Reads `DirEntry[]` and sorts folders-first.
    - `unmountDest()`: Clears the destination path from the Store.
    - **`clearTempCache()`**: Triggers the Rust backend to wipe the `lastlook_cache` folder (Auto-Clean).
  - **Dependencies:** `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`
- **`useTransfer.ts`**
  - **Purpose:** The core transfer engine controller.
  - **Logic:**
    - **Pre-flight:** Checks `checkedFiles` against `destFiles` to identify conflicts before starting.
    - **Event Loop:** Subscribes to `transfer-progress` (payload: bytes transferred) and `transfer-verifying` (payload: filename).
    - **State Management:** Updates the Store's `completedBytes` for the global progress bar.
    - **Responsiveness:** Manually sets `progress` to 100% immediately upon Rust command success to mask the async gap.
    - **Cleanup:** Triggers `resetJobMetrics()` after a 1-second delay to reset the UI.
    - **Session Metadata:** At the start of a transfer, fetches the Hostname, OS Type, and App Version to tag the manifest.
    - **Hash Capture:** Receiving the calculated `xxHash` string from the Rust backend's `copy_file` command upon success.
    - **Manifest Integration:** Calls `updateManifest()` immediately after a successful transfer to write the file's data and hash to the destination's JSON receipt.
    - **Reactive Logic:**
      - Immediately after `updateManifest` writes to disk, the hook calls `store.upsertManifestEntry()`.
      - **Purpose:** Ensures the UI (Shield Icons, Delete Buttons) reflects the new verification status instantly, preventing the need for a manual refresh.
  - **Dependencies:** `appStore`, `@tauri-apps/api/core`
- **`useMedia.ts`**
  - **Purpose:** Determines how to preview a selected file.
  - **Logic:**
    - **Extension Check:** Regex matches `.mp4`, `.mov`, `.png`, `.jpg`, etc.
    - **Thumbnailing:** If video, calls `invoke("generate_thumbnail")`.
    - **URL Gen:** Uses `convertFileSrc` to generate safe asset URLs.
    - **Cache:** Returns loading state while the sidecar generates the image.

#### Store (`src/store/`)

_Global State Management (Zustand)._

- **`appStore.ts`**
  - **Purpose:** The centralized database for the frontend.
  - **Key State Slices:**
    - **Paths:** `sourcePath`, `destPath`.
    - **Lists:** `fileList` (Source), `destFiles` (Set<String>).
    - **Job:** `checkedFiles` (Batch), `verifyingFiles` (Amber), `verifiedFiles` (Green).
    - **Metrics:** `batchTotalBytes`, `completedBytes`, `transferStartTime`.
  - **Key Actions:**
    - **`swapPaths()`**: Atomically swaps source/dest strings and wipes all file lists/sets to ensure data consistency.
    - **`resetJobMetrics()`**: Resets `transferStartTime` to `null` and bytes to `0`. This is the signal for the UI to "clean up" after a job.
    - **`checkAllMissing()`**: Diff logic that auto-selects all files in Source that are NOT in the `destFiles` set.
    - **`setCheckedFiles()`**: Programmatically sets the selection set (used for auto-selecting dropped files).
- **`manifestMap`**
  - **Type:** `Map<string, ManifestEntry>`
  - **Purpose:** A high-performance lookup table for verified files.
  - **Flow:** Populated by `loadManifest` when a destination is mounted. Used by UI components to instantly determine if a file deserves a "Shield Icon" without iterating through arrays.
- **`isDeleteModalOpen`** / **`filesToDelete`**
  - **Purpose:** Manages the "Red Zone" overlay state.
  - **Flow:** Triggered by `FileList`, cleared by `DeleteModal` upon completion or cancel.

#### Types (`src/types/`)

_TypeScript definitions for data structures._

- **`manifest.ts`**
  - **Purpose:** Defines the strict schema for the "Digital Receipt" JSON file.
  - **Key Interfaces:**
    - **`ManifestFile`**: The root structure containing session metadata (machine name, OS, app version) and the array of files.
    - **`ManifestEntry`**: The structure for an individual file record, including its relative path, source path, size, timestamp, and xxHash-64 checksum.

#### Utils (`src/utils/`)

_Pure functions for formatting._

- **`formatters.ts`**

  - **`formatSize(bytes)`**: Converts raw integers to readable strings (e.g., "1024" -> "1.0 KB").
  - **`formatDuration(ms)`**: Converts milliseconds to "MM:SS" or "HH:MM:SS".
  - **`formatDate(date)`**: Standardizes timestamp display.

- **`manifest.ts`**
  - **Purpose:** The "Digital Receipt" engine.
  - **Logic:**
    - **Upsert:** Checks for an existing `lastlook_manifest.json` in the destination. If found, it reads, parses, and appends the new entry. If missing, it creates a new one.
    - **Path Normalization:** Converts Windows backslashes (`\`) to forward slashes (`/`) in the `source_path` to ensure the JSON is clean and cross-platform compatible.
    - **Safety:** Performing this operation in the frontend utility layer prevents blocking the main Rust transfer threads.

### 2.3 Backend (`src-tauri/`)

_The Rust Core environment._

- **`tauri.conf.json`**
  - **Purpose:** The project manifest.
  - **Key Config:**
    - `identifier`: `com.lastlook.app`
    - `externalBin`: `["binaries/ffmpeg", "binaries/ffprobe"]` (Must match filename exactly sans extension).
    - `assetProtocol`: Scoped to `["**"]` to allow the WebView to load any local file as an image.
- **`src-tauri/binaries/`**
  - **Purpose:** Holds the static executables bundled with the MSI.
  - **Naming Convention:** Files must be named with the target triple, e.g., `ffmpeg-x86_64-pc-windows-msvc.exe`.
- **`capabilities/default.json`**
  - **Purpose:** Granular Permission Control Layer (Tauri v2).
  - **Scopes:**
    - `fs:allow-read`: Scoped to `["**"]` (Global Read) to allow Drag & Drop from any external drive or location without prior dialog selection. Explicitly enabled to allow the creation and update of `lastlook_manifest.json`.
    - `shell:allow-execute`: Strictly limits execution to the specific sidecar binaries defined in config.
    - `os:allow-hostname`, `os:allow-os-type`, `os:allow-version`: explicitly enabled to gather machine identity for the manifest audit trail.
    - **`fs:allow-remove`**: Explicitly enabled to allow the deletion of source files. This is the most sensitive permission in the application.
- **`src/main.rs`**
  - **Purpose:** Entry point. Initializes the Tauri builder, registers plugins (`fs`, `dialog`, `shell`), and runs the app.
- **`src/lib.rs`**
  - **Purpose:** The Application Logic Library.
  - **Commands:**
    - **`calculate_hash`**: Uses the `xxhash-rust` crate (xxh3) with a 64MB buffer for maximum throughput.
    - **`copy_file`**: Implements streamed copying with on-the-fly xxHash-64 verification. Includes **"Destructive Cancellation"** safety logic to drop file handles and delete partial data if aborted. Updated to return the final, verified `xxHash-64` string to the frontend upon successful completion, which is then used for the manifest.
    - **Timestamp Preservation:** Explicitly applies `fs::set_modified` to destination files post-transfer to ensure metadata parity for Smart Resume.
    - **`get_video_metadata`**: Spawns `ffprobe` with JSON output args to parse resolution/fps.
    - **`generate_thumbnail`**: Spawns `ffmpeg` to seek to 00:01 and output a single frame to the OS Temp directory.
    - **`clean_video_cache`**: Recursively wipes the temp directory to prevent storage bloat.
    - **`delete_files(paths: Vec<String>)`**
      - **Purpose:** Permanently removes files from the source drive.
      - **Safety:** This command is "dumb"—it deletes what it is told. Safety is enforced by the Frontend "Gatekeeper" (Store) which filters inputs before calling this.
- **`Cargo.toml` / `Cargo.lock`**
  - **Purpose:** Rust dependency management.
  - **Changes:** Added `tauri-plugin-os` to allow querying the operating system for the machine's hostname and version information.

---

## 3. Global State Schema (`src/store/appStore.ts`)

The application uses **Zustand** for state management. This is the exact shape of the store:

```typescript
interface AppState {
  // --- PATHS ---
  sourcePath: string | null;
  destPath: string | null;

  // --- LISTS ---
  fileList: DirEntry[]; // Source of Truth for Source Folder
  destFiles: Set<string>; // Fast lookup for Destination presence
  checkedFiles: Set<string>; // Batch Selection (User clicked checkboxes)

  // --- SELECTION CONTEXT ---
  selectedFile: DirEntry | null;
  selectedFileOrigin: "source" | "dest" | null; // <--- NEW: Tracks origin for Inspector

  // --- STATUS FLAGS ---
  verifiedFiles: Set<string>; // Files that passed xxHash check
  verifyingFiles: Set<string>; // Files currently hashing (Yellow UI)
  conflicts: string[]; // Files causing overwrite warnings

  // --- JOB METRICS (The "Live Math" Engine) ---
  isDrawerOpen: boolean;
  batchTotalBytes: number; // Sum of all selected file sizes
  completedBytes: number; // Sum of fully finished files
  transferStartTime: number; // Epoch ms when job started

  // --- ACTIONS ---
  swapPaths: () => void; // Swaps Source/Dest and resets all lists
  resetJobMetrics: () => void; // <--- NEW: Resets batch stats for clean state
  // ... setters ...
}
```

---

## 4. Data Flow (Media Preview)

1.  **Action:** User clicks a video file in `FileList`.
2.  **State:** `appStore` updates `selectedFile` and sets `selectedFileOrigin` to `"source"`.
3.  **Reaction:** `Inspector` mounts and calls `useMedia(fullPath)`.
4.  **Hook:** `useMedia` detects `.mp4` extension. Calls Rust `generate_thumbnail`.
5.  **Rust:** Spawns `ffmpeg.exe` sidecar.
    - _Command:_ `ffmpeg -y -i [input] -ss 00:00:01 -vframes 1 [temp_output.jpg]`
6.  **Rust:** Returns the absolute path of the temp image to Frontend.
7.  **Hook:** Converts path to `http://asset.localhost/...`.
8.  **UI:** Browser fetches image (allowed by `assetProtocol` scope) and displays it.

---

## 5. Security & Permissions

- **`fs:allow-stat`**: Read-only access to file metadata (Size/Date).
- **`fs:read/write`**: Explicitly scoped to the `sourcePath` and `destPath` selected by the user.
- **`fs:allow-read`**: Scope expanded to `$TEMP/**` to allow reading cached thumbnails.
- **`shell:allow-execute`**: Explicitly allows running the bundled `ffmpeg` binary.
- **`assetProtocol`**: Enabled with scope `["**"]` to allow reading local images in the WebView.

---

## 6. Style Guide (Tailwind)

- **Backgrounds:** `bg-zinc-950` (App BG), `bg-zinc-900` (Panels)
- **Borders:** `border-zinc-800`
- **Text:** `text-zinc-300` (Body), `text-zinc-100` (Headers)
- **Accents:**
  - **Success:** `text-emerald-400`, `bg-emerald-500` (Synced/Verified)
  - **Verifying:** `text-yellow-400`, `bg-yellow-500` (Pending Integrity Check)
  - **Orphan/Error:** `text-red-400`, `bg-red-500` (File exists in Dest but not Source)
  - **Neutral:** `text-zinc-500`, `bg-zinc-600` (No Drive Connected)
  - **Folder:** `text-blue-400`, `bg-blue-500` (Directory)

---

## 7. Deployment & Packaging

To distribute LastLook v2 to other users, follow these steps.

### 7.1 Prerequisites

1.  **FFmpeg Sidecar:** You must manually download the `ffmpeg` binary for Windows.
    - Download `ffmpeg-release-essentials.zip`.
    - Extract `ffmpeg.exe`.
    - **CRITICAL STEP:** Rename it to match the Tauri Target Triple:
      - Rename to: `ffmpeg-x86_64-pc-windows-msvc.exe`
    - Place it in: `src-tauri/binaries/` (Create folder if missing).
2.  **Tauri Config:** Ensure `tauri.conf.json` includes:
    ```json
    "bundle": {
      "externalBin": ["binaries/ffmpeg"]
    }
    ```

### 7.2 Building the Installer

Run the build command in your terminal:

```bash
npm run tauri build
```

**What happens next?**

1.  Tauri compiles the Rust backend (`release` mode).
2.  Vite builds the React frontend.
3.  Tauri bundles them into a Windows Installer (`.msi` or `.exe`).

### 7.3 Output Location

The final installer will be located here:
`src-tauri/target/release/bundle/msi/LastLook_2.0.0_x64_en-US.msi`

You can share this `.msi` file with anyone. It is a standalone installer that includes the app and the FFmpeg engine.

---

## 8. Implementation Roadmap

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

### ✅ Phase 7.5: UX Refinement & Layout Physics (Completed)

_Goal: Address User Feedback, Fix Layout Glitches, and Improve Data Visualization._

#### Sprint 1: Physics & Layout (Completed)

- [x] **Fix "Ground Breaking" Scroll:** Replace aggressive `scrollIntoView` with container-contained scroll logic to prevent the main Window/Header from shifting off-screen.
- [x] **Fix Drawer Overlap:** Refactor `App.tsx` layout to use Flex-Column. The Drawer should physically push the list content up (reducing container height) rather than floating on top (`absolute` vs `flex`).
- [x] **Drawer State Logic:** Decouple Drawer visibility from transfer state. Allow user to expand/collapse Drawer in "Idle" mode and ensure it stays open/closed based on user preference, not just transfer status.

#### Sprint 2: Data Logic & Features (Completed)

- [x] **Orphan Logic (The "Green Ghost"):** Update `DestFileList` to differentiate between "Synced" (Green) and "Orphan/Dest Only" (Red/Grey). Files in Dest but not Source should not be Green.
- [x] **Swap Sources Button:** Add a utility button to swap `SourcePath` and `DestPath` variables to reverse transfer direction.
- [x] **Destination Filters:** Add a toggle to `DestFileList` to show "All Files" vs "Synced Only".
- [x] **Empty Space Fix:** Ensure the bottom of the application is properly sealed so scrolling doesn't reveal the "void" beneath the UI.

### ✅ Phase 8: The Visualizer (Completed)

_Goal: Media features powered by FFmpeg._

- [x] **Sidecar Binary Integration:** Bundle `ffmpeg.exe` and `ffprobe.exe` with the Tauri installer.
- [x] **Thumbnail Generator:** Create a background command to extract a frame at 00:01 and cache it for the Inspector.
- [x] **Hybrid Inspector:** Updated Inspector UI to stack "Batch Header" and "File Preview" when both are active.
- [x] **Security Upgrade:** Enabled `assetProtocol` to serve local images and `fs:allow-read` for temp cache access.
- [x] **UX Polish:** Implemented "Click-to-Deselect" logic on file list backgrounds.
- [x] **Advanced Metadata:** Use `ffprobe` to extract Resolution, Codec, Bitrate, and Frame Rate info.
- [ ] **Comparators:** A "Compare Mode" that places the Source and Destination files side-by-side visually to verify quality manually.

### ✅ Phase 9: UX Polish & Stability (Current)

_Goal: Ensure the app feels snappy and bug-free._

- [x] **Zombie Drawer Fix:** Implemented `resetJobMetrics` and `key`-based remounting to prevent stuck UI states.
- [x] **Small File Support:** Lowered JobDrawer calculation threshold (250ms) for instant feedback.
- [x] **Snappy Transitions:** Reduced post-transfer success delay to 1s.
- [x] **Type Safety:** Resolved TypeScript definitions for file selection origins.
- [x] **Auto-Cleanup:** Implemented "Nuke on Launch" strategy to clear `%TEMP%/lastlook_cache` on startup.
