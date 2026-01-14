import { useEffect, useRef } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onReveal: () => void;
}

export function ContextMenu({ x, y, onClose, onReveal }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Adjust position if it flows off screen (Basic safeguard)
  // Logic: If y is too low, shift up. If x is too right, shift left.
  // For MVP, we render blindly, but CSS helps.

  return (
    <>
      {/* 1. Invisible Backdrop to catch clicks outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose(); // Close if right-clicked elsewhere
        }}
      />

      {/* 2. The Menu */}
      <div
        ref={menuRef}
        style={{ top: y, left: x }}
        className="fixed z-50 w-48 bg-zinc-900 border border-zinc-700 shadow-xl rounded-md py-1 flex flex-col min-w-[160px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => {
            onReveal();
            onClose();
          }}
          className="text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer flex items-center gap-2"
        >
          <svg
            className="w-4 h-4 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z"
            />
          </svg>
          Reveal in Explorer
        </button>
      </div>
    </>
  );
}
