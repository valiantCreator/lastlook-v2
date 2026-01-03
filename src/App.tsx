import "./App.css";
import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useFileSystem } from "./hooks/useFileSystem";
import { useAppStore } from "./store/appStore";
import { FileList } from "./components/FileList";
import { DestFileList } from "./components/DestFileList";
import { Inspector } from "./components/Inspector";
import { useTransfer } from "./hooks/useTransfer";

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
  } = useAppStore();

  const {
    selectSource,
    selectDest,
    scanSource,
    scanDest,
    clearSource,
    unmountDest,
  } = useFileSystem();
  const { startTransfer, isTransferring, currentFile, progress } =
    useTransfer();

  // 1. INITIAL SETUP
  useEffect(() => {
    invoke("verify_connection", { name: "LastLook UI" }).catch(console.error);
  }, []);

  // 2. AUTO-SCAN TRIGGERS
  useEffect(() => {
    if (sourcePath) scanSource();
  }, [sourcePath]);

  // Update "Green Dots" whenever Destination changes
  useEffect(() => {
    if (destPath) scanDest(destPath);
  }, [destPath]);

  // DERIVED STATE FOR FOOTER UI
  const isVerifying = verifyingFiles.size > 0;

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-300 flex overflow-hidden font-sans select-none">
      {/* --- LEFT PANEL: SOURCE --- */}
      <div className="flex-1 flex flex-col border-r border-zinc-800 min-w-[350px] relative">
        <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50 shrink-0">
          <span className="font-bold text-sm tracking-wide text-zinc-100">
            SOURCE
          </span>
          {sourcePath && (
            <span
              className="text-[10px] font-mono text-zinc-500 truncate max-w-[200px]"
              title={sourcePath}
            >
              {sourcePath}
            </span>
          )}
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

        {/* Footer Actions */}
        <div className="h-20 border-t border-zinc-800 flex flex-col items-center justify-center bg-zinc-900/20 px-4 shrink-0">
          {isTransferring ? (
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-[10px] font-mono uppercase">
                <span
                  className={`truncate max-w-[150px] ${
                    isVerifying ? "text-yellow-400 font-bold" : "text-zinc-400"
                  }`}
                >
                  {currentFile}
                </span>
                <span
                  className={isVerifying ? "text-yellow-400" : "text-zinc-400"}
                >
                  {progress}%
                </span>
              </div>

              {/* PROGRESS BAR TRACK */}
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden relative">
                {/* PROGRESS BAR FILL */}
                <div
                  className={`
                       h-full transition-all duration-300 ease-out
                       ${
                         isVerifying
                           ? "bg-yellow-500 progress-stripe" // <--- AMBER MODE
                           : "bg-emerald-500" // <--- NORMAL MODE
                       }
                     `}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={startTransfer}
              disabled={!sourcePath || !destPath || checkedFiles.size === 0}
              className={`w-full max-w-sm py-3 rounded-md font-bold text-xs uppercase tracking-wider transition-all shadow-lg
                 ${
                   !sourcePath || !destPath || checkedFiles.size === 0
                     ? "bg-zinc-800 text-zinc-600 cursor-not-allowed shadow-none border border-zinc-700"
                     : "bg-red-600 hover:bg-red-500 text-white shadow-red-900/20 cursor-pointer active:scale-95 border border-red-500"
                 }
               `}
            >
              {checkedFiles.size > 0
                ? `Transfer ${checkedFiles.size} File${
                    checkedFiles.size === 1 ? "" : "s"
                  }`
                : "Select Files to Transfer"}
            </button>
          )}
        </div>
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
