import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { stat } from "@tauri-apps/plugin-fs";
import { useAppStore } from "../store/appStore";
import { type, hostname } from "@tauri-apps/plugin-os";
import { getVersion } from "@tauri-apps/api/app";
import { updateManifest } from "../utils/manifest";

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
    resetJobMetrics,
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
    executeTransfer(false); // <--- Matches "Overwrite All" behavior
  }

  function resolveSkip() {
    setConflicts([]);
    executeTransfer(true); // <--- Matches "Skip Existing" behavior
  }

  // 4. THE MAIN LOOP
  async function executeTransfer(skipExisting: boolean) {
    setIsTransferring(true);
    setProgress(0);
    setCurrentFileBytes(0);
    abortRef.current = false;

    // --- NEW: INITIALIZE BATCH STATS ---
    setTransferStartTime(Date.now());

    // --- NEW: PREPARE MANIFEST METADATA (Session Context) ---
    const sessionId = crypto.randomUUID();
    let machineName = "Unknown-Machine";
    let osType = "unknown";
    let appVer = "0.0.0";

    try {
      // FIX: Handle potential NULLs from Tauri plugins
      const host = await hostname();
      const os = await type();
      const ver = await getVersion();

      machineName = host || "Unknown-Machine";
      osType = os || "unknown";
      appVer = ver || "0.0.0";
    } catch (e) {
      console.warn("Could not fetch machine metadata", e);
    }

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

        // --- PATH HELPERS ---
        const separator = sourcePath!.endsWith("\\") ? "" : "\\";
        const destSep = destPath!.endsWith("\\") ? "" : "\\";
        const fullSource = `${sourcePath}${separator}${file.name}`;
        const fullDest = `${destPath}${destSep}${file.name}`;

        // --- GET FILE SIZE FOR ACCOUNTING & SMART CHECK ---
        let fileSize = 0;
        let sourceStats = null;

        try {
          sourceStats = await stat(fullSource);
          fileSize = sourceStats.size;
        } catch (err) {
          console.warn(`Failed to stat source file ${file.name}:`, err);
        }

        // --- SKIP LOGIC (Explicit User Choice from Modal "Skip Existing") ---
        if (skipExisting && destFiles.has(file.name)) {
          console.log(`Explicit Skip: ${file.name}`);
          addCompletedBytes(fileSize);
          continue;
        }

        // --- SMART RESUME CHECK (Implicit) ---
        // Even if user chose "Overwrite" (skipExisting=false), we check if they are identical.
        if (destFiles.has(file.name)) {
          // DEBUG LOG: Proving we entered the check
          console.log(`🔎 Checking Smart Resume for: ${file.name}`);

          if (sourceStats) {
            try {
              const destStats = await stat(fullDest);

              const isSameSize = destStats.size === fileSize;

              // Date Comparison (3-second tolerance for ExFAT/FAT32 rounding)
              let isSameDate = false;
              let srcTime = 0;
              let dstTime = 0;

              if (sourceStats.mtime && destStats.mtime) {
                srcTime = new Date(sourceStats.mtime).getTime();
                dstTime = new Date(destStats.mtime).getTime();
                const diff = Math.abs(srcTime - dstTime);
                if (diff < 3000) {
                  isSameDate = true;
                }
              }

              // LOG THE COMPARISON RESULT
              console.log(
                `   > Stats: Size[${isSameSize ? "MATCH" : "DIFF"}] Date[${
                  isSameDate ? "MATCH" : "DIFF"
                }]`
              );
              if (!isSameSize)
                console.log(`   > Size: ${fileSize} vs ${destStats.size}`);
              if (!isSameDate)
                console.log(`   > Date: ${srcTime} vs ${dstTime}`);

              if (isSameSize && isSameDate) {
                console.log(
                  `⏭️ Smart Resume: Skipping ${file.name} (Identical)`
                );
                addVerifiedFile(file.name); // Mark Green
                addCompletedBytes(fileSize); // Advance Bar

                // Ensure destFiles set is synced
                const currentDestFiles = new Set(
                  useAppStore.getState().destFiles
                );
                currentDestFiles.add(file.name);
                setDestFiles(currentDestFiles);

                continue; // <--- SKIP TRANSFER
              } else {
                console.log(`   > Files differ. Overwriting...`);
              }
            } catch (err) {
              console.warn(
                `   > Smart Check failed (could not stat dest):`,
                err
              );
            }
          } else {
            console.warn(`   > Smart Check skipped: No Source Stats`);
          }
        }

        // Optimization: Skip if already verified in this session
        if (verifiedFiles.has(file.name)) {
          addCompletedBytes(fileSize);
          continue;
        }

        try {
          // RUN TRANSFER
          // --- CHANGE: Capture the Hash String from Rust ---
          const hash = await invoke<string>("copy_file", {
            source: fullSource,
            dest: fullDest,
          });

          // --- CHANGE: MANIFEST UPDATE ---
          // Update the Digital Receipt immediately
          await updateManifest(
            destPath!,
            {
              filename: file.name,
              rel_path: file.name,
              source_path: fullSource.replace(/\\/g, "/"), // <--- FIXED: Normalize to Forward Slashes
              size_bytes: fileSize,
              modified_timestamp: sourceStats?.mtime
                ? new Date(sourceStats.mtime).getTime()
                : Date.now(),
              hash_type: "xxh3_64",
              hash_value: hash, // The hash from Rust
              status: "verified",
              verified_at: new Date().toISOString(),
            },
            {
              machineName,
              os: osType,
              appVersion: appVer,
              sessionId,
            }
          );
          // -------------------------------

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
    currentFileBytes,
    progress,
  };
}
