import { useEffect, useRef } from "react";
import { DirEntry } from "@tauri-apps/plugin-fs";
import { useAppStore } from "../store/appStore";

interface DestFileListProps {
  files: Set<string>; // We only know filenames in Dest (Green Dots)
}

export function DestFileList({ files }: DestFileListProps) {
  const { selectedFile, setSelectedFile } = useAppStore();
  const sortedFiles = Array.from(files).sort(); // Simple A-Z sort

  // Refs for auto-scrolling
  const activeRef = useRef<HTMLDivElement>(null);

  // AUTO-SCROLL EFFECT
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
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
    <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
      {sortedFiles.map((filename) => {
        const isSelected = selectedFile?.name === filename;

        return (
          <div
            key={filename}
            ref={isSelected ? activeRef : null}
            onClick={() => {
              // Allow selecting FROM dest too (creating a fake DirEntry)
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
            {/* Simple Dot (Always Green if it's in this list) */}
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-emerald-500/50" />

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
  );
}
