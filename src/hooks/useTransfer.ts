import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "../store/appStore";

interface ProgressEvent {
  filename: string;
  total: number;
  transferred: number;
}

export function useTransfer() {
  // 1. GET THE STORE DATA
  const {
    fileList,
    sourcePath,
    destPath,
    destFiles,
    setDestFiles,
    addVerifiedFile,
    checkedFiles, // <--- Crucial: Needed for the filter logic below
  } = useAppStore();

  const [isTransferring, setIsTransferring] = useState(false);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [progress, setProgress] = useState(0);

  async function startTransfer() {
    if (!sourcePath || !destPath) return;

    // SAFETY: Require selection
    if (checkedFiles.size === 0) {
      console.warn("No files selected for transfer");
      return;
    }

    setIsTransferring(true);
    setProgress(0);

    const unlisten = await listen<ProgressEvent>(
      "transfer-progress",
      (event) => {
        const { transferred, total, filename } = event.payload;
        setCurrentFile(filename);
        if (total > 0) {
          setProgress(Math.round((transferred / total) * 100));
        }
      }
    );

    try {
      // FILTER: Only process files that are in the 'checkedFiles' Set
      const filesToTransfer = fileList.filter((f) => checkedFiles.has(f.name));

      for (const file of filesToTransfer) {
        if (file.isDirectory) continue;

        // Skip if already verified (Optimization)
        if (useAppStore.getState().verifiedFiles.has(file.name)) continue;

        const srcSeparator = sourcePath.endsWith("\\") ? "" : "\\";
        const destSeparator = destPath.endsWith("\\") ? "" : "\\";

        const fullSource = `${sourcePath}${srcSeparator}${file.name}`;
        const fullDest = `${destPath}${destSeparator}${file.name}`;

        // RUN TRANSFER
        await invoke("copy_file", { source: fullSource, dest: fullDest });

        // UPDATE STATE
        // 1. Mark as Present (Green Dot)
        const currentDestFiles = new Set(useAppStore.getState().destFiles);
        currentDestFiles.add(file.name);
        setDestFiles(currentDestFiles);

        // 2. Mark as Verified (Shield Icon)
        addVerifiedFile(file.name);
      }

      console.log("Batch Transfer Complete!");
    } catch (err) {
      console.error("Transfer Error:", err);
      // In a real app, we would show a toast notification here
    } finally {
      unlisten();
      setIsTransferring(false);
      setProgress(100);
      setTimeout(() => {
        setCurrentFile("");
        setProgress(0);
      }, 2000);
    }
  }

  return {
    startTransfer,
    isTransferring,
    currentFile,
    progress,
  };
}
