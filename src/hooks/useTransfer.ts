import { useState, useRef } from "react";
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
    addVerifyingFile,
    removeVerifyingFile,
    checkedFiles,
  } = useAppStore();

  const [isTransferring, setIsTransferring] = useState(false);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [progress, setProgress] = useState(0);

  // ABORT REF: Immediate local state to break the loop
  const abortRef = useRef(false);

  // 🛑 CANCEL FUNCTION
  async function cancelTransfer() {
    console.log("🛑 CANCEL REQUESTED");
    abortRef.current = true; // 1. Local Break
    await invoke("cancel_transfer"); // 2. Rust Break
    setIsTransferring(false);
    setCurrentFile("Cancelled");
  }

  async function startTransfer() {
    if (!sourcePath || !destPath) return;
    if (checkedFiles.size === 0) return;

    // RESET STATE
    setIsTransferring(true);
    setProgress(0);
    abortRef.current = false; // Reset the brake

    // Ensure Rust state is clean (optional, but good practice)
    // await invoke('reset_cancel_flag'); // If we exposed this, but copy_file checks on entry anyway.

    // 1. LISTEN FOR PROGRESS (Update Bar)
    const unlistenProgress = await listen<ProgressEvent>(
      "transfer-progress",
      (event) => {
        const { transferred, total, filename } = event.payload;
        setCurrentFile(filename);
        if (total > 0) setProgress(Math.round((transferred / total) * 100));
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
        // 🛑 LOOP CHECK: Did user hit stop?
        if (abortRef.current) {
          console.log("🛑 Loop Terminated by User");
          break;
        }

        if (file.isDirectory) continue;

        // Skip if already verified (Optimization)
        if (useAppStore.getState().verifiedFiles.has(file.name)) continue;

        const srcSeparator = sourcePath.endsWith("\\") ? "" : "\\";
        const destSeparator = destPath.endsWith("\\") ? "" : "\\";

        const fullSource = `${sourcePath}${srcSeparator}${file.name}`;
        const fullDest = `${destPath}${destSeparator}${file.name}`;

        try {
          // RUN TRANSFER
          await invoke("copy_file", { source: fullSource, dest: fullDest });

          // SUCCESS HANDLERS
          removeVerifyingFile(file.name);
          const currentDestFiles = new Set(useAppStore.getState().destFiles);
          currentDestFiles.add(file.name);
          setDestFiles(currentDestFiles);
          addVerifiedFile(file.name);
        } catch (err: any) {
          // IF CANCELLED, STOP EVERYTHING
          if (err.toString().includes("CANCELLED")) {
            console.warn("Transfer Cancelled: ", file.name);
            removeVerifyingFile(file.name);
            break; // Break the for-loop
          }
          console.error("Transfer Error:", err);
          removeVerifyingFile(file.name);
        }
      }
    } catch (err) {
      console.error("Batch Error:", err);
    } finally {
      // Clean up listeners
      unlistenProgress();
      unlistenVerifying();
      setIsTransferring(false);

      if (!abortRef.current) {
        setProgress(100);
        setTimeout(() => {
          setCurrentFile("");
          setProgress(0);
        }, 2000);
      } else {
        // If cancelled, reset immediately
        setCurrentFile("Stopped");
        setProgress(0);
      }
    }
  }

  return {
    startTransfer,
    cancelTransfer, // <--- Export this
    isTransferring,
    currentFile,
    progress,
  };
}
