import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import { useAppStore } from "../store/appStore";

export function useFileSystem() {
  // Access the store
  const {
    setSourcePath,
    setDestPath,
    setFileList,
    setDestFiles,
    sourcePath,
    destPath,
  } = useAppStore();

  // 1. ACTION: Select Source
  async function selectSource() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Source Media",
      });

      if (selected) {
        const path = selected as string;
        setSourcePath(path);

        // Scan immediately
        const entries = await readDir(path);
        const visible = entries.filter((file) => !file.name.startsWith("."));
        setFileList(visible);
      }
    } catch (err) {
      console.error("Failed to select source:", err);
    }
  }

  // 2. ACTION: Select Destination
  async function selectDest() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Backup Destination",
      });

      if (selected) {
        setDestPath(selected as string);
      }
    } catch (err) {
      console.error("Failed to select destination:", err);
    }
  }

  // 3. EFFECT: Monitor Destination for Changes
  // This automatically re-scans the destination whenever the path changes
  useEffect(() => {
    async function scanDest() {
      if (!destPath) {
        setDestFiles(new Set());
        return;
      }
      try {
        const entries = await readDir(destPath);
        const fileSet = new Set(entries.map((e) => e.name));
        setDestFiles(fileSet);
      } catch (err) {
        console.error("Failed to read dest:", err);
      }
    }
    scanDest();
  }, [destPath, setDestFiles]);

  // Return the functions the UI needs
  return {
    selectSource,
    selectDest,
  };
}
