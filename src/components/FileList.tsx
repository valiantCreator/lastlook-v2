import { useEffect, useRef } from "react";
import { DirEntry } from "@tauri-apps/plugin-fs";
import { useAppStore } from "../store/appStore";
import { FileRow } from "./FileRow";

interface FileListProps {
  sourcePath: string | null;
  files: DirEntry[];
  destFiles: Set<string>;
  onSelectSource: () => void;
  onClearSource: () => void;
  // --- NEW ---
  onContextMenu: (e: React.MouseEvent, path: string) => void;
}

export function FileList({
  sourcePath,
  files,
  destFiles,
  onSelectSource,
  onClearSource,
  onContextMenu, // <--- Destructure
}: FileListProps) {
  const {
    // --- CHANGED: USE NEW MULTI-SELECT STATE ---
    selectedFiles,
    selectedFileOrigin, // <--- Added: Needed to check origin for button
    selectFile,
    clearSelection,
    checkSelectedFiles, // <--- Added: The Bridge Action
    // -------------------------------------------
    verifiedFiles,
    verifyingFiles,
    checkedFiles,
    toggleChecked,
    checkAllMissing,
    destPath,
    manifestMap, // <--- NEW: Access the Manifest Brain
    openDeleteModal, // <--- NEW: Open the Red Zone
  } = useAppStore();

  const activeRef = useRef<HTMLDivElement>(null);

  // --- DELETE LOGIC ---
  // Calculate how many selected files are actually safe to delete
  const verifiedSelection = Array.from(checkedFiles).filter((name) =>
    manifestMap.has(name),
  );
  const canDelete = verifiedSelection.length > 0;

  // --- NEW: LOGIC FOR "SELECT HIGHLIGHTED" BUTTON ---
  const canSelectHighlighted =
    selectedFileOrigin === "source" && selectedFiles.size > 1; // FIX: Only show if >1 selected
  // --------------------------------------------------

  const handleFreeSpace = () => {
    if (!canDelete) return;
    // Hand off to the safety modal
    openDeleteModal(verifiedSelection);
  };
  // --------------------

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedFiles]); // Trigger scroll when selection map changes

  if (!sourcePath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <button
          onClick={onSelectSource}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-md text-sm border border-zinc-700 transition-all cursor-pointer shadow-lg active:scale-95"
        >
          + Select Source
        </button>
        <p className="mt-2 text-xs text-zinc-600">Choose SD Card or Drive</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center opacity-50">
        <p className="text-xs text-zinc-500">Folder is empty</p>
        <button
          onClick={onClearSource}
          className="mt-2 text-[10px] text-zinc-600 hover:text-zinc-400 underline cursor-pointer"
        >
          Change Source
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col h-full min-h-0"
      onClick={() => clearSelection()} // Clear selection on background click
    >
      {/* --- SPRINT 11: ACTION TOOLBAR (Top) --- */}
      {/* VISUAL REFACTOR: bg-zinc-900 (Solid matches Header). One Border Bottom. */}
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900 flex items-center gap-2 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            checkAllMissing();
          }}
          disabled={!destPath}
          className={`text-[10px] px-3 py-1.5 rounded border transition-colors cursor-pointer whitespace-nowrap flex-1 text-center
                ${
                  !destPath
                    ? "bg-zinc-800/50 text-zinc-600 border-zinc-800 cursor-not-allowed"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
                }
              `}
        >
          Select All Missing
        </button>

        {/* SELECT HIGHLIGHTED: Only shows if multiple files highlighted */}
        {canSelectHighlighted && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              checkSelectedFiles();
            }}
            className="text-[10px] px-3 py-1.5 rounded border transition-colors flex-1 text-center font-bold bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-md active:scale-95 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
          >
            Select Highlighted ({selectedFiles.size})
          </button>
        )}
      </div>
      {/* --------------------------------------- */}

      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {files.map((file, index) => (
          <FileRow
            key={file.name}
            // Logic: If this file is the *last* one clicked (most recent in map?), scroll to it.
            // For now, simpler to scroll if it's the *only* one selected to avoid jumping.
            ref={
              selectedFiles.size === 1 && selectedFiles.has(file.name)
                ? activeRef
                : null
            }
            file={file}
            isSynced={destFiles.has(file.name)}
            isVerified={verifiedFiles.has(file.name)}
            isVerifying={verifyingFiles.has(file.name)}
            // --- NEW PROP: CHECK MANIFEST ---
            isManifestVerified={manifestMap.has(file.name)}
            // --------------------------------

            hasDest={!!destPath}
            // --- CHANGED: Check inclusion in Set ---
            isSelected={selectedFiles.has(file.name)}
            // ---------------------------------------
            isChecked={checkedFiles.has(file.name)}
            onSelect={(e: React.MouseEvent) => {
              e.stopPropagation();
              // --- NEW: MODIFIER LOGIC ---
              const modifier = e.shiftKey
                ? "shift"
                : e.ctrlKey || e.metaKey
                  ? "ctrl"
                  : "none";
              selectFile(file, "source", modifier, index);
              // ---------------------------
            }}
            onCheck={() => toggleChecked(file.name)}
            // --- NEW: CONTEXT MENU ---
            onContextMenu={(e: React.MouseEvent) => {
              // Construct full path for the opener
              const separator = sourcePath.endsWith("\\") ? "" : "\\";
              const fullPath = `${sourcePath}${separator}${file.name}`;
              onContextMenu(e, fullPath);
            }}
            // -------------------------
          />
        ))}
      </div>

      {/* --- SPRINT 11: FOOTER CLEANUP --- */}
      <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex justify-between items-center shrink-0 gap-3">
        {/* FREE UP SPACE: The primary destructive action */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleFreeSpace();
          }}
          disabled={!canDelete}
          className={`text-[10px] px-3 py-2 rounded border transition-colors flex-1 text-center font-medium whitespace-nowrap flex items-center justify-center gap-2
            ${
              canDelete
                ? "bg-red-900/20 border-red-900/50 text-red-400 hover:bg-red-900/40 hover:text-red-300 cursor-pointer"
                : "bg-zinc-800/20 border-zinc-800 text-zinc-700 cursor-not-allowed"
            }
          `}
        >
          {canDelete
            ? `Free Up Space (${verifiedSelection.length})`
            : "Free Up Space"}
        </button>

        {/* CHANGE SOURCE: Now opens dialog directly (using onSelectSource) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectSource(); // <--- UPDATED: Replaces onClearSource
          }}
          className="text-[10px] px-3 py-2 rounded border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors whitespace-nowrap"
        >
          Change Source
        </button>
      </div>
      {/* --------------------------------- */}
    </div>
  );
}
