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
    setConflicts, // <--- NEW
  } = useAppStore();

  const [isTransferring, setIsTransferring] = useState(false);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [progress, setProgress] = useState(0);

  // ABORT REF: Immediate local state to break the loop
  const abortRef = useRef(false);

  // 1. CANCEL
  async function cancelTransfer() {
    console.log("🛑 CANCEL REQUESTED");
    abortRef.current = true;
    await invoke("cancel_transfer");
    setIsTransferring(false);
    setCurrentFile("Cancelled");
  }

  // 2. PRE-FLIGHT CHECK (Triggers Modal if needed)
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
      setConflicts(conflicts); // This opens the modal in App.tsx
      return;
    }

    // C. No Conflicts -> Go straight to overwrite mode (safe because nothing to overwrite)
    executeTransfer(false);
  }

  // 3. RESOLUTION HANDLERS
  function resolveOverwrite() {
    setConflicts([]); // Close Modal
    executeTransfer(false); // False = Don't skip, just overwrite
  }

  function resolveSkip() {
    setConflicts([]); // Close Modal
    executeTransfer(true); // True = Skip existing files
  }

  // 4. THE MAIN LOOP (Now accepts skipExisting flag)
  async function executeTransfer(skipExisting: boolean) {
    setIsTransferring(true);
    setProgress(0);
    abortRef.current = false;

    // Listeners
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

        // --- SKIP LOGIC ---
        // If skipExisting is TRUE, and file is in destFiles, we skip it.
        if (skipExisting && useAppStore.getState().destFiles.has(file.name)) {
          console.log(`Skipping existing file: ${file.name}`);
          continue;
        }

        // Optimization: Skip if already verified in this session
        if (useAppStore.getState().verifiedFiles.has(file.name)) continue;

        const srcSeparator = sourcePath!.endsWith("\\") ? "" : "\\";
        const destSeparator = destPath!.endsWith("\\") ? "" : "\\";

        const fullSource = `${sourcePath}${srcSeparator}${file.name}`;
        const fullDest = `${destPath}${destSeparator}${file.name}`;

        try {
          // RUN TRANSFER
          await invoke("copy_file", { source: fullSource, dest: fullDest });

          // SUCCESS
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
    startTransfer, // The public trigger
    cancelTransfer,
    resolveOverwrite, // <--- New Export
    resolveSkip, // <--- New Export
    isTransferring,
    currentFile,
    progress,
  };
}
