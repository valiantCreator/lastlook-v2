import { DirEntry } from "@tauri-apps/plugin-fs";
import { useAppStore } from "../store/appStore"; // <--- Import Store
import { FileRow } from "./FileRow";

interface FileListProps {
  sourcePath: string | null;
  files: DirEntry[];
  destFiles: Set<string>;
  onSelectSource: () => void;
  onClearSource: () => void;
}

export function FileList({
  sourcePath,
  files,
  destFiles,
  onSelectSource,
  onClearSource,
}: FileListProps) {
  const { selectedFile, setSelectedFile } = useAppStore(); // <--- Get Selection State

  if (!sourcePath) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <button
          onClick={onSelectSource}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-md text-sm border border-zinc-700 transition-all cursor-pointer shadow-lg active:scale-95"
        >
          + Select Source
        </button>
        <p className="mt-2 text-xs text-zinc-600">Choose SD Card or Drive</p>
      </div>
    );
  }

  // 2. EMPTY FOLDER (Source Selected, but no files)
  if (files.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center opacity-50">
        <p className="text-xs text-zinc-500">Folder is empty</p>
        <button
          onClick={onClearSource}
          className="mt-2 text-[10px] text-zinc-600 hover:text-zinc-400 underline cursor-pointer"
        >
          Change Source
        </button>
      </div>
    );
  }

  // 3. POPULATED LIST
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
      {files.map((file) => (
        <FileRow
          key={file.name}
          file={file}
          isSynced={destFiles.has(file.name)}
          isSelected={selectedFile?.name === file.name} // <--- Check Match
          onSelect={() => setSelectedFile(file)} // <--- Set State
        />
      ))}

      {/* Footer Reset Button */}
      <div className="sticky bottom-0 pt-2 bg-gradient-to-t from-zinc-900 to-transparent flex justify-center pb-2">
        <button
          onClick={onClearSource}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
        >
          Change Source
        </button>
      </div>
    </div>
  );
}
