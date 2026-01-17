import { useState } from "react";

interface ConflictModalProps {
  conflicts: string[];
  onOverwrite: (force: boolean) => void; // <--- UPDATED SIGNATURE
  onSkip: () => void;
  onCancel: () => void;
}

export function ConflictModal({
  conflicts,
  onOverwrite,
  onSkip,
  onCancel,
}: ConflictModalProps) {
  // Default to True (Safe/Fast behavior)
  const [useSmartResume, setUseSmartResume] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[400px] max-w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-red-900/20 border-b border-red-900/50 p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-zinc-100 font-bold text-sm">
              File Conflict Detected
            </h3>
            <p className="text-xs text-red-300">
              Destination already contains {conflicts.length} file(s).
            </p>
          </div>
        </div>

        {/* List of Conflicts */}
        <div className="max-h-[200px] overflow-y-auto p-4 bg-zinc-950/50 space-y-1">
          {conflicts.map((name) => (
            <div
              key={name}
              className="text-xs font-mono text-zinc-400 truncate flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {name}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="p-4 bg-zinc-900 flex flex-col gap-3">
          {/* --- SMART RESUME CHECKBOX --- */}
          <label className="flex items-start gap-2 cursor-pointer group select-none">
            <input
              type="checkbox"
              checked={useSmartResume}
              onChange={(e) => setUseSmartResume(e.target.checked)}
              className="mt-0.5 accent-blue-500 cursor-pointer"
            />
            <div className="text-xs text-zinc-400 group-hover:text-zinc-300">
              <span className="font-bold text-zinc-300 block">
                Smart Resume
              </span>
              Skip identical files (Size & Date match) to save time.
            </div>
          </label>
          {/* ----------------------------- */}

          <button
            onClick={() => onOverwrite(!useSmartResume)} // Pass force=true if unchecked
            className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase rounded transition-colors shadow-lg shadow-red-900/20"
          >
            {useSmartResume ? "Overwrite (Smart)" : "Force Overwrite All"}
          </button>

          <button
            onClick={onSkip}
            className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold uppercase rounded border border-zinc-700 transition-colors"
          >
            Skip Existing
          </button>

          <button
            onClick={onCancel}
            className="w-full py-2 text-zinc-500 hover:text-zinc-400 text-xs underline mt-1"
          >
            Cancel Transfer
          </button>
        </div>
      </div>
    </div>
  );
}
