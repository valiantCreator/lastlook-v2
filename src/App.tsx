import { Inspector } from "./components/Inspector";
import { FileList } from "./components/FileList";
import { useAppStore } from "./store/appStore";
import { useFileSystem } from "./hooks/useFileSystem";
import "./App.css";

function App() {
  // 1. DATA (From Store)
  const {
    sourcePath,
    destPath,
    fileList,
    destFiles,
    setDestPath,
    resetSource,
  } = useAppStore();

  // 2. LOGIC (From Hook)
  const { selectSource, selectDest } = useFileSystem();

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
          <FileList
            sourcePath={sourcePath}
            files={fileList}
            destFiles={destFiles}
            onSelectSource={selectSource} // <--- Clean!
            onClearSource={resetSource}
          />
        </div>
      </div>

      {/* 2. CENTER PANEL */}
      <div className="flex-1 h-full flex flex-col bg-zinc-950/50">
        <div className="h-12 border-b border-zinc-800 flex items-center px-4 justify-between bg-zinc-900/50">
          <span className="font-bold text-sm tracking-wide text-zinc-100">
            DESTINATION
          </span>
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
        <div className="flex-1 p-4 flex flex-col items-center justify-center">
          {!destPath ? (
            <div className="text-center">
              <button
                onClick={selectDest}
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
                className="text-[10px] text-zinc-600 hover:text-zinc-400 underline cursor-pointer"
              >
                Unmount Destination
              </button>
            </div>
          )}
        </div>
        <div className="h-16 border-t border-zinc-800 flex items-center justify-center bg-zinc-900/20">
          <button
            disabled={!sourcePath || !destPath}
            className={`px-6 py-2 rounded-lg font-medium transition-all text-sm shadow-lg ${
              !sourcePath || !destPath
                ? "bg-zinc-800 text-zinc-600 cursor-not-allowed shadow-none"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20 cursor-pointer hover:scale-105 active:scale-95"
            }`}
          >
            Start Transfer
          </button>
        </div>
      </div>

      {/* 3. RIGHT PANEL */}
      <div className="w-80 h-full border-l border-zinc-800 flex flex-col bg-zinc-900/30">
        <div className="h-12 border-b border-zinc-800 flex items-center px-4 bg-zinc-900/50">
          <span className="font-bold text-sm tracking-wide text-zinc-100">
            INSPECTOR
          </span>
        </div>

        {/* The New Brain */}
        <Inspector />
      </div>
    </div>
  );
}

export default App;
