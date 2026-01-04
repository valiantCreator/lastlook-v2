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
  checkedFiles: Set<string>;

  // CONFLICT STATE
  conflicts: string[];

  // --- NEW: JOB DRAWER STATE ---
  isDrawerOpen: boolean;
  batchTotalBytes: number; // The size of the ENTIRE job (50GB)
  completedBytes: number; // Bytes fully finished (files 1-4 done)
  transferStartTime: number | null; // Timestamp when job started

  // ACTIONS
  setSourcePath: (path: string | null) => void;
  setDestPath: (path: string | null) => void;
  setFileList: (files: DirEntry[]) => void;
  setDestFiles: (files: Set<string>) => void;

  addVerifyingFile: (filename: string) => void;
  removeVerifyingFile: (filename: string) => void;
  addVerifiedFile: (filename: string) => void;

  setSelectedFile: (file: DirEntry | null) => void;
  setConflicts: (files: string[]) => void;

  // CHECKBOX ACTIONS
  toggleChecked: (filename: string) => void;
  checkAllMissing: () => void;
  setAllChecked: (filenames: string[]) => void;
  clearChecked: () => void;
  resetSource: () => void;

  // --- NEW: DRAWER ACTIONS ---
  toggleDrawer: (isOpen: boolean) => void;
  setBatchInfo: (totalBytes: number) => void;
  addCompletedBytes: (bytes: number) => void; // Call this when a file finishes
  setTransferStartTime: (time: number | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  sourcePath: null,
  destPath: null,
  fileList: [],
  destFiles: new Set(),
  verifiedFiles: new Set(),
  verifyingFiles: new Set(),
  selectedFile: null,
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

  setSelectedFile: (file) => set({ selectedFile: file }),
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
  clearChecked: () => set({ checkedFiles: new Set() }),

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
}));
