import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { agentService } from "../services/agentService";
import { getAutonomyConfig } from "../services/ai";

interface TerminalPanelProps {
  projectPath: string;
  isVisible: boolean;
  onClose: () => void;
}

interface TerminalOutput {
  type: "command" | "output" | "error";
  content: string;
  timestamp: number;
}

interface TerminalTab {
  id: string;
  name: string;
  currentDir: string;
  shell: "bash" | "powershell" | "cmd";
  outputs: TerminalOutput[];
  isExecuting: boolean;
  command: string;
}

export default function TerminalPanel({ projectPath, isVisible, onClose }: TerminalPanelProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const outputEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize first tab
  useEffect(() => {
    if (projectPath && tabs.length === 0) {
      const initialTab: TerminalTab = {
        id: "tab-1",
        name: "Terminal 1",
        currentDir: projectPath,
        shell: navigator.userAgent.includes("Win") ? "powershell" : "bash",
        outputs: [{
          type: "output",
          content: `Terminal başlatıldı. Dizin: ${projectPath}\nKomutları çalıştırmak için yazın ve Enter'a basın.\n`,
          timestamp: Date.now()
        }],
        isExecuting: false,
        command: ""
      };
      setTabs([initialTab]);
      setActiveTabId(initialTab.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath]);

  // Focus input on become visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible, activeTabId]);

  // Scroll to bottom
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tabs]);

  // FIX-37: Listen for AI-triggered terminal output
  useEffect(() => {
    const handleAIOutput = (e: any) => {
      const { command, output } = e.detail;
      setTabs(prev => prev.map(tab => {
        if (tab.id === activeTabId) {
          return {
            ...tab,
            outputs: [
              ...tab.outputs,
              {
                type: "command",
                content: `$ [AI] ${command}`,
                timestamp: Date.now()
              },
              {
                type: output.success ? "output" : "error",
                content: output.success ? output.stdout : output.stderr,
                timestamp: Date.now()
              }
            ]
          };
        }
        return tab;
      }));
    };

    window.addEventListener('corex-terminal-output', handleAIOutput);
    return () => window.removeEventListener('corex-terminal-output', handleAIOutput);
  }, [activeTabId]);

  const activeTab = tabs.find(t => t.id === activeTabId);

  const addNewTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab: TerminalTab = {
      id: newId,
      name: `Terminal ${tabs.length + 1}`,
      currentDir: projectPath,
      shell: navigator.userAgent.includes("Win") ? "powershell" : "bash",
      outputs: [{
        type: "output",
        content: `Yeni Terminal Başlatıldı. Dizin: ${projectPath}\n`,
        timestamp: Date.now()
      }],
      isExecuting: false,
      command: ""
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setTabs(prev => {
      const updated = prev.filter(t => t.id !== id);
      if (updated.length === 0) {
        onClose(); // If last tab is closed, close panel
        return prev; // keep state so UI doesn't crash before hiding
      }
      if (activeTabId === id) {
        setActiveTabId(updated[updated.length - 1].id);
      }
      return updated;
    });
  };

  const updateActiveTab = (updates: Partial<TerminalTab>) => {
    setTabs(prev => prev.map(tab => tab.id === activeTabId ? { ...tab, ...updates } : tab));
  };

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim() || !activeTab || activeTab.isExecuting) return;

    // Komutu history'e ekle
    const currentOutputs = [...activeTab.outputs, {
      type: "command",
      content: `$ ${cmd}`,
      timestamp: Date.now()
    } as TerminalOutput];

    updateActiveTab({
      command: "",
      isExecuting: true,
      outputs: currentOutputs
    });

    try {
      // Shell profile parsing using PowerShell wrapper if on Windows
      let finalCommand = cmd;
      if (activeTab.shell === "powershell") {
        finalCommand = `powershell -Command "${cmd.replace(/"/g, '\\"')}"`;
      } else if (activeTab.shell === "cmd") {
        finalCommand = `cmd /c "${cmd}"`;
      }

      const result = await invoke<{ stdout: string; stderr: string; success: boolean }>(
        "execute_terminal_command",
        { command: finalCommand, path: activeTab.currentDir || projectPath }
      );

      // 🤖 Otonom Ajan Analizi (Bağlam ile birlikte)
      const allLines = currentOutputs.map(o => o.content);
      if (result.stderr) {
        allLines.push(result.stderr);
        agentService.analyzeTerminalOutput(allLines);
      } else if (result.stdout) {
        allLines.push(result.stdout);
        agentService.analyzeTerminalOutput(allLines);
      }

      const newOutputs = [...currentOutputs];

      if (result.stderr && result.stderr.trim()) {
        newOutputs.push({
          type: "error",
          content: result.stderr,
          timestamp: Date.now()
        });
      }

      if (result.stdout && result.stdout.trim()) {
        newOutputs.push({
          type: "output",
          content: result.stdout,
          timestamp: Date.now()
        });
      }

      // cd komutu özel işleme
      let currentDir = activeTab.currentDir;
      if (cmd.trim().startsWith("cd ")) {
        const newPath = cmd.trim().substring(3).trim().replace(/['"]/g, "");
        if (newPath) {
          const updated = newPath.startsWith("/") || newPath.startsWith("C:")
            ? newPath
            : `${currentDir}/${newPath}`;
          currentDir = updated.replace(/\\/g, "/");
        }
      }

      updateActiveTab({ outputs: newOutputs, currentDir, isExecuting: false });

    } catch (err) {
      updateActiveTab({
        outputs: [...currentOutputs, {
          type: "error",
          content: `Hata: ${err}`,
          timestamp: Date.now()
        }],
        isExecuting: false
      });
    } finally {
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab) executeCommand(activeTab.command);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (activeTab) executeCommand(activeTab.command);
    }
  };

  // AI Explain context
  const sendToAIContext = (outputContent: string) => {
    const event = new CustomEvent('corex-fill-chat', {
      detail: `Lütfen şu terminal çıktısını açıkla ve çözüm öner:\n\`\`\`\n${outputContent}\n\`\`\``
    });
    window.dispatchEvent(event);
    onClose();
  };

  if (!isVisible || !activeTab) return null;

  return (
    <div className="absolute inset-0 glass-panel z-50 flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden rounded-none border-0 animate-fade-in transition-all">
      {/* Terminal Multi-Tab Header */}
      <div className="h-10 border-b border-white/5 bg-black/40 flex items-center justify-between flex-shrink-0">
        <div className="flex h-full items-center">
          {tabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`h-full flex items-center gap-3 px-4 border-r border-white/5 cursor-pointer transition-colors ${activeTabId === tab.id ? "bg-white/10" : "bg-transparent hover:bg-white/5"
                }`}
            >
              <div className={`w-2 h-2 rounded-full ${activeTabId === tab.id ? 'bg-[var(--neon-green)] shadow-[0_0_8px_var(--neon-green)]' : 'bg-white/20'}`} />
              <span className={`text-xs font-medium tracking-widest ${activeTabId === tab.id ? 'text-white' : 'text-white/40'}`}>
                {tab.name}
              </span>
              <button
                onClick={(e) => closeTab(e, tab.id)}
                className="ml-2 text-white/20 hover:text-red-400 p-0.5 rounded transition-colors"
                title="Kapat"
              >✕</button>
            </div>
          ))}
          <button
            onClick={addNewTab}
            className="h-full px-4 hover:bg-white/5 text-white/40 hover:text-white transition-colors flex items-center"
            title="Yeni Terminal"
          >
            ＋
          </button>
        </div>

        <div className="flex items-center pr-4 gap-4">
          <select
            className="bg-transparent text-xs text-white/50 outline-none cursor-pointer border-none p-0 focus:ring-0"
            value={activeTab.shell}
            onChange={(e) => updateActiveTab({ shell: e.target.value as any })}
          >
            <option className="bg-neutral-800" value="bash">Bash</option>
            <option className="bg-neutral-800" value="powershell">PowerShell</option>
            <option className="bg-neutral-800" value="cmd">CMD</option>
          </select>
          <button onClick={onClose} className="text-white/20 hover:text-white transition-all p-1 hover:bg-white/5 rounded">✕</button>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto p-6 font-mono text-[13px] bg-black text-[var(--neon-green)] min-h-0 relative group custom-scrollbar selection:bg-[var(--neon-green)] selection:text-black">
        {/* CRT Scanline & Flicker Effect */}
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute inset-0 opacity-[0.03]" style={{
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
            backgroundSize: '100% 4px, 3px 100%'
          }} />
          <div className="absolute inset-0 bg-white/5 animate-pulse mix-blend-overlay opacity-5" />
          <div className="absolute top-0 left-0 w-full h-[2px] bg-white opacity-[0.02] shadow-[0_0_20px_white] animate-[terminalScroll_8s_linear_infinite]" />
        </div>

        <div className="relative z-0 space-y-1">
          {activeTab.outputs.map((output, index) => (
            <div key={index} className="group/output relative">
              <div className={`whitespace-pre-wrap break-words leading-relaxed drop-shadow-[0_0_2px_rgba(52,211,153,0.4)] ${output.type === "command" ? "text-blue-400 opacity-90 font-bold mt-2" :
                output.type === "error" ? "text-red-400" :
                  "text-emerald-400"
                }`}>
                {output.type === "command" && <span className="mr-2 opacity-50">❯</span>}
                {output.content}
              </div>

              {output.type !== "command" && (
                <button
                  onClick={() => sendToAIContext(output.content)}
                  className="absolute right-0 top-0 opacity-0 group-hover/output:opacity-100 px-2 py-0.5 bg-white/10 rounded text-[10px] text-white/70 hover:bg-purple-500/30 hover:text-white transition-all backdrop-blur-md border border-white/5 flex items-center gap-1 z-20"
                >
                  <span className="text-[9px]">🤖</span> AI ile Açıkla
                </button>
              )}

              {output.type === "error" && (
                <button
                  onClick={() => agentService.applyAutofix(output.content)}
                  className="mt-2 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded text-[10px] font-black text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all flex items-center gap-2 group-hover/output:translate-x-1 duration-300 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                >
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                  🤖 AUTO-FIX UYGULA
                </button>
              )}
            </div>
          ))}
          {activeTab.isExecuting && (
            <div className="text-yellow-400 animate-pulse flex items-center gap-2 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce" />
              </div>
              <span className="text-[11px] font-bold tracking-widest uppercase opacity-70">Program yürütülüyor... ({activeTab.shell})</span>
            </div>
          )}
          <div ref={outputEndRef} />
        </div>
      </div>

      {/* Terminal Input */}
      <div className="border-t border-white/5 bg-black/80 backdrop-blur-xl p-4 flex-shrink-0 relative z-20">
        <form onSubmit={handleSubmit} className="flex gap-4 items-center max-w-[2000px] mx-auto w-full">
          <span className="text-[var(--neon-green)] font-black animate-pulse drop-shadow-[0_0_5px_var(--neon-green)] whitespace-nowrap">
            {activeTab.currentDir ? activeTab.currentDir.split(/[\\/]/).pop() : "~"} $&gt;
          </span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-0 outline-none p-0 text-sm font-bold text-white placeholder-white/20 tracking-wide focus:ring-0 w-full"
            placeholder={activeTab.isExecuting ? "Yürütülüyor..." : "Sistem komutu..."}
            value={activeTab.command}
            onChange={(e) => updateActiveTab({ command: e.target.value })}
            onKeyPress={handleKeyPress}
            disabled={activeTab.isExecuting}
            autoFocus
          />
        </form>
      </div>

      {/* Global Terminal Animations */}
      <style>{`
        @keyframes terminalScroll {
          0% { top: -100px; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
}
