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
}

export function FileList({
  sourcePath,
  files,
  destFiles,
  onSelectSource,
  onClearSource,
}: FileListProps) {
  const {
    selectedFile,
    setSelectedFile,
    verifiedFiles,
    verifyingFiles,
    checkedFiles,
    toggleChecked,
    checkAllMissing,
    destPath,
  } = useAppStore();

  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedFile]);

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
      onClick={() => setSelectedFile(null)}
    >
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {files.map((file) => (
          <FileRow
            key={file.name}
            ref={selectedFile?.name === file.name ? activeRef : null}
            file={file}
            isSynced={destFiles.has(file.name)}
            isVerified={verifiedFiles.has(file.name)}
            isVerifying={verifyingFiles.has(file.name)}
            hasDest={!!destPath}
            isSelected={selectedFile?.name === file.name}
            isChecked={checkedFiles.has(file.name)}
            onSelect={(e: React.MouseEvent) => {
              e.stopPropagation();
              setSelectedFile(file, "source");
            }}
            onCheck={() => toggleChecked(file.name)}
          />
        ))}
      </div>

      <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex justify-between items-center shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            checkAllMissing();
          }}
          disabled={!destPath}
          className={`text-[10px] px-3 py-1.5 rounded border transition-colors cursor-pointer
              ${
                !destPath
                  ? "bg-zinc-800/50 text-zinc-600 border-zinc-800 cursor-not-allowed"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
              }
            `}
        >
          Select All Missing Files
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClearSource();
          }}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
        >
          Change Source
        </button>
      </div>
    </div>
  );
}
