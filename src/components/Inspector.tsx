import { useState, useEffect } from "react";
import { stat } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core"; // <--- Bridge to Rust
import { useAppStore } from "../store/appStore";

// FAIL-SAFE TYPE
type FileStat = Awaited<ReturnType<typeof stat>>;

export function Inspector() {
  const { selectedFile, sourcePath } = useAppStore();

  // STATE
  const [meta, setMeta] = useState<FileStat | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // NEW: Hashing State
  const [hash, setHash] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);

  // EFFECT: Fetch details when selection changes
  useEffect(() => {
    async function fetchMeta() {
      if (!selectedFile || !sourcePath) return;

      // Reset all states when changing file
      setMeta(null);
      setErrorMsg(null);
      setHash(null);
      setIsHashing(false);

      try {
        // MANUAL JOIN (Windows Workaround)
        const separator = sourcePath.endsWith("\\") ? "" : "\\";
        const fullPath = `${sourcePath}${separator}${selectedFile.name}`;

        // Fetch Stats
        const data = await stat(fullPath);
        setMeta(data);
      } catch (err) {
        console.error("Failed to get stats:", err);
        setErrorMsg(String(err));
      }
    }
    fetchMeta();
  }, [selectedFile, sourcePath]);

  // ACTION: Call Rust to Calculate Hash
  async function handleHash() {
    if (!selectedFile || !sourcePath) return;

    setIsHashing(true);
    try {
      const separator = sourcePath.endsWith("\\") ? "" : "\\";
      const fullPath = `${sourcePath}${separator}${selectedFile.name}`;

      // CALL RUST COMMAND 🦀
      const result = await invoke<string>("calculate_hash", { path: fullPath });
      setHash(result);
    } catch (err) {
      console.error("Hashing failed:", err);
      setErrorMsg("Hash Calculation Failed");
    } finally {
      setIsHashing(false);
    }
  }

  // HELPER: Format Bytes
  function formatSize(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // HELPER: Format Date
  function formatDate(date: Date | null | undefined) {
    if (!date) return "Unknown";
    const d = new Date(date);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }

  // 1. EMPTY STATE
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
      <div className="w-full aspect-video bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-800 shadow-inner">
        <span className="text-4xl select-none filter drop-shadow-lg">
          {selectedFile.isDirectory ? "📁" : "🎬"}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
            Filename
          </p>
          <p className="text-sm text-zinc-100 font-medium break-all leading-tight mt-1">
            {selectedFile.name}
          </p>
        </div>

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

        {/* ERROR DISPLAY */}
        {errorMsg && (
          <div className="p-2 bg-red-900/20 border border-red-500/50 rounded">
            <p className="text-[10px] text-red-400 font-mono break-all">
              DEBUG: {errorMsg}
            </p>
          </div>
        )}

        {/* METADATA DISPLAY */}
        {meta && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                Size
              </p>
              <p className="text-sm text-zinc-300 font-mono mt-1">
                {formatSize(meta.size)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                Modified
              </p>
              <p className="text-sm text-zinc-300 font-mono mt-1">
                {formatDate(meta.mtime)}
              </p>
            </div>
          </div>
        )}

        {/* HASH SECTION (Only for files) */}
        {!selectedFile.isDirectory && (
          <div className="pt-4 border-t border-zinc-800">
            {!hash ? (
              <button
                onClick={handleHash}
                disabled={isHashing}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2 rounded transition-colors disabled:opacity-50 cursor-pointer border border-zinc-700"
              >
                {isHashing ? "Calculating..." : "Generate MD5 Hash"}
              </button>
            ) : (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                  MD5 Hash
                </p>
                <p className="text-[10px] text-emerald-400 font-mono break-all mt-1 bg-zinc-900/50 p-2 rounded border border-emerald-500/20 select-all cursor-text shadow-inner">
                  {hash}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
