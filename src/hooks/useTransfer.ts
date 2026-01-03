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

        // Skip if already synced (Optional optimization)
        if (destFiles.has(file.name)) continue;

        const srcSeparator = sourcePath.endsWith("\\") ? "" : "\\";
        const destSeparator = destPath.endsWith("\\") ? "" : "\\";

        const fullSource = `${sourcePath}${srcSeparator}${file.name}`;
        const fullDest = `${destPath}${destSeparator}${file.name}`;

        // RUN TRANSFER
        await invoke("copy_file", { source: fullSource, dest: fullDest });

        // ✨ INSTANT UI UPDATE ✨
        // We create a new Set based on the old one, add the new file, and save it.
        // This triggers React to re-render the FileList immediately.
        const newSet = new Set(useAppStore.getState().destFiles);
        newSet.add(file.name);
        setDestFiles(newSet);
      }

      console.log("Transfer Complete!");
    } catch (err) {
      console.error("Transfer Error:", err);
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
