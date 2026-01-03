import { useState, useEffect } from "react"; // Added useEffect
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, DirEntry } from "@tauri-apps/plugin-fs";
import "./App.css";

function App() {
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [destPath, setDestPath] = useState<string | null>(null); // NEW: Track Destination

  const [fileList, setFileList] = useState<DirEntry[]>([]);
  const [destFiles, setDestFiles] = useState<Set<string>>(new Set()); // NEW: Quick lookup for existing files

  // 1. SELECT SOURCE
  async function handleSelectSource() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Source Media",
      });
      if (selected) {
        setSourcePath(selected as string);
        scanSource(selected as string);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // 2. SELECT DESTINATION
  async function handleSelectDest() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Backup Destination",
      });
      if (selected) {
        setDestPath(selected as string);
        // We will scan it immediately via useEffect below
      }
    } catch (err) {
      console.error(err);
    }
  }

  // HELPER: Read Source
  async function scanSource(path: string) {
    const entries = await readDir(path);
    const visible = entries.filter((file) => !file.name.startsWith("."));
    setFileList(visible);
  }

  // EFFECT: Whenever Dest Path changes, scan it to see what's inside
  useEffect(() => {
    async function scanDest() {
      if (!destPath) {
        setDestFiles(new Set()); // Clear if no dest
        return;
      }
      try {
        const entries = await readDir(destPath);
        // Create a Set of filenames for instant lookup (O(1) complexity)
        const fileSet = new Set(entries.map((e) => e.name));
        setDestFiles(fileSet);
      } catch (err) {
        console.error("Failed to read dest:", err);
      }
    }
    scanDest();
  }, [destPath]);

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-300 flex overflow-hidden font-sans select-none">
      {/* 1. LEFT PANEL (Source) */}
      <div className="w-[30%] h-full border-r border-zinc-800 flex flex-col">
        <div className="h-12 border-b border-zinc-800 flex items-center px-4 bg-zinc-900/50 justify-between">
          <span className="font-bold text-sm tracking-wide text-zinc-100">
            SOURCE
          </span>
          <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[120px]">
            {sourcePath}
          </span>
        </div>

        <div className="flex-1 flex flex-col bg-zinc-900/20 overflow-hidden relative">
          {!sourcePath ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <button
                onClick={handleSelectSource}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-md text-sm border border-zinc-700 transition-all cursor-pointer shadow-lg"
              >
                + Select Source
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {fileList.map((file) => {
                // THE TRAFFIC LIGHT LOGIC 🚦
                const isSynced = destFiles.has(file.name);

                return (
                  <div
                    key={file.name}
                    className="flex items-center gap-2 p-2 hover:bg-zinc-800/50 rounded cursor-pointer group"
                  >
                    {/* Dynamic Icon Color */}
                    <div
                      className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] transition-colors duration-300
                        ${
                          file.isDirectory
                            ? "bg-blue-500 shadow-blue-900/50"
                            : isSynced
                            ? "bg-emerald-500 shadow-emerald-500/50"
                            : "bg-red-500/50 shadow-red-900/20"
                        }
                      `}
                    ></div>

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
                        {isSynced ? "Synced & Verified" : "Missing from Dest"}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div className="sticky bottom-0 pt-2 bg-gradient-to-t from-zinc-900 to-transparent flex justify-center pb-2">
                <button
                  onClick={() => {
                    setSourcePath(null);
                    setFileList([]);
                  }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                >
                  Change Source
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. CENTER PANEL (Transfer Controls) */}
      <div className="flex-1 h-full flex flex-col bg-zinc-950/50">
        <div className="h-12 border-b border-zinc-800 flex items-center px-4 justify-between bg-zinc-900/50">
          <span className="font-bold text-sm tracking-wide text-zinc-100">
            DESTINATION
          </span>
          {/* Destination Status Badge */}
          <span
            className={`text-[10px] px-2 py-1 rounded transition-colors ${
              destPath
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-red-500/10 text-red-500"
            }`}
          >
            {destPath ? "CONNECTED" : "NOT SET"}
          </span>
        </div>

        {/* Middle Content */}
        <div className="flex-1 p-4 flex flex-col items-center justify-center">
          {!destPath ? (
            <div className="text-center">
              <button
                onClick={handleSelectDest}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-md text-sm border border-zinc-700 transition-all cursor-pointer shadow-lg"
              >
                + Select Destination
              </button>
              <p className="mt-2 text-xs text-zinc-600">Select Backup Drive</p>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
              <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 max-w-sm w-full">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">
                  Target Path
                </p>
                <p className="text-xs text-emerald-400 font-mono break-all">
                  {destPath}
                </p>
              </div>
              <button
                onClick={() => setDestPath(null)}
                className="text-[10px] text-zinc-600 hover:text-zinc-400 underline"
              >
                Unmount Destination
              </button>
            </div>
          )}
        </div>

        {/* Footer: Start Button (Only active if both set) */}
        <div className="h-16 border-t border-zinc-800 flex items-center justify-center bg-zinc-900/20">
          <button
            disabled={!sourcePath || !destPath}
            className={`px-6 py-2 rounded-lg font-medium transition-all text-sm shadow-lg
               ${
                 !sourcePath || !destPath
                   ? "bg-zinc-800 text-zinc-600 cursor-not-allowed shadow-none"
                   : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20 cursor-pointer hover:scale-105 active:scale-95"
               }
             `}
          >
            Start Transfer
          </button>
        </div>
      </div>

      {/* 3. RIGHT PANEL (Inspector) */}
      <div className="w-80 h-full border-l border-zinc-800 flex flex-col bg-zinc-900/30">
        <div className="h-12 border-b border-zinc-800 flex items-center px-4 bg-zinc-900/50">
          <span className="font-bold text-sm tracking-wide text-zinc-100">
            INSPECTOR
          </span>
        </div>
        <div className="flex-1 p-4 flex flex-col gap-4">
          <div className="w-full aspect-video bg-zinc-800 rounded-lg flex items-center justify-center border border-zinc-700/50">
            <span className="text-xs text-zinc-500">No Selection</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
