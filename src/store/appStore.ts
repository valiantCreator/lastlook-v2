import { create } from "zustand";
import { DirEntry } from "@tauri-apps/plugin-fs";

interface AppState {
  // DATA
  sourcePath: string | null;
  destPath: string | null;
  fileList: DirEntry[];
  destFiles: Set<string>;
  verifiedFiles: Set<string>; // <--- NEW: Track verified files
  selectedFile: DirEntry | null;

  // ACTIONS
  setSourcePath: (path: string | null) => void;
  setDestPath: (path: string | null) => void;
  setFileList: (files: DirEntry[]) => void;
  setDestFiles: (files: Set<string>) => void;
  addVerifiedFile: (filename: string) => void; // <--- NEW: Action
  setSelectedFile: (file: DirEntry | null) => void;

  // RESET
  resetSource: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial State
  sourcePath: null,
  destPath: null,
  fileList: [],
  destFiles: new Set(),
  verifiedFiles: new Set(), // <--- NEW: Initial State
  selectedFile: null,

  // Actions
  setSourcePath: (path) => set({ sourcePath: path }),
  setDestPath: (path) => set({ destPath: path }),
  setFileList: (files) => set({ fileList: files }),
  setDestFiles: (files) => set({ destFiles: files }),

  // NEW: Add a single file to the verified list
  addVerifiedFile: (filename) =>
    set((state) => {
      const newSet = new Set(state.verifiedFiles);
      newSet.add(filename);
      return { verifiedFiles: newSet };
    }),

  setSelectedFile: (file) => set({ selectedFile: file }),

  resetSource: () =>
    set({
      sourcePath: null,
      fileList: [],
      selectedFile: null,
      verifiedFiles: new Set(),
    }),
}));
