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
  // 1. GET THE SETTER
  // We need 'destFiles' and 'setDestFiles' to update the UI in real-time
  const { fileList, sourcePath, destPath, destFiles, setDestFiles } =
    useAppStore();

  const [isTransferring, setIsTransferring] = useState(false);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [progress, setProgress] = useState(0);

  async function startTransfer() {
    if (!sourcePath || !destPath || fileList.length === 0) return;

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
      for (const file of fileList) {
        if (file.isDirectory) continue;

        // Skip if already VERIFIED (Strict check)
        if (useAppStore.getState().verifiedFiles.has(file.name)) continue;

        const srcSeparator = sourcePath.endsWith("\\") ? "" : "\\";
        const destSeparator = destPath.endsWith("\\") ? "" : "\\";

        const fullSource = `${sourcePath}${srcSeparator}${file.name}`;
        const fullDest = `${destPath}${destSeparator}${file.name}`;

        // RUN TRANSFER & VERIFY
        // Now wait for the Result (which is the Hash String)
        await invoke("copy_file", { source: fullSource, dest: fullDest });

        // ✨ UPDATE STATE ✨
        // 1. Mark as Present (Green Dot)
        const currentDestFiles = new Set(useAppStore.getState().destFiles);
        currentDestFiles.add(file.name);
        setDestFiles(currentDestFiles);

        // 2. Mark as Verified (Shield Icon)
        useAppStore.getState().addVerifiedFile(file.name);
      }

      console.log("Transfer & Verification Complete!");
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
