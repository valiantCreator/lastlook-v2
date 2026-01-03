import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import { useAppStore } from "../store/appStore";

export function useFileSystem() {
  const { setSourcePath, setFileList, setDestPath, resetSource, setDestFiles } =
    useAppStore();

  // 1. SCAN SOURCE
  async function scanSource() {
    const currentPath = useAppStore.getState().sourcePath;
    if (!currentPath) return;

    try {
      const entries = await readDir(currentPath);
      // Sort: Folders first, then Files alphabetically
      const sorted = entries.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });
      setFileList(sorted);

      // OPTIONAL: If we have a dest, we should re-check for sync status
      const destPath = useAppStore.getState().destPath;
      if (destPath) {
        scanDest(destPath);
      }
    } catch (err) {
      console.error("Failed to read directory:", err);
      setFileList([]);
    }
  }

  // 2. SCAN DESTINATION (NEW FIX 🛠️)
  async function scanDest(path: string) {
    try {
      const entries = await readDir(path);
      // We only care about filenames to match against the source
      const fileNames = entries
        .filter((e) => !e.isDirectory)
        .map((e) => e.name);

      setDestFiles(new Set(fileNames));
    } catch (err) {
      console.error("Failed to read destination:", err);
      setDestFiles(new Set());
    }
  }

  // 3. SELECT SOURCE DIALOG
  async function selectSource() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Source Folder",
      });

      if (selected && typeof selected === "string") {
        setSourcePath(selected);
        // App.tsx useEffect triggers scanSource()
      }
    } catch (err) {
      console.error("Selection cancelled or failed", err);
    }
  }

  // 4. SELECT DESTINATION DIALOG
  async function selectDest() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Destination Folder",
      });

      if (selected && typeof selected === "string") {
        setDestPath(selected);
        // Trigger the scan immediately to update Green Dots
        scanDest(selected);
      }
    } catch (err) {
      console.error("Dest Selection failed", err);
    }
  }

  // 5. RESET ACTIONS
  function clearSource() {
    resetSource();
  }

  function unmountDest() {
    setDestPath(null);
    setDestFiles(new Set());
  }

  return {
    selectSource,
    selectDest,
    scanSource,
    scanDest, // <--- Exported for use in App.tsx effects
    clearSource,
    unmountDest,
  };
}
