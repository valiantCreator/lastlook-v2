import { DirEntry } from "@tauri-apps/plugin-fs";

interface FileRowProps {
  file: DirEntry;
  isSynced: boolean;
  isSelected: boolean; // <--- NEW PROP
  onSelect: () => void; // <--- NEW PROP
}

export function FileRow({
  file,
  isSynced,
  isSelected,
  onSelect,
}: FileRowProps) {
  return (
    <div
      onClick={onSelect} // <--- CLICK HANDLER
      className={`
        flex items-center gap-2 p-2 rounded cursor-pointer group transition-all duration-200 border
        ${
          isSelected
            ? "bg-zinc-800 border-zinc-700 shadow-md" // Selected Style
            : "border-transparent hover:bg-zinc-800/50" // Default Style
        }
      `}
    >
      {/* TRAFFIC LIGHT DOT */}
      <div
        className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-all duration-300
          ${
            file.isDirectory
              ? "bg-blue-500 shadow-blue-900/50"
              : isSynced
              ? "bg-emerald-500 shadow-emerald-500/50"
              : "bg-red-500/50 shadow-red-900/20"
          }
          ${isSelected ? "scale-125" : ""} 
        `}
      />

      <div className="flex-1 min-w-0">
        <p
          className={`text-xs truncate font-medium transition-colors 
          ${
            isSelected
              ? "text-white"
              : isSynced
              ? "text-emerald-100"
              : "text-zinc-300"
          }
        `}
        >
          {file.name}
        </p>
        <p
          className={`text-[10px] truncate ${
            isSynced ? "text-emerald-500/70" : "text-zinc-600"
          }`}
        >
          {file.isDirectory
            ? "Folder"
            : isSynced
            ? "Synced & Verified"
            : "Missing from Dest"}
        </p>
      </div>
    </div>
  );
}
