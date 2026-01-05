import { useState, useEffect } from "react";
import { useAppStore } from "../store/appStore";
import { formatSize, formatDuration } from "../utils/formatters";

interface JobDrawerProps {
  isTransferring: boolean;
  currentFile: string;
  currentFileBytes: number;
  progress: number;
  isVerifying: boolean;
  onStart: () => void;
  onCancel: () => void;
  canStart: boolean;
}

export function JobDrawer({
  isTransferring,
  currentFile,
  currentFileBytes,
  progress,
  isVerifying,
  onStart,
  onCancel,
  canStart,
}: JobDrawerProps) {
  const {
    isDrawerOpen,
    toggleDrawer,
    batchTotalBytes,
    completedBytes,
    transferStartTime,
    checkedFiles,
    fileList,
    verifiedFiles,
  } = useAppStore();

  const [timeRemaining, setTimeRemaining] = useState<string>("--:--");
  const [speed, setSpeed] = useState<string>("0 MB/s");

  // --- METRICS TICKER ---
  useEffect(() => {
    if (!isTransferring || !transferStartTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - transferStartTime;
      if (elapsed < 1000) return;

      // LIVE MATH: Total Done = Finished Files + Current Active File Progress
      const totalProcessed = completedBytes + currentFileBytes;

      // Avg Speed = Total Bytes / Total Time
      const bytesPerSec = totalProcessed / (elapsed / 1000);
      setSpeed(`${formatSize(bytesPerSec)}/s`);

      // Estimated Total Time
      if (bytesPerSec > 0) {
        const totalDuration = batchTotalBytes / bytesPerSec; // seconds
        const remaining = totalDuration * 1000 - elapsed;
        setTimeRemaining(
          remaining > 0 ? formatDuration(remaining) : "Almost done..."
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    isTransferring,
    transferStartTime,
    completedBytes,
    batchTotalBytes,
    currentFileBytes,
  ]);

  // Global Progress %
  const totalProcessed = completedBytes + currentFileBytes;
  const globalProgress =
    batchTotalBytes > 0
      ? Math.min(100, Math.round((totalProcessed / batchTotalBytes) * 100))
      : 0;

  // --- LIST MANIFEST ---
  const manifest = fileList.filter((f) => checkedFiles.has(f.name));

  return (
    <div
      className={`
        w-full bg-zinc-900 border-t border-zinc-800 shadow-[0_-5px_25px_rgba(0,0,0,0.5)]
        transition-all duration-300 ease-out flex flex-col z-40 shrink-0
        ${isDrawerOpen ? "h-[450px]" : "h-20"}
      `}
    >
      {/* --- HEADER (CLICK TO TOGGLE) --- */}
      <div
        className="h-20 px-4 flex items-center justify-between shrink-0 cursor-pointer hover:bg-zinc-800/30 transition-colors"
        onClick={() => toggleDrawer(!isDrawerOpen)} // FIX: Allow toggle anytime
      >
        {isTransferring ? (
          <div className="flex-1 flex items-center gap-4 min-w-0">
            {/* STOP BUTTON */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-red-900/50 border border-zinc-700 hover:border-red-500 flex items-center justify-center transition-all group shadow-lg active:scale-95 shrink-0"
              title="Cancel Transfer"
            >
              <div className="w-3 h-3 bg-red-500 rounded-sm group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
            </button>

            {/* DUAL PROGRESS BARS */}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
              {/* MICRO (File) */}
              <div className="flex justify-between items-end text-[10px] font-mono uppercase leading-none">
                <span
                  className={`truncate pr-4 font-bold max-w-[300px] ${
                    isVerifying ? "text-yellow-400" : "text-zinc-100"
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
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isVerifying
                      ? "bg-yellow-500 progress-stripe"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* MACRO (Batch) */}
              <div className="flex justify-between items-end text-[9px] font-mono uppercase text-zinc-500 leading-none mt-0.5">
                <span>Batch Progress ({globalProgress}%)</span>
                <span>{timeRemaining} left</span>
              </div>
              <div className="h-1 w-full bg-zinc-800/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500/50 transition-all duration-500"
                  style={{ width: `${globalProgress}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* IDLE STATE: START BUTTON + Expand Toggle */
          <div className="w-full flex items-center gap-4">
            <div className="flex-1 flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStart();
                }}
                disabled={!canStart}
                className={`w-full max-w-sm py-3 rounded-md font-bold text-xs uppercase tracking-wider transition-all shadow-lg
                    ${
                      !canStart
                        ? "bg-zinc-800 text-zinc-600 cursor-not-allowed shadow-none border border-zinc-700"
                        : "bg-red-600 hover:bg-red-500 text-white shadow-red-900/20 cursor-pointer active:scale-95 border border-red-500"
                    }
                  `}
              >
                Transfer Files
              </button>
            </div>
          </div>
        )}

        {/* EXPAND ICON (Always Visible) */}
        <div className="text-zinc-600 pl-4 shrink-0">
          {isDrawerOpen ? (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
              />
            </svg>
          )}
        </div>
      </div>

      {/* --- BODY (EXPANDED MANIFEST) --- */}
      <div className="flex-1 bg-zinc-950/50 overflow-y-auto p-4 border-t border-zinc-800/50 scrollbar-thin scrollbar-thumb-zinc-700">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* METRICS GRID */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-900 p-3 rounded border border-zinc-800 text-center">
              <p className="text-[10px] text-zinc-500 uppercase font-bold">
                Total Batch
              </p>
              <p className="text-lg text-zinc-200 font-mono">
                {formatSize(batchTotalBytes)}
              </p>
            </div>
            <div className="bg-zinc-900 p-3 rounded border border-zinc-800 text-center">
              <p className="text-[10px] text-zinc-500 uppercase font-bold">
                Speed (Avg)
              </p>
              <p className="text-lg text-emerald-400 font-mono">{speed}</p>
            </div>
            <div className="bg-zinc-900 p-3 rounded border border-zinc-800 text-center">
              <p className="text-[10px] text-zinc-500 uppercase font-bold">
                Remaining
              </p>
              <p className="text-lg text-blue-400 font-mono">{timeRemaining}</p>
            </div>
          </div>

          {/* FILE LIST */}
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-2">
              Transfer Queue
            </p>
            {manifest.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No files selected.</p>
            ) : (
              manifest.map((f) => {
                const isDone = verifiedFiles.has(f.name);
                const isActive =
                  currentFile.includes(f.name) || currentFile === f.name;

                return (
                  <div
                    key={f.name}
                    className={`
                          flex items-center justify-between p-2 rounded border text-xs font-mono
                          ${
                            isActive
                              ? "bg-zinc-800 border-zinc-600 text-white shadow-md scale-[1.01] transition-transform"
                              : isDone
                              ? "bg-zinc-900/30 border-transparent text-zinc-500"
                              : "bg-transparent border-transparent text-zinc-600"
                          }
                        `}
                  >
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-[10px] font-bold uppercase">
                      {isDone ? "Done" : isActive ? "Active" : "Pending"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
