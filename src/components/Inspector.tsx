import { useState, useEffect } from "react";
import { stat } from "@tauri-apps/plugin-fs";
import { useAppStore } from "../store/appStore";
import { formatSize, formatDate } from "../utils/formatters"; // <--- IMPORT

// FAIL-SAFE TYPE
type FileStat = Awaited<ReturnType<typeof stat>>;

export function Inspector() {
  const { selectedFile, sourcePath, checkedFiles } = useAppStore();

  // STATE
  const [meta, setMeta] = useState<FileStat | null>(null);
  const [batchSize, setBatchSize] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState(false);

  // Effect: Single File
  useEffect(() => {
    async function fetchMeta() {
      if (!selectedFile || !sourcePath) return;
      setMeta(null);
      try {
        const separator = sourcePath.endsWith("\\") ? "" : "\\";
        const data = await stat(
          `${sourcePath}${separator}${selectedFile.name}`
        );
        setMeta(data);
      } catch {
        /* ignore */
      }
    }
    fetchMeta();
  }, [selectedFile, sourcePath]);

  // Effect: Batch Size
  useEffect(() => {
    async function calculateBatch() {
      if (checkedFiles.size === 0 || !sourcePath) {
        setBatchSize(0);
        return;
      }
      setIsCalculating(true);

      const promises = Array.from(checkedFiles).map(async (filename) => {
        try {
          const separator = sourcePath.endsWith("\\") ? "" : "\\";
          const info = await stat(`${sourcePath}${separator}${filename}`);
          return info.size;
        } catch {
          return 0;
        }
      });

      const sizes = await Promise.all(promises);
      setBatchSize(sizes.reduce((acc, curr) => acc + curr, 0));
      setIsCalculating(false);
    }
    const timer = setTimeout(calculateBatch, 200);
    return () => clearTimeout(timer);
  }, [checkedFiles, sourcePath]);

  // --- RENDER ---
  return (
    <div className="flex-1 p-4 flex flex-col gap-6">
      {/* 1. BATCH SUMMARY */}
      {checkedFiles.size > 0 && (
        <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50 space-y-3 animate-in fade-in slide-in-from-top-2">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Batch Selection
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-zinc-500 font-bold">Items</p>
              <p className="text-xl text-emerald-400 font-mono">
                {checkedFiles.size}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 font-bold">Total Size</p>
              <p className="text-xl text-zinc-200 font-mono">
                {isCalculating ? "..." : formatSize(batchSize)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. SINGLE FILE */}
      {selectedFile ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="w-full aspect-video bg-zinc-900 rounded-lg flex items-center justify-center border border-zinc-800 shadow-inner">
            <span className="text-4xl select-none filter drop-shadow-lg">
              {selectedFile.isDirectory ? "📁" : "🎬"}
            </span>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
              Filename
            </p>
            <p className="text-sm text-zinc-100 font-medium break-all leading-tight mt-1">
              {selectedFile.name}
            </p>
          </div>
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
        </div>
      ) : (
        /* 3. EMPTY STATE */
        checkedFiles.size === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center opacity-30">
            <p className="text-4xl mb-2">🔍</p>
            <p className="text-xs">Select a file to inspect</p>
          </div>
        )
      )}
    </div>
  );
}
