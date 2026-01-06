import "./App.css";
import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useFileSystem } from "./hooks/useFileSystem";
import { useAppStore } from "./store/appStore";
import { FileList } from "./components/FileList";
import { DestFileList } from "./components/DestFileList";
import { Inspector } from "./components/Inspector";
import { useTransfer } from "./hooks/useTransfer";
import { ConflictModal } from "./components/ConflictModal";
import { JobDrawer } from "./components/JobDrawer";

function App() {
  // 1. DATA (From Store)
  const {
    sourcePath,
    destPath,
    fileList,
    destFiles,
    resetSource,
    checkedFiles,
    verifyingFiles,
    conflicts,
    setConflicts,
    swapPaths, // <--- NEW IMPORT
  } = useAppStore();

  const {
    selectSource,
    selectDest,
    scanSource,
    scanDest,
    clearSource,
    unmountDest,
  } = useFileSystem();

  // Destructure cancelTransfer & Resolution Handlers
  const {
    startTransfer,
    cancelTransfer,
    resolveOverwrite,
    resolveSkip,
    isTransferring,
    currentFile,
    currentFileBytes,
    progress,
  } = useTransfer();

  // 2. AUTO-SCAN TRIGGERS
  useEffect(() => {
    if (sourcePath) scanSource();
  }, [sourcePath]);

  // Update "Green Dots" whenever Destination changes
  useEffect(() => {
    if (destPath) scanDest(destPath);
  }, [destPath]);

  // DERIVED STATE
  const isVerifying = verifyingFiles.size > 0;

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-300 flex overflow-hidden font-sans select-none relative">
      {/* --- CONFLICT MODAL --- */}
      {conflicts.length > 0 && (
        <ConflictModal
          conflicts={conflicts}
          onOverwrite={resolveOverwrite}
          onSkip={resolveSkip}
          onCancel={() => setConflicts([])}
        />
      )}

      {/* --- LEFT PANEL: SOURCE --- */}
      <div className="flex-1 flex flex-col border-r border-zinc-800 min-w-[350px] relative">
        <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50 shrink-0">
          <span className="font-bold text-sm tracking-wide text-zinc-100">
            SOURCE
          </span>
          <div className="flex items-center gap-2">
            {sourcePath && (
              <>
                <span
                  className="text-[10px] font-mono text-zinc-500 truncate max-w-[150px]"
                  title={sourcePath}
                >
                  {sourcePath}
                </span>
                {/* SWAP BUTTON */}
                <button
                  onClick={swapPaths}
                  className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
                  title="Swap Source & Destination"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        <FileList
          sourcePath={sourcePath}
          files={fileList}
          destFiles={destFiles}
          onSelectSource={selectSource}
          onClearSource={() => {
            clearSource();
            resetSource();
          }}
        />
      </div>

      {/* --- CENTER PANEL: DESTINATION --- */}
      <div className="flex-1 flex flex-col min-w-[350px] bg-zinc-900/10 relative">
        {/* Header with UNMOUNT BUTTON */}
        <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50 shrink-0">
          <span className="font-bold text-sm tracking-wide text-zinc-100">
            DESTINATION
          </span>
          {destPath && (
            <div className="flex items-center gap-3">
              <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">
                CONNECTED
              </span>
              <button
                onClick={unmountDest}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
              >
                Unmount
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {/* FIX: Removed 'mb-20'. Flexbox now manages the height automatically. */}
        <div className="flex-1 p-4 flex flex-col min-h-0">
          {!destPath ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors bg-zinc-900/20">
              <button
                onClick={selectDest}
                className="px-6 py-3 bg-zinc-800 text-zinc-200 rounded-lg hover:bg-zinc-700 font-medium transition-all shadow-xl active:scale-95 border border-zinc-700"
              >
                Select Destination Drive
              </button>
            </div>
          ) : (
            <div className="flex-1 border border-zinc-800 rounded-xl bg-zinc-900/30 relative flex flex-col overflow-hidden">
              {/* Small Info Header */}
              <div className="h-8 border-b border-zinc-800/50 bg-zinc-900/50 flex items-center px-3 shrink-0">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mr-2">
                  Target:
                </span>
                <span
                  className="text-[10px] font-mono text-emerald-400 truncate"
                  title={destPath}
                >
                  {destPath}
                </span>
              </div>

              {/* THE NEW SYNCED LIST */}
              <DestFileList files={destFiles} />
            </div>
          )}
        </div>

        {/* --- JOB DRAWER (Stacked in Flex Column) --- */}
        <JobDrawer
          isTransferring={isTransferring}
          currentFile={currentFile}
          currentFileBytes={currentFileBytes}
          progress={progress}
          isVerifying={isVerifying}
          onStart={startTransfer}
          onCancel={cancelTransfer}
          canStart={!!(sourcePath && destPath && checkedFiles.size > 0)}
        />
      </div>

      {/* --- RIGHT PANEL: INSPECTOR --- */}
      <div className="w-[300px] border-l border-zinc-800 flex flex-col bg-zinc-900/30 shrink-0">
        <div className="h-12 border-b border-zinc-800 flex items-center px-4 bg-zinc-900/50 shrink-0">
          <span className="font-bold text-sm tracking-wide text-zinc-100">
            INSPECTOR
          </span>
        </div>
        <Inspector />
      </div>
    </div>
  );
}

export default App;
