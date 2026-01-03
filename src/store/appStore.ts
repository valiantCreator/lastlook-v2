import { create } from "zustand";
import { DirEntry } from "@tauri-apps/plugin-fs";

interface AppState {
  // DATA
  sourcePath: string | null;
  destPath: string | null;
  fileList: DirEntry[];
  destFiles: Set<string>; // Fast lookup for existing files

  // ACTIONS (The only way to change data)
  setSourcePath: (path: string | null) => void;
  setDestPath: (path: string | null) => void;
  setFileList: (files: DirEntry[]) => void;
  setDestFiles: (files: Set<string>) => void;

  // RESET
  resetSource: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial State
  sourcePath: null,
  destPath: null,
  fileList: [],
  destFiles: new Set(),

  // Actions
  setSourcePath: (path) => set({ sourcePath: path }),
  setDestPath: (path) => set({ destPath: path }),
  setFileList: (files) => set({ fileList: files }),
  setDestFiles: (files) => set({ destFiles: files }),

  resetSource: () => set({ sourcePath: null, fileList: [] }),
}));
