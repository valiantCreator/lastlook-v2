import { forwardRef, MouseEvent } from "react";
import { DirEntry } from "@tauri-apps/plugin-fs";

interface FileRowProps {
  file: DirEntry;
  isSynced: boolean;
  isVerified: boolean;
  isVerifying: boolean;

  // --- NEW PROP ---
  isManifestVerified: boolean;

  hasDest: boolean;
  isSelected: boolean;
  isChecked: boolean;

  onSelect: (e: MouseEvent) => void;
  onCheck: () => void;

  // --- NEW: CONTEXT MENU HANDLER ---
  onContextMenu?: (e: MouseEvent) => void;
}

export const FileRow = forwardRef<HTMLDivElement, FileRowProps>(
  (
    {
      file,
      isSynced,
      isVerified,
      isVerifying,
      isManifestVerified,
      hasDest,
      isSelected,
      isChecked,
      onSelect,
      onCheck,
      onContextMenu, // <--- Destructure
    },
    ref
  ) => {
    // DYNAMIC ROW STYLING
    let rowStyle = "border-transparent hover:bg-zinc-800/50";

    if (isSelected) {
      rowStyle = "bg-zinc-800 border-zinc-700 shadow-md";
    } else if (isVerifying) {
      // THE GOLDEN ROW
      rowStyle =
        "bg-yellow-500/10 border-yellow-500/20 shadow-[inset_0_0_10px_rgba(234,179,8,0.05)]";
    }

    // Consolidated Verified State
    const showVerifiedState = isVerified || isManifestVerified;

    return (
      <div
        ref={ref}
        onClick={(e) => onSelect(e)}
        onContextMenu={(e) => {
          if (onContextMenu) {
            e.preventDefault();
            onContextMenu(e);
          }
        }}
        className={`
        flex items-center gap-3 p-2 rounded cursor-pointer group transition-all duration-300 border select-none w-full
        ${rowStyle}
      `}
      >
        {/* CHECKBOX */}
        {!file.isDirectory ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onCheck();
            }}
            className={`
            w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0
            ${
              isChecked
                ? "bg-emerald-500 border-emerald-500 text-black"
                : "border-zinc-600 bg-zinc-900/50 hover:border-zinc-500"
            }
          `}
          >
            {isChecked && (
              <svg
                className="w-3 h-3 font-bold"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
        ) : (
          <div className="w-4 h-4 shrink-0" />
        )}

        {/* STATUS ICON (DOT OR SHIELD) */}
        {showVerifiedState ? (
          // --- VERIFIED STATE WITH TOOLTIP ---
          <div className="relative group/shield">
            <svg
              className="w-3 h-3 text-emerald-500 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                clipRule="evenodd"
              />
            </svg>

            {/* --- THE TOOLTIP (Sprint 7) --- */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/shield:block w-48 bg-zinc-950 text-[10px] text-center p-2 rounded border border-zinc-700 shadow-xl z-50 text-zinc-300 pointer-events-none">
              <span className="font-bold text-emerald-400 block mb-0.5">
                Verified Safe
              </span>
              xxHash-64 bit-for-bit match confirmed.
              {/* Arrow */}
              <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-zinc-700" />
            </div>
          </div>
        ) : (
          // --- STANDARD TRAFFIC LIGHT DOT ---
          <div
            className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-all duration-300 shrink-0
              ${
                isVerifying
                  ? "bg-yellow-400 shadow-yellow-500/50 animate-pulse"
                  : file.isDirectory
                  ? "bg-blue-500 shadow-blue-900/50"
                  : isSynced
                  ? "bg-emerald-500 shadow-emerald-500/50"
                  : hasDest
                  ? "bg-red-500/50 shadow-red-900/20"
                  : "bg-zinc-600 shadow-zinc-900/50"
              }
              ${isSelected ? "scale-125" : ""} 
            `}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Filename */}
            <p
              className={`text-xs truncate font-medium transition-colors 
              ${
                isSelected
                  ? "text-white"
                  : isVerifying
                  ? "text-yellow-100"
                  : isSynced
                  ? "text-emerald-100"
                  : "text-zinc-300"
              }
            `}
            >
              {file.name}
            </p>
          </div>

          {/* Status Text */}
          <p
            className={`text-[10px] truncate transition-colors 
           ${
             isVerifying
               ? "text-yellow-400/80"
               : isSynced
               ? "text-emerald-500/70"
               : "text-zinc-600"
           }
        `}
          >
            {file.isDirectory
              ? "Folder"
              : isVerifying
              ? "Verifying Integrity..."
              : showVerifiedState
              ? "Verified Safe"
              : isSynced
              ? "Synced (Unverified)"
              : hasDest
              ? "Missing from Dest"
              : "Waiting for Destination..."}
          </p>
        </div>
      </div>
    );
  }
);
