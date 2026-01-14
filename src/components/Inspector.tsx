import { useEffect, useState } from "react";
import { useAppStore } from "../store/appStore";
import { formatSize, formatDate } from "../utils/formatters";
import { invoke } from "@tauri-apps/api/core";
import { stat } from "@tauri-apps/plugin-fs";
import { useMedia } from "../hooks/useMedia";

interface FileMetadata {
  size: number;
  created?: Date | null;
  modified?: Date | null;
}

// --- NEW INTERFACE FOR VIDEO INFO ---
interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  codec: string;
  fps: string;
}

// --- NEW INTERFACE FOR DIRECTORY STATS (Sprint 5) ---
interface DirStats {
  files: number;
  folders: number;
  total_size: number;
}

export function Inspector() {
  const {
    // --- CHANGED: CONSUME NEW MULTI-SELECT STATE (Sprint 8) ---
    selectedFiles,
    selectedFileOrigin,
    // ----------------------------------------------------------
    sourcePath,
    destPath,
    checkedFiles,
    clearSelection, // Replaces setSelectedFile(null)
    checkSelectedFiles, // The "Bridge" Action
  } = useAppStore();

  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null);
  const [dirStats, setDirStats] = useState<DirStats | null>(null);
  const [isDirCalculating, setIsDirCalculating] = useState(false);

  // Batch State
  const [batchSize, setBatchSize] = useState<number>(0);
  const [isBatchLoading, setIsBatchLoading] = useState(false);

  // --- NEW: SELECTION BATCH STATE ---
  const [selectionSize, setSelectionSize] = useState<number>(0);
  const [isSelectionLoading, setIsSelectionLoading] = useState(false);

  // DERIVED STATE: Determine what to show
  // If exactly 1 file selected, show details. If >1, show batch info.
  const activeFile =
    selectedFiles.size === 1 ? selectedFiles.values().next().value : null;
  const isMultiSelect = selectedFiles.size > 1;

  // 1. Robust Path Construction
  const rootPath = selectedFileOrigin === "dest" ? destPath : sourcePath;

  // Logic: Ensure we don't double-slash or miss a slash
  const separator =
    rootPath?.endsWith("\\") || rootPath?.endsWith("/") ? "" : "\\";
  const fullPath =
    activeFile && rootPath ? `${rootPath}${separator}${activeFile.name}` : null;

  // 2. Use the Media Hook
  const { thumbnailUrl, isLoading } = useMedia(fullPath);

  // 3. Fetch Metadata (Stabilized)
  useEffect(() => {
    let active = true; // <--- TRAFFIC CONTROL

    // A. Immediate Reset (Prevents stale data showing)
    setMetadata(null);

    if (!activeFile || !rootPath || !fullPath) return;

    console.log("🔍 Inspecting:", fullPath); // Debug Log

    // B. Fetch Data
    stat(fullPath)
      .then((info) => {
        if (active) {
          console.log("✅ Stat Success:", info);
          setMetadata({
            size: info.size,
            created: info.birthtime,
            modified: info.mtime,
          });
        }
      })
      .catch((err) => {
        if (active) {
          console.warn("❌ Stat Failed:", err);
          setMetadata(null);
        }
      });

    // C. Cleanup (Cancels the update if user clicks another file)
    return () => {
      active = false;
    };
  }, [activeFile, rootPath, fullPath]);

  // 4. Fetch Video Metadata
  useEffect(() => {
    let active = true;
    setVideoMeta(null);

    if (!activeFile || !rootPath || !fullPath) return;

    // Simple extension check to avoid running ffprobe on non-video files
    const isVideo = /\.(mp4|mov|mkv|avi|webm)$/i.test(activeFile.name);

    if (isVideo) {
      invoke<VideoMetadata>("get_video_metadata", { path: fullPath })
        .then((data) => {
          if (active) setVideoMeta(data);
        })
        .catch((e) => {
          console.warn("Video Meta skipped:", e);
        });
    }

    return () => {
      active = false;
    };
  }, [activeFile, rootPath, fullPath]);

  // --- NEW: FETCH RECURSIVE DIRECTORY STATS (Sprint 5) ---
  useEffect(() => {
    let active = true;
    setDirStats(null);
    setIsDirCalculating(false);

    if (!activeFile || !fullPath) return;

    // Only run this if the selected item is actually a directory
    if (activeFile.isDirectory) {
      setIsDirCalculating(true);

      invoke<DirStats>("get_dir_stats", { path: fullPath })
        .then((stats) => {
          if (active) {
            setDirStats(stats);
            setIsDirCalculating(false);
          }
        })
        .catch((err) => {
          console.error("Dir Stats Failed:", err);
          if (active) setIsDirCalculating(false);
        });
    }

    return () => {
      active = false;
    };
  }, [activeFile, fullPath]);

  // 5. Checkbox Batch Calculation
  useEffect(() => {
    let active = true;
    if (checkedFiles.size > 0 && sourcePath) {
      setIsBatchLoading(true);

      const sep = sourcePath.endsWith("\\") ? "" : "\\";
      const promises = Array.from(checkedFiles).map((filename) =>
        stat(`${sourcePath}${sep}${filename}`)
          .then((info) => info.size)
          .catch(() => 0)
      );

      Promise.all(promises)
        .then((sizes) => {
          if (active) {
            const total = sizes.reduce((acc, curr) => acc + curr, 0);
            setBatchSize(total);
          }
        })
        .finally(() => {
          if (active) setIsBatchLoading(false);
        });
    } else {
      setBatchSize(0);
    }
    return () => {
      active = false;
    };
  }, [checkedFiles, sourcePath]);

  // --- NEW: SELECTION BATCH CALCULATION (Sprint 8) ---
  useEffect(() => {
    let active = true;
    if (isMultiSelect && rootPath) {
      setIsSelectionLoading(true);

      const sep = rootPath.endsWith("\\") ? "" : "\\";
      const promises = Array.from(selectedFiles.keys()).map((filename) =>
        stat(`${rootPath}${sep}${filename}`)
          .then((info) => info.size)
          .catch(() => 0)
      );

      Promise.all(promises)
        .then((sizes) => {
          if (active) {
            const total = sizes.reduce((acc, curr) => acc + curr, 0);
            setSelectionSize(total);
          }
        })
        .finally(() => {
          if (active) setIsSelectionLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [selectedFiles, rootPath, isMultiSelect]);

  // --- SUB-COMPONENTS ---
  const BatchHeader = () => (
    <div
      onClick={() => clearSelection()}
      className={`shrink-0 border-b border-zinc-800 transition-colors cursor-pointer group
            ${
              // Changed condition: Highlight if we have active selection OR active checks
              selectedFiles.size > 0
                ? "bg-zinc-900/80 hover:bg-zinc-800 py-3 px-4"
                : "h-64 bg-zinc-950 flex flex-col items-center justify-center gap-3"
            }
        `}
    >
      {selectedFiles.size > 0 ? (
        // COMPACT HEADER (Shown when a file is also selected)
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
              {isMultiSelect ? "Multi-Select" : "Details"}
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-300 font-mono">
              {checkedFiles.size} Checked
              <span className="text-zinc-600 mx-1">|</span>
              {isBatchLoading ? "..." : formatSize(batchSize)}
            </p>
          </div>
        </div>
      ) : (
        // FULL HERO (Shown when ONLY batch is active)
        <>
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-zinc-100">Batch Ready</h2>
            <p className="text-sm text-blue-400 font-mono mt-1">
              {checkedFiles.size} files selected
            </p>
            <p className="text-xs text-zinc-500 font-mono mt-1">
              Total: {isBatchLoading ? "Calculating..." : formatSize(batchSize)}
            </p>
          </div>
        </>
      )}
    </div>
  );

  // --- NEW: MULTI-SELECT PREVIEW (Sprint 8) ---
  const MultiSelectPreview = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
        <span className="text-2xl font-bold text-blue-400">
          {selectedFiles.size}
        </span>
      </div>
      <div>
        <h3 className="text-lg font-bold text-zinc-100">Items Highlighted</h3>
        <p className="text-sm text-zinc-500 font-mono mt-1">
          Total: {isSelectionLoading ? "..." : formatSize(selectionSize)}
        </p>
      </div>

      {/* BRIDGE BUTTON (Only show if Source) */}
      {selectedFileOrigin === "source" && (
        <button
          onClick={checkSelectedFiles}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded shadow-lg active:scale-95 transition-all text-xs font-bold uppercase tracking-wide"
        >
          Check These Files
        </button>
      )}
    </div>
  );

  const FilePreview = () => (
    <>
      {/* --- PREVIEW AREA --- */}
      <div className="h-64 bg-zinc-950 flex items-center justify-center border-b border-zinc-800 relative group overflow-hidden shrink-0">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
            <span className="text-xs text-zinc-500">Generating Preview...</span>
          </div>
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt="Preview"
            className="w-full h-full object-contain"
          />
        ) : // FOLDER ICON or FILE ICON
        activeFile?.isDirectory ? (
          <svg
            className="w-20 h-20 text-blue-500/50"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
        ) : (
          <svg
            className="w-20 h-20 text-zinc-800"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm3 4h6v2H9v-2zm0 4h4v2H9v-2z" />
          </svg>
        )}

        {/* Origin Badge */}
        <div
          className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold border backdrop-blur-md shadow-sm ${
            selectedFileOrigin === "dest"
              ? "bg-zinc-900/80 text-zinc-400 border-zinc-700"
              : "bg-emerald-900/80 text-emerald-400 border-emerald-500/30"
          }`}
        >
          {selectedFileOrigin === "dest" ? "DESTINATION" : "SOURCE"}
        </div>
      </div>

      {/* --- METADATA LIST --- */}
      <div className="p-6 space-y-6 overflow-y-auto bg-zinc-900/30 flex-1">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 break-all leading-tight">
            {activeFile!.name}
          </h2>
          <p className="text-xs text-zinc-500 font-mono mt-1 uppercase tracking-wider">
            {activeFile!.isDirectory
              ? "Directory"
              : activeFile!.name.split(".").pop()}
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* --- CONDITIONAL: SHOW DIR STATS IF FOLDER --- */}
            {activeFile?.isDirectory ? (
              <>
                <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800/50">
                  <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
                    Total Size
                  </span>
                  <span
                    className={`text-sm font-mono ${
                      isDirCalculating
                        ? "text-yellow-500 animate-pulse"
                        : "text-zinc-300"
                    }`}
                  >
                    {isDirCalculating
                      ? "Calculating..."
                      : dirStats
                      ? formatSize(dirStats.total_size)
                      : "---"}
                  </span>
                </div>
                <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800/50">
                  <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
                    Contents
                  </span>
                  <span
                    className={`text-sm font-mono ${
                      isDirCalculating
                        ? "text-yellow-500 animate-pulse"
                        : "text-zinc-300"
                    }`}
                  >
                    {isDirCalculating
                      ? "Scanning..."
                      : dirStats
                      ? `${dirStats.files} Files, ${dirStats.folders} Folders`
                      : "Empty"}
                  </span>
                </div>
              </>
            ) : (
              /* --- STANDARD FILE STATS --- */
              <>
                <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800/50">
                  <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
                    File Size
                  </span>
                  <span className="text-sm font-mono text-zinc-300">
                    {metadata ? formatSize(metadata.size) : "---"}
                  </span>
                </div>
                <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800/50">
                  <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
                    Type
                  </span>
                  <span className="text-sm font-mono text-zinc-300">
                    {activeFile!.isFile ? "File" : "Folder"}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* --- MEDIA METADATA BLOCK --- */}
          {videoMeta && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800/50">
              <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800/50">
                <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
                  Resolution
                </span>
                <span className="text-sm font-mono text-zinc-300">
                  {videoMeta.width} x {videoMeta.height}
                </span>
              </div>
              <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800/50 min-w-0">
                <span className="text-[10px] uppercase text-zinc-500 font-bold block mb-1">
                  Format
                </span>
                {/* FIX: Added 'truncate' and 'block' to handle overflow cleanly */}
                <span
                  className="text-sm font-mono text-zinc-300 whitespace-nowrap truncate block"
                  title={`${videoMeta.fps} fps | ${videoMeta.codec}`}
                >
                  {videoMeta.fps} fps <span className="text-zinc-600">|</span>{" "}
                  {videoMeta.codec}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <div className="flex justify-between border-b border-zinc-800/50 pb-2">
              <span className="text-xs text-zinc-500">Created</span>
              <span className="text-xs font-mono text-zinc-400">
                {metadata?.created ? formatDate(metadata.created) : "---"}
              </span>
            </div>
            <div className="flex justify-between border-b border-zinc-800/50 pb-2">
              <span className="text-xs text-zinc-500">Modified</span>
              <span className="text-xs font-mono text-zinc-400">
                {metadata?.modified ? formatDate(metadata.modified) : "---"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // --- MAIN RENDER ---
  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-zinc-900/30 border-l border-zinc-800">
      {/* 1. If we have a batch, ALWAYS show the header (Compact or Full) */}
      {checkedFiles.size > 0 && <BatchHeader />}

      {/* 2. Show Preview (Single) OR Multi-Select (Group) */}
      {activeFile ? (
        <FilePreview />
      ) : isMultiSelect ? (
        <MultiSelectPreview />
      ) : null}

      {/* 3. Empty State */}
      {!activeFile && !isMultiSelect && checkedFiles.size === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 p-8 text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center">
            <svg
              className="w-8 h-8 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-sm">Select a file to inspect details</p>
        </div>
      )}
    </div>
  );
}
