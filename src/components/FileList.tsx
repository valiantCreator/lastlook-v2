import { forwardRef } from "react";
import { DirEntry } from "@tauri-apps/plugin-fs";

export interface FileRowProps {
  file: DirEntry;
  isSynced: boolean;
  isVerified: boolean;
  isVerifying: boolean;
  hasDest: boolean;
  isSelected: boolean;
  isChecked: boolean;
  // UPDATE: Now accepts the MouseEvent
  onSelect: (e: React.MouseEvent) => void;
  onCheck: () => void;
}

export const FileRow = forwardRef<HTMLDivElement, FileRowProps>(
  (
    {
      file,
      isSynced,
      isVerified,
      isVerifying,
      hasDest,
      isSelected,
      isChecked,
      onSelect,
      onCheck,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        // UPDATE: Pass the event 'e' to onSelect
        onClick={(e) => onSelect(e)}
        className={`
          group flex items-center gap-3 p-2 rounded cursor-pointer transition-all duration-200 border
          ${
            isSelected
              ? "bg-zinc-800 border-zinc-700 shadow-md ring-1 ring-zinc-700 z-10 relative"
              : "border-transparent hover:bg-zinc-800/30 opacity-60 hover:opacity-100"
          }
        `}
      >
        {/* CHECKBOX AREA */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onCheck();
          }}
          className="p-1 -m-1 hover:bg-zinc-700 rounded transition-colors"
        >
          <div
            className={`
              w-3.5 h-3.5 rounded border flex items-center justify-center transition-all
              ${
                isChecked
                  ? "bg-blue-500 border-blue-500 shadow-sm shadow-blue-500/20"
                  : "bg-zinc-900/50 border-zinc-700 group-hover:border-zinc-500"
              }
            `}
          >
            {isChecked && (
              <svg
                className="w-2.5 h-2.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
        </div>

        {/* STATUS DOT */}
        <div
          className={`w-2 h-2 rounded-full shadow-sm shrink-0 transition-colors duration-300
            ${
              !hasDest
                ? "bg-zinc-600 shadow-zinc-900/50" // Neutral
                : isVerified
                ? "bg-emerald-500 shadow-emerald-500/50" // Verified (Shield)
                : isVerifying
                ? "bg-yellow-500 shadow-yellow-500/50 animate-pulse" // Verifying
                : isSynced
                ? "bg-emerald-500/50 shadow-emerald-900/20" // Exists but not verified
                : "bg-red-500 shadow-red-900/50" // Missing
            }
          `}
        />

        {/* FILE NAME */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span
            className={`text-xs truncate font-medium transition-colors ${
              isSelected
                ? "text-white"
                : "text-zinc-400 group-hover:text-zinc-300"
            }`}
          >
            {file.name}
          </span>
          {/* Verified Shield Icon */}
          {isVerified && (
            <svg
              className="w-3 h-3 text-emerald-500 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {/* FILE EXTENSION / TYPE */}
        <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-wider shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {file.isDirectory ? "DIR" : file.name.split(".").pop()?.slice(0, 4)}
        </span>
      </div>
    );
  }
);
