import { DirEntry } from "@tauri-apps/plugin-fs";

interface FileRowProps {
  file: DirEntry;
  isSynced: boolean;
}

export function FileRow({ file, isSynced }: FileRowProps) {
  return (
    <div className="flex items-center gap-2 p-2 hover:bg-zinc-800/50 rounded cursor-pointer group transition-colors">
      {/* THE TRAFFIC LIGHT DOT 🚦 */}
      <div
        className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-all duration-300
          ${
            file.isDirectory
              ? "bg-blue-500 shadow-blue-900/50"
              : isSynced
              ? "bg-emerald-500 shadow-emerald-500/50 scale-110"
              : "bg-red-500/50 shadow-red-900/20"
          }
        `}
      />

      <div className="flex-1 min-w-0">
        <p
          className={`text-xs truncate font-medium transition-colors ${
            isSynced ? "text-emerald-100" : "text-zinc-300"
          }`}
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
