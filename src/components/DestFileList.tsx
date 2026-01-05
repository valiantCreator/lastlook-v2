import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/appStore";

interface DestFileListProps {
  files: Set<string>;
}

export function DestFileList({ files }: DestFileListProps) {
  const { selectedFile, setSelectedFile, sourcePath, fileList } = useAppStore();
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
  }, [selectedFile]);

  if (files.size === 0) {
    return (
      <div className="flex-1 flex items-center justify-center opacity-30">
        <p className="text-xs">Destination is empty</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* FILTER TOOLBAR (Sticky Top) */}
      <div className="px-2 py-1.5 border-b border-zinc-800/50 bg-zinc-900/50 flex justify-end shrink-0">
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
        {displayFiles.map((filename) => {
          const isSelected = selectedFile?.name === filename;
          const isSynced = sourceFileNames.has(filename);

          return (
            <div
              key={filename}
              ref={isSelected ? activeRef : null}
              onClick={() => {
                setSelectedFile({
                  name: filename,
                  isDirectory: false,
                  isFile: true,
                  isSymlink: false,
                });
              }}
              className={`
                  flex items-center gap-3 p-2 rounded cursor-pointer transition-all duration-200 border
                  ${
                    isSelected
                      ? "bg-zinc-800 border-zinc-700 shadow-md ring-1 ring-zinc-700"
                      : "border-transparent hover:bg-zinc-800/30 opacity-50 hover:opacity-100"
                  }
                `}
            >
              {/* SMART DOT LOGIC */}
              <div
                className={`w-2 h-2 rounded-full shadow-sm
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
                    ? "Synced"
                    : "Orphan (Dest Only)"
                }
              />

              <p
                className={`text-xs truncate font-medium ${
                  isSelected ? "text-white" : "text-zinc-400"
                }`}
              >
                {filename}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
