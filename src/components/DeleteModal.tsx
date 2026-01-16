import { useEffect, useState } from "react";
import { useAppStore } from "../store/appStore";
import { exists } from "@tauri-apps/plugin-fs";
// REMOVED: import { join } from "@tauri-apps/api/path";

// --- INLINE ICONS ---
function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 10.72a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}
// --------------------

type CheckStatus = "unchecked" | "checking" | "exists" | "missing";

export function DeleteModal() {
  const {
    isDeleteModalOpen,
    closeDeleteModal,
    filesToDelete,
    destPath,
    deleteSourceFiles,
  } = useAppStore();

  // State for the "Safety Check" feature
  const [checkingStatus, setCheckingStatus] = useState<
    Map<string, CheckStatus>
  >(new Map());
  const [isCheckingGlobal, setIsCheckingGlobal] = useState(false);
  const [hasRunCheck, setHasRunCheck] = useState(false);

  // --- NEW: DANGER OVERLAY STATE ---
  const [showDangerConfirm, setShowDangerConfirm] = useState(false);
  // -------------------------------

  // Reset state whenever the modal opens with new files
  useEffect(() => {
    if (isDeleteModalOpen) {
      const initialMap = new Map<string, CheckStatus>();
      filesToDelete.forEach((f) => initialMap.set(f, "unchecked"));
      setCheckingStatus(initialMap);
      setHasRunCheck(false);
      setIsCheckingGlobal(false);
      setShowDangerConfirm(false); // Reset danger state
    }
  }, [isDeleteModalOpen, filesToDelete]);

  if (!isDeleteModalOpen) return null;

  // --- THE DOUBLE CHECK LOGIC ---
  async function runSafetyCheck() {
    if (!destPath) return;
    setIsCheckingGlobal(true);
    setHasRunCheck(true);

    const newStatusMap = new Map(checkingStatus);

    // Mark all as checking visually first
    filesToDelete.forEach((f) => newStatusMap.set(f, "checking"));
    setCheckingStatus(new Map(newStatusMap));

    // --- FIX: Manual Path Construction (Matches useTransfer.ts) ---
    const separator =
      destPath.endsWith("\\") || destPath.endsWith("/") ? "" : "\\";
    // -------------------------------------------------------------

    for (const filename of filesToDelete) {
      try {
        // --- FIX: Use simple string concat instead of async join ---
        const fullDestPath = `${destPath}${separator}${filename}`;
        console.log("🔍 Checking Backup Path:", fullDestPath); // DEBUG LOG

        // The actual physical check on disk
        const doesExist = await exists(fullDestPath);

        newStatusMap.set(filename, doesExist ? "exists" : "missing");
        // Update map incrementally for live feedback
        setCheckingStatus(new Map(newStatusMap));
      } catch (err) {
        console.error("Safety check failed for:", filename, err);
        newStatusMap.set(filename, "missing");
        setCheckingStatus(new Map(newStatusMap));
      }
      // Small artificial delay so the UI doesn't flash too fast
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    setIsCheckingGlobal(false);
  }

  // --- THE EXECUTION LOGIC ---
  async function handleConfirmDelete() {
    // UPDATED: If skipping check, use full list. If checked, filter safe ones.
    const filesToProcess = hasRunCheck
      ? filesToDelete.filter((f) => checkingStatus.get(f) === "exists")
      : filesToDelete;

    if (filesToProcess.length > 0) {
      await deleteSourceFiles(filesToProcess);
    }
    closeDeleteModal();
  }

  // --- NEW: INTERCEPT BUTTON CLICK ---
  const handleInitialClick = () => {
    // 1. If check was run AND files are safe -> Delete normally
    if (hasRunCheck) {
      handleConfirmDelete();
    } else {
      // 2. If check NOT run -> Show Danger Warning
      setShowDangerConfirm(true);
    }
  };
  // ---------------------------------

  // Calculate how many are safe to delete after the check
  const filesSafeToDeleteCount = filesToDelete.filter(
    (f) => checkingStatus.get(f) === "exists"
  ).length;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Modal Container - Red Border for Danger Zone */}
      <div
        className="bg-zinc-900 border-2 border-red-900/50 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 overflow-hidden relative" // Added relative for overlay
        onClick={(e) => e.stopPropagation()}
      >
        {/* --- NEW: DANGER OVERLAY (Only visible when forcing delete) --- */}
        {showDangerConfirm && (
          <div className="absolute inset-0 bg-zinc-950/95 z-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-8 h-8 text-red-500"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-red-500 mb-2">
              Wait! Are you absolutely sure?
            </h3>
            <p className="text-zinc-400 max-w-md mb-8">
              You haven't run the safety check. If your backup drive is
              corrupted or disconnected, these files will be{" "}
              <strong className="text-red-400">lost forever</strong>.
            </p>
            <div className="flex gap-4 w-full max-w-sm">
              <button
                onClick={() => setShowDangerConfirm(false)}
                className="flex-1 py-3 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-3 rounded bg-red-600 hover:bg-red-500 text-white font-bold transition-colors shadow-lg shadow-red-900/20"
              >
                Yes, Delete It
              </button>
            </div>
          </div>
        )}
        {/* ------------------------------------------------------------- */}

        {/* Header */}
        <div className="p-4 border-b border-red-900/30 flex justify-between items-center bg-red-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-900/30 rounded-full">
              <TrashIcon className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-100 leading-tight">
                Permanently Delete Files?
              </h2>
              <p className="text-xs text-red-400 mt-0.5">
                This action is irreversible.
              </p>
            </div>
          </div>
          <button
            onClick={closeDeleteModal}
            className="p-1 rounded-full hover:bg-red-900/40 text-zinc-400 hover:text-red-300 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Body - File List with Check Status */}
        <div className="p-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent bg-zinc-900/50">
          <p className="text-sm text-zinc-400 mb-3">
            The following files are verified in the manifest. Run the safety
            check to confirm they still exist on the backup drive before
            deleting.
          </p>
          <ul className="space-y-1">
            {filesToDelete.map((filename) => {
              const status = checkingStatus.get(filename);
              return (
                <li
                  key={filename}
                  className={`flex items-center justify-between p-2 rounded border text-sm transition-colors ${
                    status === "missing"
                      ? "bg-red-950/30 border-red-900/50 text-red-300"
                      : status === "exists"
                      ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-300"
                      : "bg-zinc-800/50 border-zinc-800 text-zinc-300"
                  }`}
                >
                  <span className="truncate mr-4">{filename}</span>
                  {/* STATUS INDICATORS */}
                  <div className="shrink-0">
                    {status === "checking" && (
                      <div className="w-4 h-4 border-2 border-t-zinc-400 border-r-zinc-400 border-b-zinc-700 border-l-zinc-700 rounded-full animate-spin" />
                    )}
                    {status === "exists" && (
                      <div className="flex items-center gap-1 text-xs font-medium text-emerald-500">
                        <CheckCircleIcon className="w-4 h-4" />
                        <span className="uppercase tracking-wider">
                          Exists on Backup
                        </span>
                      </div>
                    )}
                    {status === "missing" && (
                      <div className="flex items-center gap-1 text-xs font-medium text-red-500">
                        <XMarkIcon className="w-4 h-4" />
                        <span className="uppercase tracking-wider">
                          Missing from Backup
                        </span>
                      </div>
                    )}
                    {status === "unchecked" && (
                      <span className="text-zinc-600 text-xs uppercase tracking-wider">
                        Needs Check
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer - Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 flex justify-between items-center gap-3">
          <button
            onClick={runSafetyCheck}
            disabled={isCheckingGlobal || !destPath}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-all flex items-center gap-2
              ${
                isCheckingGlobal
                  ? "bg-zinc-800 text-zinc-500 border-zinc-800 cursor-wait"
                  : !destPath
                  ? "bg-zinc-800 text-zinc-500 border-zinc-800 cursor-not-allowed opacity-70"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 shadow-sm active:scale-95"
              }
            `}
          >
            {isCheckingGlobal ? "Checking Backup..." : "Run Safety Check"}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={closeDeleteModal}
              className="px-4 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            {/* UPDATED: Button is always enabled if list is non-empty */}
            <button
              onClick={handleInitialClick}
              disabled={false} // Always allowed, but intercepted
              className={`px-4 py-2 rounded-md text-sm font-medium border transition-all shadow-lg flex items-center gap-2
                bg-red-600 hover:bg-red-500 text-white border-red-500 active:scale-95 shadow-red-900/30
              `}
            >
              <TrashIcon className="w-4 h-4" />
              {hasRunCheck
                ? `Delete ${filesSafeToDeleteCount} Forever`
                : "Delete Forever"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
