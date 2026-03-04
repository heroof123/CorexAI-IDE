import { useState, useRef, useEffect } from "react";
import EnhancedEditor from "./EnhancedEditor";

interface SplitViewProps {
  leftFile: {
    path: string;
    content: string;
  };
  rightFile: {
    path: string;
    content: string;
  };
  onLeftChange: (content: string) => void;
  onRightChange: (content: string) => void;
  onSave: (side: "left" | "right") => void;
  onClose: () => void;
}

export default function SplitView({
  leftFile,
  rightFile,
  onLeftChange,
  onRightChange,
  onSave,
  onClose,
}: SplitViewProps) {
  const [splitPosition, setSplitPosition] = useState(50); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const percentage = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPosition(Math.max(20, Math.min(80, percentage)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="h-full flex flex-col bg-[var(--color-background)]">
      {/* Header */}
      <div className="h-10 bg-[var(--color-background)] border-b border-white/5 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-medium text-[var(--color-text)]">📊 Split View</h3>
          <div className="flex items-center gap-2 text-xs text-[var(--color-textSecondary)]">
            <span>{leftFile.path.split(/[\\/]/).pop()}</span>
            <span>↔</span>
            <span>{rightFile.path.split(/[\\/]/).pop()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onSave("left")}
            className="px-2 py-1 text-xs bg-[var(--color-primary)] text-white rounded hover:opacity-80 transition-opacity"
            title="Save Left (Ctrl+S)"
          >
            💾 Left
          </button>
          <button
            onClick={() => onSave("right")}
            className="px-2 py-1 text-xs bg-[var(--color-primary)] text-white rounded hover:opacity-80 transition-opacity"
            title="Save Right (Ctrl+Shift+S)"
          >
            💾 Right
          </button>
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs bg-[var(--color-error)] text-white rounded hover:opacity-80 transition-opacity"
            title="Close Split View"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Split Content */}
      <div ref={containerRef} className="flex-1 flex relative">
        {/* Left Panel */}
        <div
          className="bg-[var(--color-background)] border-r border-white/5"
          style={{ width: `${splitPosition}%` }}
        >
          <div className="h-8 bg-[var(--color-background)] border-b border-white/5 flex items-center px-3">
            <span className="text-xs font-medium text-[var(--color-text)]">
              📄 {leftFile.path.split(/[\\/]/).pop()}
            </span>
          </div>
          <div className="h-[calc(100%-2rem)]">
            <EnhancedEditor
              filePath={leftFile.path}
              content={leftFile.content}
              onChange={onLeftChange}
              onSave={() => onSave("left")}
              onInlineChatRequest={async (session, prompt) => {
                const { callAI } = await import("../services/ai/aiProvider");
                const result = await callAI(
                  `Aşağıdaki kod bloğunu verilen talimata göre GÜNCELLE ve SADECE GÜNCELLENMİŞ KODU DÖNDÜR:\n\nTalimat: ${prompt}\n\nMevcut Kod:\n\`\`\`\n${session.originalText}\n\`\`\`\n`,
                  "default",
                  [],
                  undefined,
                  false
                );
                return result;
              }}
            />
          </div>
        </div>

        {/* Resize Handle */}
        <div
          className={`w-1 bg-[var(--color-border)] hover:bg-[var(--color-primary)] cursor-col-resize transition-colors ${isDragging ? "bg-[var(--color-primary)]" : ""
            }`}
          onMouseDown={handleMouseDown}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-0.5 h-8 bg-[var(--color-textSecondary)] opacity-50" />
          </div>
        </div>

        {/* Right Panel */}
        <div className="bg-[var(--color-background)]" style={{ width: `${100 - splitPosition}%` }}>
          <div className="h-8 bg-[var(--color-background)] border-b border-white/5 flex items-center px-3">
            <span className="text-xs font-medium text-[var(--color-text)]">
              📄 {rightFile.path.split(/[\\/]/).pop()}
            </span>
          </div>
          <div className="h-[calc(100%-2rem)]">
            <EnhancedEditor
              filePath={rightFile.path}
              content={rightFile.content}
              onChange={onRightChange}
              onSave={() => onSave("right")}
              onInlineChatRequest={async (session, prompt) => {
                const { callAI } = await import("../services/ai/aiProvider");
                // Get active model name conceptually, but since we are outside component hook we just use 'default'
                const result = await callAI(
                  `Aşağıdaki kod bloğunu verilen talimata göre GÜNCELLE ve SADECE GÜNCELLENMİŞ KODU DÖNDÜR:\n\nTalimat: ${prompt}\n\nMevcut Kod:\n\`\`\`\n${session.originalText}\n\`\`\`\n`,
                  "default",
                  [],
                  undefined,
                  false
                );
                return result;
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer with comparison stats */}
      <div className="h-6 bg-[var(--color-surface)] border-t border-[var(--color-border)] px-3 flex items-center justify-between text-xs text-[var(--color-textSecondary)]">
        <div className="flex items-center gap-4">
          <span>Left: {leftFile.content.split("\n").length} lines</span>
          <span>Right: {rightFile.content.split("\n").length} lines</span>
        </div>
        <div className="flex items-center gap-2">
          <span>
            Split: {splitPosition.toFixed(0)}% / {(100 - splitPosition).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}
