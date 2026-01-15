import { create } from "zustand";
import { DirEntry } from "@tauri-apps/plugin-fs";
import { ManifestEntry } from "../types/manifest";
import { invoke } from "@tauri-apps/api/core";

interface AppState {
  // DATA
  sourcePath: string | null;
  destPath: string | null;
  fileList: DirEntry[];
  destFiles: Set<string>;
  verifiedFiles: Set<string>;
  verifyingFiles: Set<string>;

  // MANIFEST STATE (The "Brain" for Sprint 3)
  manifestMap: Map<string, ManifestEntry>;

  // --- CHANGED: MULTI-SELECT STATE (Sprint 8) ---
  selectedFiles: Map<string, DirEntry>;
  lastSelectedIndex: number;
  selectedFileOrigin: "source" | "dest" | null;
  // ----------------------------------------------

  checkedFiles: Set<string>;

  // CONFLICT STATE
  conflicts: string[];

  // --- DELETE MODAL STATE (Sprint 4 Refinement) ---
  isDeleteModalOpen: boolean;
  filesToDelete: string[];

  // --- JOB DRAWER STATE ---
  isDrawerOpen: boolean;
  batchTotalBytes: number;
  completedBytes: number;
  transferStartTime: number | null;

  // ACTIONS
  setSourcePath: (path: string | null) => void;
  setDestPath: (path: string | null) => void;
  setFileList: (files: DirEntry[]) => void;
  setDestFiles: (files: Set<string>) => void;

  setManifestMap: (map: Map<string, ManifestEntry>) => void;
  upsertManifestEntry: (entry: ManifestEntry) => void;

  addVerifyingFile: (filename: string) => void;
  removeVerifyingFile: (filename: string) => void;
  addVerifiedFile: (filename: string) => void;

  // --- NEW: SELECTION ACTIONS (Sprint 8) ---
  selectFile: (
    file: DirEntry,
    origin: "source" | "dest",
    modifier?: "shift" | "ctrl" | "none",
    index?: number,
    sortedList?: string[] // <--- NEW: For Dest Shift Logic
  ) => void;

  clearSelection: () => void;

  // The "Bridge" Button Action
  checkSelectedFiles: () => void;
  // -----------------------------------------

  setConflicts: (files: string[]) => void;

  // CHECKBOX ACTIONS
  toggleChecked: (filename: string) => void;
  checkAllMissing: () => void;
  setAllChecked: (filenames: string[]) => void;
  setCheckedFiles: (files: Set<string>) => void;
  clearChecked: () => void;
  resetSource: () => void;

  // --- DELETE ACTIONS (SPRINT 4) ---
  deleteSourceFiles: (filenames: string[]) => Promise<void>;
  openDeleteModal: (filenames: string[]) => void;
  closeDeleteModal: () => void;

  // --- UTILITY ACTIONS ---
  swapPaths: () => void;

  // --- DRAWER ACTIONS ---
  toggleDrawer: (isOpen: boolean) => void;
  setBatchInfo: (totalBytes: number) => void;
  addCompletedBytes: (bytes: number) => void;
  setTransferStartTime: (time: number | null) => void;

  // Reset Action for Zombie Drawer fix
  resetJobMetrics: () => void;
}

// Helper to create basic DirEntry from string (for Dest selection)
const mockDirEntry = (name: string): DirEntry => ({
  name,
  isFile: true,
  isDirectory: false,
  isSymlink: false,
});

export const useAppStore = create<AppState>((set, get) => ({
  sourcePath: null,
  destPath: null,
  fileList: [],
  destFiles: new Set(),
  verifiedFiles: new Set(),
  verifyingFiles: new Set(),
  manifestMap: new Map(),

  // --- NEW DEFAULTS ---
  selectedFiles: new Map(),
  lastSelectedIndex: -1,
  selectedFileOrigin: null,
  // --------------------

  checkedFiles: new Set(),
  conflicts: [],

  // --- DELETE MODAL DEFAULTS ---
  isDeleteModalOpen: false,
  filesToDelete: [],

  // Drawer Defaults
  isDrawerOpen: false,
  batchTotalBytes: 0,
  completedBytes: 0,
  transferStartTime: null,

  // Actions
  setSourcePath: (path) => set({ sourcePath: path }),
  setDestPath: (path) => set({ destPath: path }),
  setFileList: (files) => set({ fileList: files }),
  setDestFiles: (files) => set({ destFiles: files }),
  setManifestMap: (map) => set({ manifestMap: map }),

  // --- REACTIVE MANIFEST UPDATE ---
  upsertManifestEntry: (entry) =>
    set((state) => {
      const newMap = new Map(state.manifestMap);
      newMap.set(entry.filename, entry);
      return { manifestMap: newMap };
    }),
  // --------------------------------

  addVerifyingFile: (filename) =>
    set((state) => {
      const newSet = new Set(state.verifyingFiles);
      newSet.add(filename);
      return { verifyingFiles: newSet };
    }),

  removeVerifyingFile: (filename) =>
    set((state) => {
      const newSet = new Set(state.verifyingFiles);
      newSet.delete(filename);
      return { verifyingFiles: newSet };
    }),

  addVerifiedFile: (filename) =>
    set((state) => {
      const newSet = new Set(state.verifiedFiles);
      newSet.add(filename);
      return { verifiedFiles: newSet };
    }),

  // --- NEW SELECTION LOGIC (Sprint 8 FIX) ---
  selectFile: (file, origin, modifier = "none", index = -1, sortedList) =>
    set((state) => {
      // 1. Check Origin Change
      let newSelection = new Map(
        state.selectedFileOrigin === origin ? state.selectedFiles : []
      );

      // Determines if we should update the anchor point (lastSelectedIndex)
      // Standard/Ctrl click updates it. Shift click PRESERVES it.
      let nextLastSelectedIndex = index;

      console.log(
        `Select: ${modifier} | Index: ${index} | Last: ${state.lastSelectedIndex} | Origin: ${origin}`
      );

      if (modifier === "ctrl") {
        // --- CTRL: TOGGLE ---
        console.log("-> Entering CTRL block");
        if (newSelection.has(file.name)) {
          newSelection.delete(file.name);
        } else {
          newSelection.set(file.name, file);
        }
      } else if (
        modifier === "shift" &&
        state.lastSelectedIndex !== -1 &&
        index !== -1
      ) {
        // --- SHIFT: RANGE ---
        console.log("-> Entering SHIFT block");

        // CRITICAL FIX: Preserve the original anchor point during Shift-Select
        nextLastSelectedIndex = state.lastSelectedIndex;

        if (origin === "source") {
          const start = Math.min(state.lastSelectedIndex, index);
          const end = Math.max(state.lastSelectedIndex, index);

          // Slice the source list to get the range
          const slice = state.fileList.slice(start, end + 1);

          // Clear previous selection for contiguous range behavior
          newSelection.clear();
          slice.forEach((f) => newSelection.set(f.name, f));
        } else if (origin === "dest" && sortedList) {
          // --- DESTINATION LOGIC (Sprint 8 FIX) ---
          const start = Math.min(state.lastSelectedIndex, index);
          const end = Math.max(state.lastSelectedIndex, index);

          console.log(`-> Dest Range: ${start} to ${end}`);
          const slice = sortedList.slice(start, end + 1);

          newSelection.clear();
          // Since dest list is just strings, we create mock entries
          slice.forEach((name) => newSelection.set(name, mockDirEntry(name)));
        } else {
          // Fallback
          newSelection.clear();
          newSelection.set(file.name, file);
          // If we fallback, we DO want to reset the anchor
          nextLastSelectedIndex = index;
        }
      } else {
        // --- STANDARD: RESET ---
        console.log("-> Entering STANDARD block");
        // Also catches Shift if it's the very first click (no history)
        newSelection.clear();
        newSelection.set(file.name, file);
      }

      return {
        selectedFiles: newSelection,
        selectedFileOrigin: origin,
        lastSelectedIndex: nextLastSelectedIndex, // <--- USES CORRECTED ANCHOR LOGIC
      };
    }),

  clearSelection: () =>
    set({
      selectedFiles: new Map(),
      selectedFileOrigin: null,
      lastSelectedIndex: -1,
    }),

  // The "Bridge" Action: Highlighted -> Checked
  checkSelectedFiles: () =>
    set((state) => {
      if (state.selectedFileOrigin !== "source") return {}; // Only check source files

      const newChecked = new Set(state.checkedFiles);
      state.selectedFiles.forEach((_, name) => newChecked.add(name));

      return { checkedFiles: newChecked };
    }),
  // --------------------------------------

  setConflicts: (files) => set({ conflicts: files }),

  // --- BATCH LOGIC ---

  toggleChecked: (filename) =>
    set((state) => {
      const newSet = new Set(state.checkedFiles);
      if (newSet.has(filename)) newSet.delete(filename);
      else newSet.add(filename);
      return { checkedFiles: newSet };
    }),

  checkAllMissing: () => {
    const { fileList, destFiles } = get();
    const missing = fileList
      .filter((f) => !f.isDirectory && !destFiles.has(f.name))
      .map((f) => f.name);
    set({ checkedFiles: new Set(missing) });
  },

  setAllChecked: (filenames) => set({ checkedFiles: new Set(filenames) }),

  setCheckedFiles: (files) => set({ checkedFiles: files }),

  clearChecked: () => set({ checkedFiles: new Set() }),

  // --- DELETE IMPLEMENTATION (SPRINT 4) ---
  deleteSourceFiles: async (filenames: string[]) => {
    const { sourcePath, manifestMap, fileList, checkedFiles } = get();

    if (!sourcePath) return;

    // 1. THE TRIPLE CHECK (Gatekeeper)
    // Only allow files that are strictly present in the Manifest (Verified)
    const safeToDelete = filenames.filter((name) => manifestMap.has(name));

    if (safeToDelete.length === 0) {
      console.warn("🚫 Delete Aborted: No verified files selected.");
      return;
    }

    console.log(
      `🗑️ Attempting to delete ${safeToDelete.length} verified files...`
    );

    // 2. PREPARE PATHS
    // Normalize path separators if needed, though Rust usually handles mixed well
    const fullPaths = safeToDelete.map(
      (name) => `${sourcePath}${sourcePath.endsWith("\\") ? "" : "\\"}${name}`
    );

    try {
      // 3. CALL BACKEND (The Executioner)
      // We will create this command in Step 2
      await invoke("delete_files", { paths: fullPaths });

      // 4. UPDATE STATE (Optimistic UI)
      // Remove deleted files from the list so the UI updates instantly
      const newFileList = fileList.filter(
        (f) => !safeToDelete.includes(f.name)
      );

      // Also uncheck them
      const newChecked = new Set(checkedFiles);
      safeToDelete.forEach((name) => newChecked.delete(name));

      set({
        fileList: newFileList,
        checkedFiles: newChecked,
        selectedFiles: new Map(), // Deselect to avoid errors
      });

      console.log("✅ Delete Successful");
    } catch (err) {
      console.error("❌ Delete Failed:", err);
      throw err; // Re-throw so the UI can show an error toast if we add one later
    }
  },

  openDeleteModal: (filenames) =>
    set({ isDeleteModalOpen: true, filesToDelete: filenames }),

  closeDeleteModal: () => set({ isDeleteModalOpen: false, filesToDelete: [] }),
  // ----------------------------------------

  // --- UTILITY ACTIONS ---
  swapPaths: () =>
    set((state) => ({
      sourcePath: state.destPath,
      destPath: state.sourcePath,
      // Clear all file lists to force re-scan and prevent ghost data
      fileList: [],
      destFiles: new Set(),
      verifiedFiles: new Set(),
      verifyingFiles: new Set(),
      manifestMap: new Map(),
      checkedFiles: new Set(),

      selectedFiles: new Map(), // <--- RESET
      selectedFileOrigin: null,

      conflicts: [],
      // Reset Drawer
      batchTotalBytes: 0,
      completedBytes: 0,
      transferStartTime: null,
      isDrawerOpen: false,
    })),

  // --- DRAWER LOGIC ---
  toggleDrawer: (isOpen) => set({ isDrawerOpen: isOpen }),
  setBatchInfo: (totalBytes) =>
    set({ batchTotalBytes: totalBytes, completedBytes: 0 }),
  addCompletedBytes: (bytes) =>
    set((state) => ({ completedBytes: state.completedBytes + bytes })),
  setTransferStartTime: (time) => set({ transferStartTime: time }),

  resetSource: () =>
    set({
      sourcePath: null,
      fileList: [],

      selectedFiles: new Map(), // <--- RESET
      selectedFileOrigin: null,

      verifiedFiles: new Set(),
      verifyingFiles: new Set(),
      checkedFiles: new Set(),
      manifestMap: new Map(), // <--- CLEAR ON RESET
      conflicts: [],
      // Reset Drawer State too
      batchTotalBytes: 0,
      completedBytes: 0,
      transferStartTime: null,
      isDrawerOpen: false,
    }),

  // Reset Action implementation
  resetJobMetrics: () =>
    set({
      batchTotalBytes: 0,
      completedBytes: 0,
      transferStartTime: null,
    }),
}));
