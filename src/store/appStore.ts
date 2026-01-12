import { create } from "zustand";
import { DirEntry } from "@tauri-apps/plugin-fs";

interface AppState {
  // DATA
  sourcePath: string | null;
  destPath: string | null;
  fileList: DirEntry[];
  destFiles: Set<string>;
  verifiedFiles: Set<string>;
  verifyingFiles: Set<string>;
  selectedFile: DirEntry | null;
  selectedFileOrigin: "source" | "dest" | null; // <--- NEW: Tracks where the file is from
  checkedFiles: Set<string>;

  // CONFLICT STATE
  conflicts: string[];

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

  addVerifyingFile: (filename: string) => void;
  removeVerifyingFile: (filename: string) => void;
  addVerifiedFile: (filename: string) => void;

  // UPDATED: Now accepts an optional origin ('source' is default for backward compatibility)
  // FIX: Added | null to the origin type to prevent TS mismatch
  setSelectedFile: (
    file: DirEntry | null,
    origin?: "source" | "dest" | null
  ) => void;
  setConflicts: (files: string[]) => void;

  // CHECKBOX ACTIONS
  toggleChecked: (filename: string) => void;
  checkAllMissing: () => void;
  setAllChecked: (filenames: string[]) => void;
  setCheckedFiles: (files: Set<string>) => void; // <--- 1. ADDED INTERFACE DEFINITION
  clearChecked: () => void;
  resetSource: () => void;

  // --- NEW: UTILITY ACTIONS ---
  swapPaths: () => void;

  // --- DRAWER ACTIONS ---
  toggleDrawer: (isOpen: boolean) => void;
  setBatchInfo: (totalBytes: number) => void;
  addCompletedBytes: (bytes: number) => void;
  setTransferStartTime: (time: number | null) => void;

  // NEW: Reset Action for Zombie Drawer fix
  resetJobMetrics: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  sourcePath: null,
  destPath: null,
  fileList: [],
  destFiles: new Set(),
  verifiedFiles: new Set(),
  verifyingFiles: new Set(),
  selectedFile: null,
  selectedFileOrigin: null, // <--- NEW
  checkedFiles: new Set(),
  conflicts: [],

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

  // UPDATED: Sets origin. Defaults to "source" if not specified.
  setSelectedFile: (file, origin = "source") =>
    set({ selectedFile: file, selectedFileOrigin: origin }),

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

  setCheckedFiles: (files) => set({ checkedFiles: files }), // <--- 2. ADDED IMPLEMENTATION

  clearChecked: () => set({ checkedFiles: new Set() }),

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
      checkedFiles: new Set(),
      selectedFile: null,
      selectedFileOrigin: null, // <--- RESET
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
      selectedFile: null,
      selectedFileOrigin: null, // <--- RESET
      verifiedFiles: new Set(),
      verifyingFiles: new Set(),
      checkedFiles: new Set(),
      conflicts: [],
      // Reset Drawer State too
      batchTotalBytes: 0,
      completedBytes: 0,
      transferStartTime: null,
      isDrawerOpen: false,
    }),

  // NEW: Reset Action implementation
  resetJobMetrics: () =>
    set({
      batchTotalBytes: 0,
      completedBytes: 0,
      transferStartTime: null,
    }),
}));
