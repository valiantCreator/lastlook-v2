import { create } from "zustand";
import { DirEntry } from "@tauri-apps/plugin-fs";

interface AppState {
  // DATA
  sourcePath: string | null;
  destPath: string | null;
  fileList: DirEntry[];
  destFiles: Set<string>; // Files that exist in Destination
  verifiedFiles: Set<string>; // Files that are MD5 Verified

  selectedFile: DirEntry | null; // Single file shown in Inspector
  checkedFiles: Set<string>; // Multiple files marked for Transfer

  // ACTIONS
  setSourcePath: (path: string | null) => void;
  setDestPath: (path: string | null) => void;
  setFileList: (files: DirEntry[]) => void;
  setDestFiles: (files: Set<string>) => void;
  addVerifiedFile: (filename: string) => void;

  setSelectedFile: (file: DirEntry | null) => void;

  // CHECKBOX ACTIONS
  toggleChecked: (filename: string) => void;
  checkAllMissing: () => void;
  setAllChecked: (filenames: string[]) => void;
  clearChecked: () => void;

  resetSource: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  sourcePath: null,
  destPath: null,
  fileList: [],
  destFiles: new Set(),
  verifiedFiles: new Set(),
  selectedFile: null,
  checkedFiles: new Set(),

  // Actions
  setSourcePath: (path) => set({ sourcePath: path }),
  setDestPath: (path) => set({ destPath: path }),
  setFileList: (files) => set({ fileList: files }),
  setDestFiles: (files) => set({ destFiles: files }),

  // Add a single file to the verified list
  addVerifiedFile: (filename) =>
    set((state) => {
      const newSet = new Set(state.verifiedFiles);
      newSet.add(filename);
      return { verifiedFiles: newSet };
    }),

  setSelectedFile: (file) => set({ selectedFile: file }),

  // --- NEW BATCH LOGIC ---

  toggleChecked: (filename) =>
    set((state) => {
      const newSet = new Set(state.checkedFiles);
      if (newSet.has(filename)) {
        newSet.delete(filename);
      } else {
        newSet.add(filename);
      }
      return { checkedFiles: newSet };
    }),

  // Checks ONLY files that are NOT in the destination (Red dots)
  checkAllMissing: () => {
    const { fileList, destFiles } = get();
    const missing = fileList
      .filter((f) => !f.isDirectory && !destFiles.has(f.name))
      .map((f) => f.name);
    set({ checkedFiles: new Set(missing) });
  },

  setAllChecked: (filenames) => set({ checkedFiles: new Set(filenames) }),

  clearChecked: () => set({ checkedFiles: new Set() }),

  resetSource: () =>
    set({
      sourcePath: null,
      fileList: [],
      selectedFile: null,
      verifiedFiles: new Set(),
      checkedFiles: new Set(),
    }),
}));
