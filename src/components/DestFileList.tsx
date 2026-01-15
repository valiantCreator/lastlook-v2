import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/appStore";

// --- NEW: INLINE SHIELD ICON (No dependencies required) ---
// --- UPDATED: Now wrapped in logic inside the main return, so we keep this simple.
function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
        clipRule="evenodd"
      />
    </svg>
  );
}
// ---------------------------------------------------------

interface DestFileListProps {
  files: Set<string>;
  // --- NEW: CONTEXT MENU PROP ---
  onContextMenu: (e: React.MouseEvent, path: string) => void;
}

export function DestFileList({ files, onContextMenu }: DestFileListProps) {
  const {
    // --- CHANGED: USE NEW MULTI-SELECT STATE ---
    selectedFiles,
    selectFile,
    clearSelection,
    // -------------------------------------------
    sourcePath,
    fileList,
    manifestMap,
    destPath,
  } = useAppStore();

  const [showSyncedOnly, setShowSyncedOnly] = useState(false);

  // 1. CALCULATE ORPHANS
  // We need to know which Dest files exist in Source to color them Green vs Red
  const sourceFileNames = new Set(fileList.map((f) => f.name));

  // 2. FILTER & SORT
  const displayFiles = Array.from(files)
    .filter((f) => !showSyncedOnly || sourceFileNames.has(f)) // Hide Orphans if toggled
    .sort();

  // Refs for auto-scrolling
  const activeRef = useRef<HTMLDivElement>(null);

  // AUTO-SCROLL EFFECT
  useEffect(() => {
    if (activeRef.current) {
      // FIX: Changed to 'nearest' to prevent "Ground Breaking" window scroll glitch
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedFiles]);

  if (files.size === 0) {
    return (
      <div className="flex-1 flex items-center justify-center opacity-30">
        <p className="text-xs">Destination is empty</p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col min-h-0"
      // CHANGE: Clicking the empty background deselects the file
      onClick={() => clearSelection()}
    >
      {/* FILTER TOOLBAR (Sticky Top) */}
      <div
        className="px-2 py-1.5 border-b border-zinc-800/50 bg-zinc-900/50 flex justify-end shrink-0"
        onClick={(e) => e.stopPropagation()} // Prevent toolbar clicks from deselecting
      >
        <label className="flex items-center gap-2 cursor-pointer group">
          <span className="text-[9px] uppercase font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors">
            Hide Orphans
          </span>
          <div
            className={`w-6 h-3 rounded-full relative transition-colors ${
              showSyncedOnly ? "bg-emerald-500/50" : "bg-zinc-700"
            }`}
          >
            <div
              className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${
                showSyncedOnly ? "left-3.5" : "left-0.5"
              }`}
            />
          </div>
          <input
            type="checkbox"
            className="hidden"
            checked={showSyncedOnly}
            onChange={(e) => setShowSyncedOnly(e.target.checked)}
          />
        </label>
      </div>

      {/* LIST CONTENT */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {displayFiles.map((filename, index) => {
          const isSelected = selectedFiles.has(filename);
          const isSynced = sourceFileNames.has(filename);

          // --- UPDATED LOGIC: Shield ONLY if in Manifest AND in Source ---
          const isVerified = manifestMap.has(filename) && isSynced;
          // -------------------------------------------------------------

          return (
            <div
              key={filename}
              // Only auto-scroll to this if it's the single selection to avoid jumping
              ref={isSelected && selectedFiles.size === 1 ? activeRef : null}
              onClick={(e) => {
                // CHANGE: Stop propagation so row click doesn't trigger background deselect
                e.stopPropagation();
                // --- NEW: MODIFIER LOGIC FOR DEST ---
                const modifier = e.shiftKey
                  ? "shift"
                  : e.ctrlKey || e.metaKey
                  ? "ctrl"
                  : "none";

                selectFile(
                  {
                    name: filename,
                    isDirectory: false,
                    isFile: true,
                    isSymlink: false,
                  },
                  "dest",
                  modifier,
                  index,
                  displayFiles // <--- PASSING SORTED LIST FOR RANGE LOGIC
                );
              }}
              // --- NEW: CONTEXT MENU HANDLER ---
              onContextMenu={(e) => {
                if (destPath) {
                  const separator = destPath.endsWith("\\") ? "" : "\\";
                  const fullPath = `${destPath}${separator}${filename}`;
                  onContextMenu(e, fullPath);
                }
              }}
              // ---------------------------------
              className={`
                  flex items-center gap-3 p-2 rounded cursor-pointer transition-all duration-200 border
                  ${
                    isSelected
                      ? "bg-zinc-800 border-zinc-700 shadow-md ring-1 ring-zinc-700"
                      : "border-transparent hover:bg-zinc-800/30 opacity-50 hover:opacity-100"
                  }
                `}
            >
              {/* SMART ICON LOGIC (Shield vs Dot) */}
              {isVerified ? (
                // --- VERIFIED STATE (SHIELD WITH TOOLTIP) ---
                <div className="relative group/shield">
                  <ShieldCheckIcon className="w-4 h-4 text-emerald-500 shrink-0" />

                  {/* --- THE TOOLTIP (Sprint 7 FIX) --- */}
                  {/* FIX: Left-Aligned (left-0) to prevent clipping */}
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover/shield:block w-48 bg-zinc-950 text-[10px] text-center p-2 rounded border border-zinc-700 shadow-xl z-50 text-zinc-300 pointer-events-none">
                    <span className="font-bold text-emerald-400 block mb-0.5">
                      Verified Safe
                    </span>
                    xxHash-64 bit-for-bit match confirmed.
                    {/* Arrow */}
                    <div className="absolute left-2 top-full border-4 border-transparent border-t-zinc-700" />
                  </div>
                </div>
              ) : (
                // --- UNVERIFIED STATE (DOT) ---
                <div
                  className={`w-2 h-2 rounded-full shadow-sm ml-1 shrink-0
                     ${
                       !sourcePath
                         ? "bg-zinc-600 shadow-zinc-900/50" // No Source = Neutral
                         : isSynced
                         ? "bg-emerald-500 shadow-emerald-500/50" // Synced = Green
                         : "bg-red-500 shadow-red-900/50" // Orphan = Red
                     }
                   `}
                  title={
                    !sourcePath
                      ? "No Source"
                      : isSynced
                      ? "Synced (Not Verified)"
                      : "Orphan (Dest Only)"
                  }
                />
              )}

              <div className="flex flex-col min-w-0">
                <p
                  className={`text-xs truncate font-medium ${
                    isSelected ? "text-white" : "text-zinc-400"
                  }`}
                >
                  {filename}
                </p>

                {/* Optional: Show tiny "Verified" text if selected and verified */}
                {isSelected && isVerified && (
                  <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider leading-none mt-0.5">
                    Verified
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
