import { useAppStore } from "../store/appStore";

export function Inspector() {
  const { selectedFile } = useAppStore();

  // 1. EMPTY STATE (No File Selected)
  if (!selectedFile) {
    return (
      <div className="flex-1 p-4 flex flex-col gap-4 items-center justify-center opacity-50">
        <div className="w-full aspect-video bg-zinc-800 rounded-lg flex items-center justify-center border border-zinc-700/50">
          <span className="text-xs text-zinc-500">No Selection</span>
        </div>
      </div>
    );
  }

  // 2. ACTIVE STATE
  return (
    <div className="flex-1 p-4 flex flex-col gap-4 animate-in fade-in duration-300">
      {/* Placeholder Thumbnail */}
      <div className="w-full aspect-video bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-800 shadow-inner">
        <span className="text-4xl select-none">
          {selectedFile.isDirectory ? "📁" : "🎬"}
        </span>
      </div>

      {/* Metadata Container */}
      <div className="space-y-4">
        {/* Filename */}
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
            Filename
          </p>
          <p className="text-sm text-zinc-100 font-medium break-all leading-tight">
            {selectedFile.name}
          </p>
        </div>

        {/* Type Badge */}
        <div>
          <span
            className={`text-[10px] px-2 py-1 rounded border 
               ${
                 selectedFile.isDirectory
                   ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                   : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
               }`}
          >
            {selectedFile.isDirectory ? "FOLDER" : "FILE"}
          </span>
        </div>

        {/* Note: File Size & Date require an extra 'stat' call (Phase 3b) */}
      </div>
    </div>
  );
}
