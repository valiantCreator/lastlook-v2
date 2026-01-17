import "./App.css";
import { useEffect, useRef, useState } from "react"; // <--- ADDED useState
import { useFileSystem } from "./hooks/useFileSystem";
import { useAppStore } from "./store/appStore";
import { FileList } from "./components/FileList";
import { DestFileList } from "./components/DestFileList";
import { Inspector } from "./components/Inspector";
import { useTransfer } from "./hooks/useTransfer";
import { ConflictModal } from "./components/ConflictModal";
import { DeleteModal } from "./components/DeleteModal"; // <--- NEW IMPORT
import { ContextMenu } from "./components/ContextMenu"; // <--- ADDED COMPONENT
import { JobDrawer } from "./components/JobDrawer";
import { listen } from "@tauri-apps/api/event"; // <--- RESTORED LISTENER
import { stat } from "@tauri-apps/plugin-fs";
import { dirname, basename } from "@tauri-apps/api/path"; // <--- SAFER PATH PARSING
import { invoke } from "@tauri-apps/api/core"; // <--- ADDED INVOKE

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
    swapPaths,
    transferStartTime,
    setSourcePath,
    setDestPath,
    setCheckedFiles, // <--- NEED THIS TO AUTO-SELECT FILE
  } = useAppStore();

  const {
    selectSource,
    selectDest,
    scanSource,
    scanDest,
    clearSource,
    unmountDest,
    clearTempCache,
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

  // --- REFS FOR DROP ZONES (Kept for layout consistency) ---
  const sourcePanelRef = useRef<HTMLDivElement>(null);
  const destPanelRef = useRef<HTMLDivElement>(null);

  // --- NEW: CONTEXT MENU STATE (Sprint 7) ---
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    path: string;
  } | null>(null);

  // Handler: Open Menu
  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault(); // Prevent browser menu
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      path,
    });
  };

  // Handler: Reveal File (Uses Native Rust Command)
  const handleReveal = async () => {
    if (contextMenu) {
      try {
        await invoke("show_in_folder", { path: contextMenu.path });
        setContextMenu(null);
      } catch (err) {
        console.error("Failed to reveal file:", err);
      }
    }
  };
  // ------------------------------------------

  // 3. AUTO-CLEAN CACHE ON STARTUP
  useEffect(() => {
    // This runs once when the app opens, wiping any leftovers from previous sessions
    clearTempCache();
  }, []);

  // 4. INTELLIGENT DRAG & DROP LISTENER (ROBUST ZONE MATH)
  // Reverted to Tauri Listener for reliability, but using Window Math to prevent "Ghosting"
  useEffect(() => {
    const unlisten = listen("tauri://drag-drop", async (event: any) => {
      const { paths, position } = event.payload;

      if (paths && paths.length > 0) {
        const droppedPath = paths[0]; // Handle first item
        const { x } = position; // We only really care about X for the column check

        try {
          const info = await stat(droppedPath);

          // --- ROBUST ZONE CALCULATION ---
          // Layout: Source (Flex) | Dest (Flex) | Inspector (Fixed 400px)
          // We calculate the boundary lines based on the current window width.

          // FIX: NORMALIZE COORDINATES FOR HIGH-DPI SCREENS
          // The OS sends physical pixels, but CSS uses logical pixels.
          // We must divide by the devicePixelRatio (e.g., 2.0 on Retina/4K).
          const scaleFactor = window.devicePixelRatio || 1;
          const logicalX = x / scaleFactor;

          const inspectorWidth = 400;
          const availableWidth = window.innerWidth - inspectorWidth;
          const midPoint = availableWidth / 2;

          const isOverSource = logicalX < midPoint;
          const isOverDest = logicalX >= midPoint && logicalX < availableWidth;

          // --- LOGIC: SOURCE DROP ---
          if (isOverSource) {
            if (info.isDirectory) {
              console.log("📂 Folder Dropped on Source:", droppedPath);
              setSourcePath(droppedPath);
            } else {
              // FILE DROPPED -> LOAD PARENT & SELECT FILE
              const parentPath = await dirname(droppedPath);
              const fileName = await basename(droppedPath);

              console.log("📄 File Dropped on Source. Parent:", parentPath);

              // 1. Set Path
              setSourcePath(parentPath);

              // 2. Auto-Select this file (overriding previous selections)
              setCheckedFiles(new Set([fileName]));
            }
          }

          // --- LOGIC: DESTINATION DROP ---
          else if (isOverDest) {
            if (info.isDirectory) {
              console.log("📂 Folder Dropped on Dest:", droppedPath);
              setDestPath(droppedPath);
            } else {
              // FILE DROPPED -> SET PARENT AS DEST
              const parentPath = await dirname(droppedPath);
              console.log("📄 File Dropped on Dest. Using Parent:", parentPath);
              setDestPath(parentPath);
            }
          }
        } catch (err) {
          console.error("Drop Error:", err);
        }
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

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
      {/* --- NEW: CONTEXT MENU (Sprint 7) --- */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onReveal={handleReveal}
        />
      )}

      {/* --- CONFLICT MODAL --- */}
      {conflicts.length > 0 && (
        <ConflictModal
          conflicts={conflicts}
          onOverwrite={resolveOverwrite}
          onSkip={resolveSkip}
          onCancel={() => setConflicts([])}
        />
      )}

      {/* --- NEW: DELETE MODAL (Red Zone) --- */}
      <DeleteModal />
      {/* ------------------------------------ */}

      {/* --- LEFT PANEL: SOURCE --- */}
      <div
        ref={sourcePanelRef}
        className="flex-1 flex flex-col border-r border-zinc-800 min-w-[350px] relative transition-colors hover:bg-zinc-900/10"
      >
        {/* --- HEADER SPRINT 11 REFACTOR: 2-ROW LAYOUT --- */}
        {/* REMOVED: border-b border-zinc-800 (Visual unification with Toolbar) */}
        <div className="flex flex-col bg-zinc-900/50 shrink-0">
          {/* ROW 1: Title */}
          <div className="h-10 flex items-center px-4 justify-between">
            <span className="font-bold text-sm tracking-wide text-zinc-100">
              SOURCE
            </span>
          </div>

          {/* ROW 2: Path + Swap (Only if connected) */}
          {sourcePath && (
            <div className="px-3 pb-2 flex items-center gap-2">
              <div
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[10px] font-mono text-zinc-400 truncate select-text cursor-default"
                title={sourcePath}
              >
                {sourcePath}
              </div>
              {/* SWAP BUTTON: High Visibility */}
              <button
                onClick={swapPaths}
                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 hover:text-white transition-all active:scale-95 shadow-sm"
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
            </div>
          )}
        </div>
        {/* ----------------------------------------------- */}

        <FileList
          sourcePath={sourcePath}
          files={fileList}
          destFiles={destFiles}
          onSelectSource={selectSource}
          onClearSource={() => {
            clearSource();
            resetSource();
          }}
          // --- NEW: PASS CONTEXT HANDLER ---
          onContextMenu={handleContextMenu}
        />
      </div>

      {/* --- CENTER PANEL: DESTINATION --- */}
      <div
        ref={destPanelRef}
        className="flex-1 flex flex-col min-w-[350px] bg-zinc-900/10 relative transition-colors hover:bg-zinc-900/20"
      >
        {/* --- HEADER SPRINT 11 REFACTOR: 2-ROW LAYOUT --- */}
        {/* REMOVED: border-b border-zinc-800 (Visual unification with Destination Toolbar) */}
        <div className="flex flex-col bg-zinc-900/50 shrink-0">
          {/* ROW 1: Title + Disconnect */}
          <div className="h-10 flex items-center justify-between px-4">
            <span className="font-bold text-sm tracking-wide text-zinc-100">
              DESTINATION
            </span>
            {destPath && (
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
                  Connected
                </span>
                {/* DISCONNECT: Ghost Button Style */}
                <button
                  onClick={unmountDest}
                  className="text-[10px] px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>

          {/* ROW 2: Path Display */}
          {destPath && (
            <div className="px-3 pb-2">
              <div
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[10px] font-mono text-emerald-500/80 truncate select-text cursor-default"
                title={destPath}
              >
                {destPath}
              </div>
            </div>
          )}
        </div>
        {/* ----------------------------------------------- */}

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
              {/* --- NEW: PASS CONTEXT HANDLER --- */}
              <DestFileList
                files={destFiles}
                onContextMenu={handleContextMenu}
              />
            </div>
          )}
        </div>

        {/* --- JOB DRAWER (Stacked in Flex Column) --- */}
        <JobDrawer
          key={transferStartTime || "idle"}
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
      <div className="w-[400px] border-l border-zinc-800 flex flex-col bg-zinc-900/30 shrink-0">
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
