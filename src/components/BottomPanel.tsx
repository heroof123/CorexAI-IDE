import { useState, useEffect } from "react";
import { CodeAction, FileIndex } from "../types/index";
import ProactiveSuggestions from "./ProactiveSuggestions";
import { useLanguage } from "../contexts/LanguageContext";
import { agentService } from "../services/agentService";
import { getAutonomyConfig } from "../services/ai";
import MarkersView from "./MarkersView";
import { markersService, MarkerInfo } from "../services/markersService";



interface BottomPanelProps {
  isVisible: boolean;
  onToggle: () => void;
  pendingActions: CodeAction[];
  onAcceptAction: (actionId: string) => void;
  onRejectAction: (actionId: string) => void;
  onAcceptAllActions?: () => void; // 🆕
  fileIndex: FileIndex[];
  projectPath: string;
  currentFile?: string;
  onSuggestionClick: (action: string) => void;
  onBreakpointToggle: (filePath: string, lineNumber: number) => void;
  onFileSelect?: (filePath: string, line?: number) => void; // 🆕 navigate to file
}

function BottomPanel({
  isVisible,
  onToggle,
  pendingActions,
  onAcceptAction,
  onRejectAction,
  onAcceptAllActions,
  fileIndex,
  projectPath,
  currentFile,
  onSuggestionClick,
  onFileSelect,
}: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<
    "problems" | "output" | "terminal" | "actions" | "suggestions"
  >("problems");
  const [problems, setProblems] = useState<MarkerInfo[]>([]);
  const [output, setOutput] = useState<string[]>([]);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const { t } = useLanguage();

  // Simulate problems detection
  useEffect(() => {
    if (fileIndex.length > 0) {
      analyzeProblems();
    }
  }, [fileIndex, currentFile]);

  const analyzeProblems = () => {
    const detectedProblems: MarkerInfo[] = [];

    fileIndex.forEach((file, index) => {
      // Simulate TypeScript/JavaScript problems
      if (file.path.endsWith(".ts") || file.path.endsWith(".tsx") || file.path.endsWith(".js")) {
        // Check for common issues
        const lines = file.content.split("\n");
        lines.forEach((line, lineIndex) => {
          // Unused variables
          if (line.includes("const ") && !line.includes("=") && line.includes(";")) {
            detectedProblems.push({
              id: `${index}-${lineIndex}-unused`,
              file: file.path,
              line: lineIndex + 1,
              column: 1,
              severity: "warning",
              message: "Unused variable declaration",
              source: "TypeScript",
            });
          }

          // Missing semicolons
          if (
            (line.includes("console.log") || line.includes("return ")) &&
            !line.endsWith(";") &&
            !line.endsWith("{")
          ) {
            detectedProblems.push({
              id: `${index}-${lineIndex}-semicolon`,
              file: file.path,
              line: lineIndex + 1,
              column: line.length,
              severity: "warning",
              message: "Missing semicolon",
              source: "ESLint",
            });
          }

          // TODO comments
          if (line.includes("TODO") || line.includes("FIXME")) {
            detectedProblems.push({
              id: `${index}-${lineIndex}-todo`,
              file: file.path,
              line: lineIndex + 1,
              column: line.indexOf("TODO") !== -1 ? line.indexOf("TODO") : line.indexOf("FIXME"),
              severity: "hint", // Changed to hint since info isn't available if using MarkerSeverity without info? Wait, MarkerSeverity has info.
              message: "TODO comment found",
              source: "VSCode-AI",
            });
          }
        });
      }
    });

    setProblems(detectedProblems);
    // Push test problems to markers service so MarkersView can see them globally
    markersService.setMarkers('simulated', 'System', detectedProblems);

    // 🤖 Proactively notify agent of problems
    if (detectedProblems.length > 0) {
      agentService.analyzeProblems(detectedProblems);
    }
  };

  const addOutput = (message: string) => {
    setOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const addTerminalOutput = (message: string) => {
    setTerminalOutput(prev => [...prev, message]);
  };

  // Add some sample outputs
  useEffect(() => {
    if (projectPath) {
      addOutput(`Proje yüklendi: ${projectPath}`);
      addOutput(`${fileIndex.length} dosya indekslendi`);
      addTerminalOutput(`Corex Terminal - ${projectPath}`);
    }
  }, [projectPath, fileIndex.length]);



  const getTabCount = (tab: string) => {
    switch (tab) {
      case "problems":
        return problems.length;
      case "actions":
        return pendingActions.length;
      case "output":
        return output.length;
      case "terminal":
        return terminalOutput.length;
      default:
        return 0;
    }
  };

  if (!isVisible) {
    return (
      <div className="h-4 bg-[var(--color-background)] border-t border-[var(--color-border)] flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span>
            Problems: {problems.filter(p => p.severity === "error").length} errors,{" "}
            {problems.filter(p => p.severity === "warning").length} warnings
          </span>
          {pendingActions.length > 0 && <span>Actions: {pendingActions.length} pending</span>}
        </div>
        <button
          onClick={onToggle}
          className="text-xs text-neutral-400 hover:text-neutral-300 transition-colors"
        >
          ▲
        </button>
      </div>
    );
  }

  return (
    <div
      className="h-64 bg-[var(--color-background)] border-t border-[var(--color-border)] flex flex-col resize-y min-h-[100px] max-h-[500px] overflow-hidden"
      style={{ resize: "vertical" }}
    >
      {/* Resize Handle */}
      <div
        className="h-1 bg-neutral-700 hover:bg-blue-500 cursor-ns-resize transition-colors"
        onMouseDown={e => {
          e.preventDefault();
          const startY = e.clientY;
          const panel = e.currentTarget.parentElement as HTMLElement;
          const startHeight = panel?.offsetHeight || 256;

          const handleMouseMove = (moveEvent: MouseEvent) => {
            const newHeight = startHeight - (moveEvent.clientY - startY);
            const clampedHeight = Math.max(100, Math.min(500, newHeight));
            if (panel) {
              panel.style.height = `${clampedHeight}px`;
            }
          };

          const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
          };

          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        }}
      />

      {/* Tab Bar */}
      <div className="h-8 border-b border-[var(--color-border)] flex items-center justify-between px-2">
        <div className="flex items-center">
          {[
            { id: "problems", label: t("panel.problems"), icon: "⚠️" },
            { id: "suggestions", label: t("panel.aiSuggestions"), icon: "💡" },
            { id: "actions", label: t("panel.aiActions"), icon: "🤖" },
            { id: "output", label: t("panel.output"), icon: "📄" },
            { id: "terminal", label: t("panel.terminal"), icon: "💻" },
          ].map(tab => {
            const count = getTabCount(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1 text-xs flex items-center gap-1 transition-colors ${activeTab === tab.id
                  ? "text-white bg-[var(--color-surface)] border-b-2 border-blue-500"
                  : "text-neutral-400 hover:text-neutral-300"
                  }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className="bg-blue-600 text-white rounded-full px-1.5 py-0.5 text-[10px] min-w-[16px] text-center">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {/* Autopilot Status Badge */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/30">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">Corex Autopilot</span>
            <span className="text-[10px] text-blue-300/60 font-mono">L{getAutonomyConfig().level}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (window.confirm("☢️ TÜM PORTLAR VE SÜREÇLER TEMİZLENECEK! Emin misin?")) {
                  try {
                    const { executeTool } = await import("../services/ai");
                    addOutput("☢️ Nükleer Temizlik Başlatıldı...");
                    const result = await executeTool("panic_cleanup", {});
                    if (result.success) {
                      addOutput(`✅ Temizlik Başarılı: ${result.message}`);
                      addTerminalOutput(`\n[NUCLEAR] ${result.message}`);
                    } else {
                      addOutput(`❌ Temizlik Hatası: ${result.error}`);
                    }
                  } catch (err) {
                    console.error("Panic cleanup fail:", err);
                  }
                }
              }}
              className="px-2 py-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-600/50 rounded text-[10px] font-bold transition-all flex items-center gap-1 group"
              title="Nuclear Panic Button - Tüm portları ve zombi süreçleri temizler"
            >
              <span className="group-hover:animate-pulse">☢️</span>
              PANIC
            </button>
            <button
              onClick={() => {
                // Clear current tab content
                switch (activeTab) {
                  case "problems":
                    setProblems([]);
                    break;
                  case "output":
                    setOutput([]);
                    break;
                  case "terminal":
                    setTerminalOutput([]);
                    break;
                }
              }}
              className="text-xs text-neutral-400 hover:text-neutral-300 transition-colors"
              title="Temizle"
            >
              🗑️
            </button>
            <button
              onClick={onToggle}
              className="text-xs text-[var(--color-textSecondary)] hover:text-[var(--color-text)] transition-colors"
            >
              ▼
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "problems" && (
          <div className="h-full">
            <MarkersView onFileSelect={(file, line) => {
              if (onFileSelect) onFileSelect(file, line);
            }} />
          </div>
        )}

        {activeTab === "suggestions" && (
          <div className="h-full">
            <ProactiveSuggestions
              fileIndex={fileIndex}
              currentFile={currentFile}
              onSuggestionClick={onSuggestionClick}
            />
          </div>
        )}

        {activeTab === "actions" && (
          <div className="p-2">
            {/* Apply All Button */}
            {pendingActions.length > 1 && onAcceptAllActions && (
              <div className="mb-3 flex justify-end">
                <button
                  onClick={onAcceptAllActions}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
                  title="Tüm değişiklikleri uygula ve dosyaları aç"
                >
                  ✅ Tümünü Uygula ({pendingActions.length})
                </button>
              </div>
            )}

            {pendingActions.length === 0 ? (
              <div className="text-center text-neutral-500 py-8">
                <div className="text-2xl mb-2">🤖</div>
                <p className="text-sm">Henüz AI önerisi yok</p>
                <p className="text-xs text-neutral-600 mt-1">
                  AI asistanından kod önerileri burada görünecek
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingActions.map(action => (
                  <div
                    key={action.id}
                    className="p-3 bg-[var(--color-surface)] rounded border border-[var(--color-border)]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-blue-400">🤖</span>
                          <span className="text-sm font-medium text-white">AI Önerisi</span>
                          {(action as any).confidence && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${(action as any).confidence >= 90 ? 'bg-green-500/20 text-green-400' :
                              (action as any).confidence >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                              %{(action as any).confidence} güven
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-300 mb-1">
                          📄 {action.filePath.split(/[\\/]/).pop()}
                        </p>
                        <p className="text-xs text-neutral-400">{action.description}</p>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => onAcceptAction(action.id)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                          title="Kabul et"
                        >
                          ✓ Uygula
                        </button>
                        <button
                          onClick={() => onRejectAction(action.id)}
                          className="px-2 py-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded text-xs transition-colors"
                          title="Reddet"
                        >
                          ✗ Reddet
                        </button>
                      </div>
                    </div>

                    {/* Code preview with confidence heatmap */}
                    <div className={`mt-2 p-2 rounded border transition-colors ${(action as any).confidence >= 90 ? 'bg-green-500/5 border-green-500/20' :
                      (action as any).confidence >= 70 ? 'bg-yellow-500/5 border-yellow-500/20' :
                        'bg-red-500/5 border-red-500/20'
                      }`}>
                      <pre className="text-xs text-neutral-300 whitespace-pre-wrap overflow-x-auto">
                        {action.content.substring(0, 300)}
                        {action.content.length > 300 && "..."}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "output" && (
          <div className="p-2 font-mono text-xs">
            {output.length === 0 ? (
              <div className="text-neutral-500 text-center py-8">
                <div className="text-2xl mb-2">📄</div>
                <p>Henüz çıktı yok</p>
              </div>
            ) : (
              <div className="space-y-1">
                {output.map((line, index) => (
                  <div key={index} className="text-neutral-300">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "terminal" && (
          <div className="p-2 font-mono text-xs bg-black text-green-400">
            {terminalOutput.length === 0 ? (
              <div className="text-neutral-500 text-center py-8">
                <div className="text-2xl mb-2">💻</div>
                <p>Terminal hazır</p>
                <button
                  onClick={() => {
                    addTerminalOutput("$ npm --version");
                    addTerminalOutput("9.8.1");
                    addTerminalOutput("v18.17.0");
                  }}
                  className="mt-2 px-2 py-1 bg-green-600 text-white rounded text-xs"
                >
                  Test Komutları Çalıştır
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {terminalOutput.map((line, index) => (
                  <div key={index} className="text-green-400">
                    {line}
                  </div>
                ))}
                <div className="flex items-center">
                  <span className="text-green-400">$ </span>
                  <input
                    type="text"
                    className="flex-1 bg-transparent border-none outline-none text-green-400 ml-1"
                    placeholder="Komut girin..."
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const command = e.currentTarget.value;
                        if (command.trim()) {
                          addTerminalOutput(`$ ${command}`);
                          addTerminalOutput(`Command executed: ${command}`);
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default BottomPanel;
