import { create } from "zustand";
import { DirEntry } from "@tauri-apps/plugin-fs";

interface AppState {
  // DATA
  sourcePath: string | null;
  destPath: string | null;
  fileList: DirEntry[];
  destFiles: Set<string>;
  selectedFile: DirEntry | null; // <--- NEW: Track Selection

  // ACTIONS
  setSourcePath: (path: string | null) => void;
  setDestPath: (path: string | null) => void;
  setFileList: (files: DirEntry[]) => void;
  setDestFiles: (files: Set<string>) => void;
  setSelectedFile: (file: DirEntry | null) => void; // <--- NEW: Action

  // RESET
  resetSource: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial State
  sourcePath: null,
  destPath: null,
  fileList: [],
  destFiles: new Set(),
  selectedFile: null, // <--- NEW: Initial State

  // Actions
  setSourcePath: (path) => set({ sourcePath: path }),
  setDestPath: (path) => set({ destPath: path }),
  setFileList: (files) => set({ fileList: files }),
  setDestFiles: (files) => set({ destFiles: files }),
  setSelectedFile: (file) => set({ selectedFile: file }), // <--- NEW: Implementation

  resetSource: () =>
    set({ sourcePath: null, fileList: [], selectedFile: null }),
}));
