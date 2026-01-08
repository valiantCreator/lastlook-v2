import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { stat } from "@tauri-apps/plugin-fs";
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
    verifiedFiles,
    destFiles,
    setConflicts,
    // --- NEW STORE ACTIONS ---
    setBatchInfo,
    addCompletedBytes,
    setTransferStartTime,
    resetJobMetrics, // <--- 1. IMPORTED RESET ACTION
  } = useAppStore();

  const [isTransferring, setIsTransferring] = useState(false);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [progress, setProgress] = useState(0);

  // NEW: Track raw bytes of the *active* file for Live Math
  const [currentFileBytes, setCurrentFileBytes] = useState(0);

  // ABORT REF
  const abortRef = useRef(false);

  // 1. CANCEL
  async function cancelTransfer() {
    console.log("🛑 CANCEL REQUESTED");
    abortRef.current = true;
    await invoke("cancel_transfer");
    setIsTransferring(false);
    setCurrentFile("Cancelled");
    setCurrentFileBytes(0);
  }

  // 2. PRE-FLIGHT CHECK
  function startTransfer() {
    if (!sourcePath || !destPath || checkedFiles.size === 0) return;

    // A. Detect Conflicts
    const { destFiles } = useAppStore.getState();
    const conflicts: string[] = [];

    checkedFiles.forEach((filename) => {
      if (destFiles.has(filename)) {
        conflicts.push(filename);
      }
    });

    if (conflicts.length > 0) {
      // B. Found Conflicts -> Pause & Show Modal
      console.log("Found conflicts:", conflicts);
      setConflicts(conflicts);
      return;
    }

    // C. No Conflicts -> Go
    executeTransfer(false);
  }

  // 3. RESOLUTION HANDLERS
  function resolveOverwrite() {
    setConflicts([]);
    executeTransfer(false);
  }

  function resolveSkip() {
    setConflicts([]);
    executeTransfer(true);
  }

  // 4. THE MAIN LOOP
  async function executeTransfer(skipExisting: boolean) {
    setIsTransferring(true);
    setProgress(0);
    setCurrentFileBytes(0);
    abortRef.current = false;

    // --- NEW: INITIALIZE BATCH STATS ---
    setTransferStartTime(Date.now());

    // Calculate Total Batch Size (Async)
    const filesToTransfer = fileList.filter((f) => checkedFiles.has(f.name));

    // We Map to get sizes first to set the "Total" bar
    const sizes = await Promise.all(
      filesToTransfer.map(async (f) => {
        try {
          const separator = sourcePath!.endsWith("\\") ? "" : "\\";
          const info = await stat(`${sourcePath}${separator}${f.name}`);
          return info.size;
        } catch {
          return 0;
        }
      })
    );

    const totalBatchBytes = sizes.reduce((acc, curr) => acc + curr, 0);
    setBatchInfo(totalBatchBytes); // Set the "Goal" for the global bar

    // Listeners
    const unlistenProgress = await listen<ProgressEvent>(
      "transfer-progress",
      (event) => {
        const { transferred, total, filename } = event.payload;
        setCurrentFile(filename);
        setCurrentFileBytes(transferred); // <--- LIVE UPDATES
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
      // We loop through the filesToTransfer array we already filtered
      for (const file of filesToTransfer) {
        // 🛑 LOOP CHECK: Did user hit stop?
        if (abortRef.current) {
          console.log("🛑 Loop Terminated by User");
          break;
        }

        if (file.isDirectory) continue;

        // Reset local bytes for next file
        setCurrentFileBytes(0);

        // --- GET FILE SIZE FOR ACCOUNTING ---
        let fileSize = 0;
        const separator = sourcePath!.endsWith("\\") ? "" : "\\";
        const destSep = destPath!.endsWith("\\") ? "" : "\\";

        try {
          const info = await stat(`${sourcePath}${separator}${file.name}`);
          fileSize = info.size;
        } catch {
          /* ignore */
        }

        // --- SKIP LOGIC ---
        if (skipExisting && destFiles.has(file.name)) {
          console.log(`Skipping existing file: ${file.name}`);
          addCompletedBytes(fileSize); // Mark this chunk as "Done" (Skipped)
          continue;
        }

        // Optimization: Skip if already verified
        if (verifiedFiles.has(file.name)) {
          addCompletedBytes(fileSize); // Mark this chunk as "Done" (Already there)
          continue;
        }

        const fullSource = `${sourcePath}${separator}${file.name}`;
        const fullDest = `${destPath}${destSep}${file.name}`;

        try {
          // RUN TRANSFER
          await invoke("copy_file", { source: fullSource, dest: fullDest });

          // --- FIX: SNAP UI TO DONE IMMEDIATELY ---
          // This forces the bar to 100% green the moment Rust returns success
          setProgress(100);
          // ----------------------------------------

          // SUCCESS
          removeVerifyingFile(file.name);
          const currentDestFiles = new Set(useAppStore.getState().destFiles);
          currentDestFiles.add(file.name);
          setDestFiles(currentDestFiles);
          addVerifiedFile(file.name);

          // --- UPDATE GLOBAL PROGRESS ---
          setCurrentFileBytes(0); // Reset local because we are adding to global
          addCompletedBytes(fileSize);
        } catch (err: any) {
          // IF CANCELLED, STOP EVERYTHING
          if (err.toString().includes("CANCELLED")) {
            console.warn("Transfer Cancelled: ", file.name);
            removeVerifyingFile(file.name);
            break;
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
        // FIX: Reduced delay from 2000ms to 1000ms for snappier feel
        setTimeout(() => {
          setCurrentFile("");
          setProgress(0);
          setCurrentFileBytes(0);
          resetJobMetrics();
        }, 1000);
      } else {
        // If cancelled, reset immediately
        setCurrentFile("Stopped");
        setProgress(0);
        setCurrentFileBytes(0);
        resetJobMetrics();
      }
    }
  }

  return {
    startTransfer,
    cancelTransfer,
    resolveOverwrite,
    resolveSkip,
    isTransferring,
    currentFile,
    currentFileBytes, // <--- EXPOSE THIS
    progress,
  };
}
