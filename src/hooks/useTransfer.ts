import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "../store/appStore";

interface ProgressEvent {
  filename: string;
  total: number;
  transferred: number;
}

interface VerifyingEvent {
  filename: string;
}

export function useTransfer() {
  // 1. GET THE STORE DATA
  const {
    fileList,
    sourcePath,
    destPath,
    setDestFiles,
    addVerifiedFile,
    addVerifyingFile, // <--- NEW ACTION
    removeVerifyingFile, // <--- NEW ACTION
    checkedFiles,
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

    // 1. LISTEN FOR PROGRESS (Update Bar)
    const unlistenProgress = await listen<ProgressEvent>(
      "transfer-progress",
      (event) => {
        const { transferred, total, filename } = event.payload;
        setCurrentFile(filename);
        if (total > 0) {
          setProgress(Math.round((transferred / total) * 100));
        }
      }
    );

    // 2. LISTEN FOR VERIFYING (Turn Dot Yellow)
    const unlistenVerifying = await listen<VerifyingEvent>(
      "transfer-verifying",
      (event) => {
        const { filename } = event.payload;
        // This turns the dot Yellow instantly while Rust keeps working
        addVerifyingFile(filename);
        setCurrentFile(`${filename} (Verifying...)`);
      }
    );

    try {
      const filesToTransfer = fileList.filter((f) => checkedFiles.has(f.name));

      for (const file of filesToTransfer) {
        if (file.isDirectory) continue;

        // Skip if already verified (Optimization)
        if (useAppStore.getState().verifiedFiles.has(file.name)) continue;

        const srcSeparator = sourcePath.endsWith("\\") ? "" : "\\";
        const destSeparator = destPath.endsWith("\\") ? "" : "\\";

        const fullSource = `${sourcePath}${srcSeparator}${file.name}`;
        const fullDest = `${destPath}${destSeparator}${file.name}`;

        // RUN TRANSFER (Rust will emit 'transfer-verifying' halfway through)
        await invoke("copy_file", { source: fullSource, dest: fullDest });

        // TRANSFER COMPLETE
        // 1. Remove "Verifying" status (Yellow off)
        removeVerifyingFile(file.name);

        // 2. Mark as Present (Green Dot)
        const currentDestFiles = new Set(useAppStore.getState().destFiles);
        currentDestFiles.add(file.name);
        setDestFiles(currentDestFiles);

        // 3. Mark as Verified (Shield Icon)
        addVerifiedFile(file.name);
      }

      console.log("Batch Transfer Complete!");
    } catch (err) {
      console.error("Transfer Error:", err);
      // Safety: If error, remove verifying status so it doesn't get stuck on Yellow
      // We can iterate checked files to be safe, or just clear the specific one if we tracked it
      useAppStore
        .getState()
        .fileList.forEach((f) => removeVerifyingFile(f.name));
    } finally {
      // Clean up listeners
      unlistenProgress();
      unlistenVerifying();

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
