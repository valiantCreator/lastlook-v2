import { DirEntry } from "@tauri-apps/plugin-fs";

interface FileRowProps {
  file: DirEntry;
  isSynced: boolean;
  isVerified: boolean;
  isVerifying: boolean;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onCheck: () => void;
}

export function FileRow({
  file,
  isSynced,
  isVerified,
  isVerifying,
  isSelected,
  isChecked,
  onSelect,
  onCheck,
}: FileRowProps) {
  // DYNAMIC ROW STYLING
  let rowStyle = "border-transparent hover:bg-zinc-800/50"; // Default

  if (isSelected) {
    rowStyle = "bg-zinc-800 border-zinc-700 shadow-md";
  } else if (isVerifying) {
    // THE GOLDEN ROW
    rowStyle =
      "bg-yellow-500/10 border-yellow-500/20 shadow-[inset_0_0_10px_rgba(234,179,8,0.05)]";
  }

  return (
    <div
      onClick={onSelect}
      className={`
        flex items-center gap-3 p-2 rounded cursor-pointer group transition-all duration-300 border select-none
        ${rowStyle}
      `}
    >
      {/* CHECKBOX */}
      {!file.isDirectory ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onCheck();
          }}
          className={`
            w-4 h-4 rounded border flex items-center justify-center transition-all
            ${
              isChecked
                ? "bg-emerald-500 border-emerald-500 text-black"
                : "border-zinc-600 bg-zinc-900/50 hover:border-zinc-500"
            }
          `}
        >
          {isChecked && (
            <svg
              className="w-3 h-3 font-bold"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      ) : (
        <div className="w-4 h-4" />
      )}

      {/* TRAFFIC LIGHT DOT */}
      <div
        className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-all duration-300
          ${
            isVerifying
              ? "bg-yellow-400 shadow-yellow-500/50 animate-pulse"
              : file.isDirectory
              ? "bg-blue-500 shadow-blue-900/50"
              : isSynced
              ? "bg-emerald-500 shadow-emerald-500/50"
              : "bg-red-500/50 shadow-red-900/20"
          }
          ${isSelected ? "scale-125" : ""} 
        `}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Filename */}
          <p
            className={`text-xs truncate font-medium transition-colors 
              ${
                isSelected
                  ? "text-white"
                  : isVerifying
                  ? "text-yellow-100"
                  : isSynced
                  ? "text-emerald-100"
                  : "text-zinc-300"
              }
            `}
          >
            {file.name}
          </p>

          {/* SHIELD ICON */}
          {isVerified && (
            <svg
              className="w-3 h-3 text-emerald-400 animate-in zoom-in duration-300"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {/* Status Text */}
        <p
          className={`text-[10px] truncate transition-colors 
           ${
             isVerifying
               ? "text-yellow-400/80"
               : isSynced
               ? "text-emerald-500/70"
               : "text-zinc-600"
           }
        `}
        >
          {file.isDirectory
            ? "Folder"
            : isVerifying
            ? "Verifying Integrity..."
            : isVerified
            ? "Verified MD5 Match"
            : isSynced
            ? "Synced (Unverified)"
            : "Missing from Dest"}
        </p>
      </div>
    </div>
  );
}
