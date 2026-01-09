# LastLook v2: Feedback Implementation & Future Roadmap

**Status:** Planning (Phase 10 & 11)
**Date:** January 9, 2026
**Based on:** User Feedback Session 1 & Industry Professional Review

---

## 🛠 Phase 10: "Safety, Speed & Smarts" (Implementation Plan)

This phase focuses on immediate feedback integration, prioritizing data safety and professional workflow requirements.

### 🏃 Sprint 1: Integrity & Critical Logic (Highest Priority)

_Goal: Ensure the application is safe to use in production environments (no corruption, no partial files) and respects existing data (smart resume)._

#### 1. Nuke Partial Files on Cancel

- **The Issue:** If a user cancels a transfer mid-stream, the app currently leaves a partially written (corrupt) file at the destination. This is detrimental to file integrity.
- **The Fix:** Modify the backend cancellation logic to track the current active file handle and delete it from the disk if the "Abort" flag is raised.
- **Technical Implementation:**
  - **File:** `src-tauri/src/lib.rs`
  - **Logic:** Inside the `copy_file` loop, when `state.abort_flag` is detected:
    1.  Close the write stream.
    2.  Execute `fs::remove_file(dest_path)`.
    3.  Return the "CANCELLED" error state to the frontend.

#### 2. Smart Resume (Difference Transfer)

- **The Issue:** If a large batch (1TB) is interrupted, users currently have to restart from zero or manually select missing files. The app should automatically skip files that are already successfully copied.
- **The Fix:** Implement a "Pre-Copy Check" in the transfer loop.
- **Technical Implementation:**
  - **File:** `src/hooks/useTransfer.ts`
  - **Logic:** Before calling `invoke("copy_file")` for a specific file:
    1.  Check if `destFile` exists.
    2.  **Compare Size:** `src.size === dest.size`
    3.  **Compare Date:** `src.modifiedAt === dest.modifiedAt` (within a small tolerance).
    4.  **Decision:** If all match, mark as `SKIPPED` in the UI and move to the next file immediately. Do NOT invoke Rust.

#### 3. Intelligent Drag & Drop

- **The Issue:** Dragging a file (e.g., `Scene1.mov`) onto the Source pane does not currently load the context of that file.
- **The Fix:** Detect the dropped item type. If it is a file, resolve its **Parent Directory** and set that as the Source Path.
- **Technical Implementation:**
  - **Files:** `src/App.tsx`, `src/hooks/useFileSystem.ts`
  - **Logic:**
    1.  On `drop` event, receive payload.
    2.  Check `stats.isDirectory()`.
    3.  **If File:** `setSourcePath(path.dirname(droppedPath))`.
    4.  **Bonus:** Automatically scroll to and highlight the specific file dropped.

---

### 🛡️ Sprint 2: The DIT Toolset (Trust Builders)

_Goal: Add the features that make professional DITs (Digital Imaging Technicians) trust the software for client deliverables._

#### 4. Transfer Logs (The "Receipt")

- **The Issue:** Clients need proof of transfer. Users requested a `.txt` log file generated in the Destination folder.
- **The Fix:** Generate a structured log file upon batch completion.
- **Technical Implementation:**
  - **Files:** `src/hooks/useTransfer.ts`, `src/utils/logGenerator.ts` (New)
  - **Settings:** Toggleable via future Settings page (Default: ON).
  - **Logic:**
    1.  Accumulate transfer stats in a `sessionLog` object (Source, Dest, Filename, Checksum, Timestamp, Status).
    2.  On `Batch Complete`: Format object into a readable `.txt` string.
    3.  Write file: `[DestPath]/LastLook_TransferLog_[YYYY-MM-DD_HHmm].txt`.
    4.  **Secondary:** Save a JSON copy to `%APPDATA%` for internal app history.

#### 5. Right-Click Context Menus

- **The Issue:** Users need to quickly verify where a file actually lives on their drive ("Reveal in Explorer").
- **The Fix:** Add a custom context menu to file rows.
- **Technical Implementation:**
  - **Files:** `src/components/FileRow.tsx`, `src/components/DestFileList.tsx`
  - **Logic:**
    1.  `onContextMenu` handler prevents default browser menu.
    2.  Invoke `shell.open(path)` (using Tauri shell plugin) to open the OS file explorer with the file highlighted.

#### 6. "Verified" Tooltip (Education)

- **The Issue:** Users confusing "MD5" with "xxHash".
- **The Fix:** UI Clarification.
- **Technical Implementation:**
  - **File:** `src/components/JobDrawer.tsx` (or wherever the "Verified" badge appears).
  - **Logic:** Add a tooltip component: _"Verified via xxHash-64. Bit-for-bit data match confirmed."_

---

### 🎨 Sprint 3: UX Polish & Power User Features

_Goal: Improve the "feel" and flexibility of the application._

#### 7. Shift+Select Range Logic

- **The Issue:** Batch selection is tedious one-by-one. Users expect standard OS range selection.
- **The Fix:** Implement `lastSelectedIndex` state tracking.
- **Technical Implementation:**
  - **Files:** `src/store/appStore.ts`, `src/components/FileList.tsx`
  - **Logic:**
    1.  Store `lastClickedIndex`.
    2.  If `Shift + Click`: Select all indices between `lastClickedIndex` and `currentClickedIndex`.
    3.  Update `checkedFiles` Set.

#### 8. "Ask Me For Each" Conflict Mode

- **The Issue:** Niche use case where a user wants granular control over duplicates without checking "Overwrite All" or "Skip All".
- **The Fix:** A third resolution path.
- **Technical Implementation:**
  - **Files:** `src/components/ConflictModal.tsx`, `src/hooks/useTransfer.ts`
  - **UI:** Add button "Ask for Each".
  - **Warning:** Add red text: _"⚠️ Do not leave computer. You will be prompted for every conflict."_
  - **Logic:** Instead of processing the conflict list in bulk, iterate through the conflict array one by one, showing a modal for each entry.

#### 9. Recursive Folder Stats

- **The Issue:** Users want to know "How many files are in this folder?" before transferring.
- **The Fix:** Asynchronous recursive scan.
- **Technical Implementation:**
  - **Files:** `src-tauri/src/lib.rs` (New Command needed), `src/components/Inspector.tsx`
  - **Logic:**
    1.  New Rust command: `get_dir_stats(path)`.
    2.  Walks directory tree (efficiently).
    3.  Returns `{ file_count, folder_count, total_bytes }`.
    4.  Display in Inspector when a Folder is selected.

---

## ⚙️ Phase 11: The Settings Architecture (Brainstorm)

_Goal: Create a centralized hub for customization without cluttering the main UI._

### Architecture

- **UI Pattern:** Modal Overlay (cleaner than a separate tab/route).
- **Persistence:** `localStorage` (for UI prefs) + `tauri-plugin-store` (if we need robust config files later). For now, `localStorage` is sufficient.

### Menu Structure Breakdown

#### 1. General

- **Theme:** System / Dark / Light (Prepare for future light mode).
- **Notifications:**
  - [ ] Play sound on success.
  - [ ] Play sound on error.

#### 2. Transfer Behaviors

- **Default Conflict Policy:**
  - Options: "Always Ask" (Default), "Always Skip", "Ask For Each".
- **Verification Engine:**
  - Options: "xxHash-64 (Recommended)", "MD5 (Legacy/Slow)".
  - _Note: Implementing MD5 selector requires Rust backend updates._
- **Logging:**
  - [x] Generate Transfer Logs in Destination Folder.
  - [x] Naming Convention: `Log_[Date]_[Time].txt` vs `Log_[BatchID].txt`.

#### 3. Safety & Maintenance

- **Cache:**
  - Current Size: [Calculate Folder Size]
  - Button: [Clear Thumbnail Cache Now]
- **Parashoot Protocol (Experimental/Locked):**
  - _Description:_ "Soft-corrupt source cards after verification to force camera reformatting."
  - _Status:_ **LOCKED / COMING SOON**. (Too risky for v1.0).

---

## 🔮 Phase 12: The "DIT" Roadmap (Future / v1.0+)

_These features require significant backend re-architecture and are strictly post-v0.2.0._

1.  **Multi-Drive Mirroring:**
    - **Concept:** One Source -> Multiple Destinations simultaneously.
    - **Requirement:** Refactor `copy_file` in Rust to handle multiple write streams and hashers in parallel.
2.  **Standalone Verify Mode:**
    - **Concept:** A "Compare" tab where users drag Folder A and Folder B, and the app runs a checksum comparison without copying any data.
    - **Use Case:** Auditing backups made by other people/software.
