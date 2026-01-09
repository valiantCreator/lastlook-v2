# LastLook v2: Feedback Implementation & Future Roadmap

**Status:** Planning (Phase 10 & 11)
**Date:** January 9, 2026
**Based on:** User Feedback Session 1 & Industry Professional Review

---

## 🛠 Phase 10: "Safety, Speed & Smarts" (Implementation Plan)

This phase focuses on immediate feedback integration, prioritizing data safety and professional workflow requirements. We are moving from a functional prototype to a production-ready DIT tool.

### 🏃 Sprint 1: Integrity & Critical Logic (Highest Priority)

_Goal: Ensure the application is safe to use in production environments (no corruption, no partial files) and respects existing data (smart resume)._

#### 1. Nuke Partial Files on Cancel

- **The Issue:** Currently, if a user cancels a transfer mid-stream, the application stops writing but leaves the incomplete file on the destination drive. This results in corrupt data ("half-baked files") that look real but are unusable.
- **Original User Feedback:**
  > "Also, if a copy is stopped - DELETE THE FILE THAT WAS PARTIALLY COPIED. I hate when programs leave a half copied file, that is not just useless it is detrimental"
- **The Detailed Fix:** We must modify the Rust backend to handle the "Cancellation" state destructively for the specific file currently being written. When the `abort_flag` is detected inside the copy loop, the system must not only stop writing but also actively remove the file from the filesystem before returning the error state to the frontend.
- **Technical Implementation:**
  - **Associated File:** `src-tauri/src/lib.rs`
  - **Logic:** Inside the `copy_file` loop in Rust, immediately after detecting `state.abort_flag` is true:
    1.  Identify the path of the file currently being written.
    2.  Close the write stream to release the file lock.
    3.  Execute `fs::remove_file(dest_path)` to delete the partial data.
    4.  Return the "CANCELLED" error string to the frontend so the UI updates correctly.

#### 2. Smart Resume (Difference Transfer)

- **The Issue:** If a large batch transfer (e.g., 1TB) is interrupted or if a user wants to "update" a backup, the app currently forces them to either overwrite everything or manually select missing files. It lacks the intelligence to recognize identical files that are already safe.
- **Original User Feedback:**
  > "I’m calling it difference transferring bc idk the name for it but let’s say I was copying 1TB of files to another drive, that would take hours. Say I need to pause this to leave the house or do something else. Canceling sucks bc idk what I’ve done so far... just have it scan both the source and destination folders to identify what’s already been copied, so then it only transfers the difference... that way when I resume it just looks and sees oh you’ve already done 300GB we won’t overwrite that and waste time"
  >
  > "i want to have it check the files for the filename AS WELL as it's file size and modification date to see if files that are named the same are actually the same file"
- **The Detailed Fix:** We will implement a "Smart Skip" or "Idempotent Check" at the moment a transfer begins for each file. Instead of relying solely on the user's choice at the start of the batch, the transfer logic will perform a real-time check.
- **Technical Implementation:**
  - **Associated Files:** `src/hooks/useTransfer.ts`, `src/components/JobDrawer.tsx`
  - **Logic:** Inside `useTransfer.ts`, before invoking the Rust `copy_file` command for a specific item:
    1.  Check if a file with the same name exists in the destination.
    2.  If it exists, compare the **File Size** (bytes) and **Modification Date** of the Source vs. Destination.
    3.  If they match (within a small tolerance for time difference), mark the file status as `SKIPPED` in the UI immediately.
    4.  Do NOT invoke the Rust backend for these files; proceed immediately to the next one.

#### 3. Intelligent Drag & Drop

- **The Issue:** Dragging a file (e.g., `Scene1.mov`) onto the Source pane currently fails or behaves unpredictably because the app expects a folder drop. Users intuitively expect dropping a file to "load" that file's context.
- **Original User Feedback:**
  > "drag and drop! the mouse shows the + icon when you drag something to the source pane like it allows drag and drop but it isn’t registering the drop when you release the click"
- **The Detailed Fix:** We need to update the drop handler to inspect the payload. If the dropped item is a file (not a folder), we must resolve its **Parent Directory** and set that parent directory as the `sourcePath`.
- **Technical Implementation:**
  - **Associated Files:** `src/App.tsx`, `src/hooks/useFileSystem.ts`
  - **Logic:**
    1.  Listen for the `drop` event.
    2.  Check the `payload.paths`.
    3.  Use the filesystem API to check `stat.isDirectory()`.
    4.  **If it is a File:** Use `path.dirname()` (or string manipulation) to get the parent folder.
    5.  Call `setSourcePath(parentFolder)`.
    6.  **Bonus:** Auto-scroll the file list to highlight the specific file that was dropped.

---

### 🛡️ Sprint 2: The DIT Toolset (Trust Builders)

_Goal: Add the features that make professional DITs (Digital Imaging Technicians) trust the software for client deliverables._

#### 4. Transfer Logs (The "Receipt")

- **The Issue:** Professionals need proof of delivery. Clients require a manifest showing exactly what was copied and verifying that checksums matched.
- **Original User Feedback:**
  > "I don’t see why the app can’t also read this txt file and just display it in the UI. It’s probably safer to have a logs folder in a separate folder though... definitely make the log file thing an option in settings... just make sure the naming of these transfer logs is time dependent or has a unique naming convention"
- **The Detailed Fix:** Upon the successful (or partial) completion of a batch job, the app will generate a text file containing a manifest of operations.
- **Technical Implementation:**
  - **Associated Files:** `src/hooks/useTransfer.ts`, `src/utils/logGenerator.ts` (New)
  - **Logic:**
    1.  Create a `sessionLog` object in `useTransfer.ts` that accumulates data for every file handled (Source Name, Dest Name, File Size, Hash Status, Timestamp).
    2.  When the batch finishes, format this object into a readable `.txt` string (Header: Date/Time; Body: File List; Footer: Summary).
    3.  Write this file to: `[DestinationPath]/LastLook_TransferLog_[YYYY-MM-DD_HHmm].txt`.
    4.  **Secondary:** Save a JSON copy to `%APPDATA%` for internal app history.

#### 5. Right-Click Context Menus

- **The Issue:** Users often need to verify where a file physically lives on their disk. The standard behavior in file managers is to right-click and "Reveal in Explorer" or "Show in Finder."
- **Original User Feedback:**
  > "I’d also want to be able to right click and open the destination folder in Explorer."
- **The Detailed Fix:** We will add a custom context menu handler to the file rows in both the Source and Destination lists.
- **Technical Implementation:**
  - **Associated Files:** `src/components/FileRow.tsx`, `src/components/DestFileList.tsx`
  - **Logic:**
    1.  Attach `onContextMenu` event listener to `FileRow` components.
    2.  Prevent the default browser context menu.
    3.  Invoke the Tauri Shell plugin's `open` command on the parent directory of the file (or use a "highlight" command if available in the plugin) to open the native OS file explorer.

#### 6. "Verified" Tooltip (Education)

- **The Issue:** Users accustomed to legacy software (ShotPut Pro) look for the term "MD5". They may be confused by "Verified" if they don't know we use the faster, modern xxHash algorithm.
- **Original User Feedback:**
  > "okay the copy worked. Verified MD5 match? what’s that mean? I’d do a tooltip popup on hovering over that. it could say: “MD5 Match is a blah blah blah”"
- **The Detailed Fix:** We will add a UI element that explains the verification method to educate the user and provide reassurance.
- **Technical Implementation:**
  - **Associated Files:** `src/components/JobDrawer.tsx`
  - **Logic:**
    1.  In the `JobDrawer` or success badge, change the text or add an info icon.
    2.  Implement a hover tooltip that reads: _"Verified via xxHash-64. A bit-for-bit digital fingerprint match was confirmed. This ensures 100% data integrity, similar to MD5 but optimized for speed."_

---

### 🎨 Sprint 3: UX Polish & Power User Features

_Goal: Improve the "feel" and flexibility of the application, accommodating power-user habits._

#### 7. Shift+Select Range Logic

- **The Issue:** Selecting a large contiguous block of files (e.g., "Select files 10 through 50") is tedious if the user has to click each checkbox individually. Standard OS behavior allows `Shift+Click`.
- **Original User Feedback:**
  > "okay some sort of shift+select feature def needs to be in this... Shift is the goat for that... so maybe shift select on the left of the file selects it, shift select on the right side just highlights those files and if multiple are selected and you click one of the checkboxes, it selects all of them."
- **The Detailed Fix:** We will implement state tracking for the `lastClickedIndex` to enable range selection.
- **Technical Implementation:**
  - **Associated Files:** `src/components/FileList.tsx`, `src/store/appStore.ts`
  - **Logic:**
    1.  In `store/appStore.ts`, verify we can access the file list index.
    2.  In `FileList.tsx`, track `lastClickedIndex` in local state.
    3.  When a user clicks a checkbox:
        - If `Shift` key is held: Calculate the range between `lastClickedIndex` and `currentClickedIndex`.
        - Toggle all files in that range to the new state.
        - Update `checkedFiles` Set in the store.

#### 8. "Ask Me For Each" Conflict Mode

- **The Issue:** Some users have a niche need to manually review every single duplicate file rather than applying a blanket "Overwrite All" or "Skip All" policy.
- **Original User Feedback:**
  > "niche use case but maybe add a third option that says “ask me for each file”. when this third option is selected I’d maybe add small red text that pops up like “don’t select this option if you plan to leave the computer while it transfers”"
- **The Detailed Fix:** We will add a third button to the Conflict Modal.
- **Technical Implementation:**
  - **Associated Files:** `src/components/ConflictModal.tsx`, `src/hooks/useTransfer.ts`
  - **Logic:**
    1.  Update `ConflictModal.tsx` to include an "Ask For Each" button.
    2.  Add the requested warning text in red: _"⚠️ Warning: You will be prompted for every conflict. Do not leave your computer."_
    3.  In `useTransfer.ts`, if this mode is selected, the resolution logic must iterate through the `conflicts` array one by one, presenting a modal for each item instead of batch-processing them.

#### 9. Recursive Folder Stats

- **The Issue:** When a user selects a folder, they often want to know the scope of what is inside (how many nested files/folders) to verify counts later.
- **Original User Feedback:**
  > "showing the amount of sub files and sub folders would be great. Because then when you eventually add a checksum feature... you can verify files folders and bytes"
- **The Detailed Fix:** We need a way to scan directory trees recursively. Since this can be slow on network drives, it must be an asynchronous Rust command.
- **Technical Implementation:**
  - **Associated Files:** `src-tauri/src/lib.rs` (New Command), `src/components/Inspector.tsx`
  - **Logic:**
    1.  Create a new Rust command `get_dir_stats(path: String)` in `lib.rs`.
    2.  Use the `walkdir` crate (or recursive `fs::read_dir`) to count files and folders and sum total bytes.
    3.  Return struct `{ file_count, folder_count, total_bytes }`.
    4.  Expose this data to the `Inspector` component whenever a folder is selected.

---

## ⚙️ Phase 11: The Settings Architecture (Brainstorm)

_Goal: Create a centralized hub for customization without cluttering the main UI. This will likely take the form of a Modal Overlay accessed via a Gear icon in the toolbar._

### Architecture

- **UI Pattern:** Modal Overlay (Clean, non-intrusive).
- **Persistence:** `localStorage` is sufficient for UI preferences. If we need complex exportable configs later, we can move to `tauri-plugin-store`.

### Detailed Menu Structure & Logic

#### 1. General Tab

- **Theme:**
  - Options: System (Default), Dark, Light.
  - _Note:_ Requires Tailwind config updates to support a `dark` class toggle.
- **Notifications:**
  - Setting: "Play sound on job completion?" (Checkbox).
  - Setting: "Play sound on error?" (Checkbox).

#### 2. Transfer Behaviors

- **Default Conflict Policy:**
  - Setting: "Default Action for Duplicates".
  - Options: "Always Ask" (Default), "Always Skip", "Ask For Each".
- **Verification Engine:**
  - Setting: "Checksum Algorithm".
  - Options: "xxHash-64 (Recommended - Fastest)", "MD5 (Legacy - Slower)".
  - _Implementation Note:_ We will need to implement the MD5 hasher in Rust if this option is selected.
- **Logging:**
  - Setting: "Generate Transfer Logs in Destination".
  - Toggle: On/Off (Default: On).
  - Setting: "Log Naming Convention".
  - Options: `Log_[Date]_[Time].txt` OR `Log_[BatchName].txt`.

#### 3. Safety & Maintenance Tab

- **Cache Management:**
  - Display: "Current Cache Size: [Calculated MB]".
  - Action: [Clear Thumbnail Cache Now] button.
- **Parashoot Protocol (Experimental/Locked):**
  - _Description:_ "Soft-corrupt source cards after verification to force camera reformatting."
  - _Status:_ **LOCKED / COMING SOON**.
  - _Why:_ As discussed, this is high-risk. We will place it here but disabled, labeled "Coming in v1.0", to build anticipation without risking data safety yet.

---

## 🔮 Phase 12: The "DIT" Roadmap (Future / v1.0+)

_These features require significant backend re-architecture and are strictly post-v0.2.0. They represent the evolution from "File Transfer App" to "Professional DIT Station"._

#### 1. Multi-Drive Mirroring

- **The Concept:** One Source -> Multiple Destinations simultaneously.
- **Original User Feedback:**
  > "File mirroring to multiple drives at once. THIS is what we did for DIT on set... Yes drive mirroring is absolutely essential for DIT."
- **Implementation Plan:** We will need to refactor `copy_file` in Rust to handle multiple write streams (`dst_file_1`, `dst_file_2`) and multiple hashers in parallel. The UI will need to support adding multiple "Destination" panels.

#### 2. Standalone Verify Mode

- **The Concept:** A "Compare" tab where users drag Folder A and Folder B, and the app runs a checksum comparison without copying any data.
- **Original User Feedback:**
  > "A section or mode of the app that JUST does the checksum part. Say I want to verify two folders are the same that were copied already... letting the user use just that could be useful."
- **Implementation Plan:** This requires a new "Mode" switcher in the UI (Copy Mode vs. Verify Mode). The Rust backend will need a command that accepts two paths and purely runs the hashing logic on both, returning a comparison report.
