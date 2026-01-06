import { useEffect, useState } from "react";
import { useAppStore } from "../store/appStore";
import { formatSize, formatDate } from "../utils/formatters";
import { invoke } from "@tauri-apps/api/core";
import { useMedia } from "../hooks/useMedia";

interface FileMetadata {
  size: number;
  created?: number;
  modified?: number;
}

export function Inspector() {
  const {
    selectedFile,
    selectedFileOrigin,
    sourcePath,
    destPath,
    checkedFiles,
    setSelectedFile,
  } = useAppStore();

  const [metadata, setMetadata] = useState<FileMetadata | null>(null);

  // Batch State
  const [batchSize, setBatchSize] = useState<number>(0);
  const [isBatchLoading, setIsBatchLoading] = useState(false);

  // 1. Construct Full Path for Preview
  const rootPath = selectedFileOrigin === "dest" ? destPath : sourcePath;
  const fullPath =
    selectedFile && rootPath ? `${rootPath}\\${selectedFile.name}` : null;

  // 2. Use the Media Hook
  const { thumbnailUrl, isLoading } = useMedia(fullPath);

  // 3. Fetch Metadata (Single File)
  useEffect(() => {
    if (!selectedFile || !rootPath) {
      setMetadata(null);
      return;
    }

    invoke("plugin:fs|stat", { path: fullPath })
      .then((stat: any) => {
        setMetadata({
          size: stat.size,
          created: stat.birthtime,
          modified: stat.mtime,
        });
      })
      .catch((err) => {
        console.error("Failed to stat file:", err);
        setMetadata(null);
      });
  }, [selectedFile, rootPath, fullPath]);

  // 4. Batch Calculation (Always run if checkedFiles exist)
  useEffect(() => {
    if (checkedFiles.size > 0 && sourcePath) {
      setIsBatchLoading(true);

      const promises = Array.from(checkedFiles).map((filename) =>
        invoke("plugin:fs|stat", { path: `${sourcePath}\\${filename}` })
          .then((stat: any) => stat.size as number)
          .catch(() => 0)
      );

      Promise.all(promises)
        .then((sizes) => {
          const total = sizes.reduce((acc, curr) => acc + curr, 0);
          setBatchSize(total);
        })
        .finally(() => setIsBatchLoading(false));
    } else {
      setBatchSize(0);
    }
  }, [checkedFiles, sourcePath]); // Removed selectedFile dependency so it persists

  // --- SUB-COMPONENTS ---

  const BatchHeader = () => (
    <div
      onClick={() => setSelectedFile(null)} // Click header to go back to full batch view
      className={`shrink-0 border-b border-zinc-800 transition-colors cursor-pointer group
            ${
              selectedFile
                ? "bg-zinc-900/80 hover:bg-zinc-800 py-3 px-4"
                : "h-64 bg-zinc-950 flex flex-col items-center justify-center gap-3"
            }
        `}
    >
      {selectedFile ? (
        // COMPACT HEADER (Shown when a file is also selected)
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
              Batch Active
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-300 font-mono">
              {checkedFiles.size} Files
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
            {selectedFile!.name}
          </h2>
          <p className="text-xs text-zinc-500 font-mono mt-1 uppercase tracking-wider">
            {selectedFile!.isDirectory
              ? "Directory"
              : selectedFile!.name.split(".").pop()}
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
                {selectedFile!.isFile ? "File" : "Folder"}
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex justify-between border-b border-zinc-800/50 pb-2">
              <span className="text-xs text-zinc-500">Created</span>
              <span className="text-xs font-mono text-zinc-400">
                {metadata?.created
                  ? formatDate(new Date(metadata.created))
                  : "---"}
              </span>
            </div>
            <div className="flex justify-between border-b border-zinc-800/50 pb-2">
              <span className="text-xs text-zinc-500">Modified</span>
              <span className="text-xs font-mono text-zinc-400">
                {metadata?.modified
                  ? formatDate(new Date(metadata.modified))
                  : "---"}
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

      {/* 2. If we have a selection, Show Preview (stacked under header) */}
      {selectedFile && <FilePreview />}

      {/* 3. Empty State (No Batch, No Selection) */}
      {!selectedFile && checkedFiles.size === 0 && (
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
