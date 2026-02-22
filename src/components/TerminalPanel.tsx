import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { agentService } from "../services/agentService";

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

export default function TerminalPanel({ projectPath, isVisible, onClose }: TerminalPanelProps) {
  const [command, setCommand] = useState("");
  const [outputs, setOutputs] = useState<TerminalOutput[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentDir, setCurrentDir] = useState(projectPath || "");
  const outputEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (projectPath) {
      setCurrentDir(projectPath);
      setOutputs([{
        type: "output",
        content: `Terminal başlatıldı. Dizin: ${projectPath}\nKomutları çalıştırmak için yazın ve Enter'a basın.\n`,
        timestamp: Date.now()
      }]);
    }
  }, [projectPath]);

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [outputs]);

  // FIX-37: Listen for AI-triggered terminal output
  useEffect(() => {
    const handleAIOutput = (e: any) => {
      const { command, output } = e.detail;
      setOutputs(prev => [
        ...prev,
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
      ]);
    };

    window.addEventListener('corex-terminal-output', handleAIOutput);
    return () => window.removeEventListener('corex-terminal-output', handleAIOutput);
  }, []);

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim() || isExecuting) return;

    // Komutu history'e ekle
    setOutputs(prev => [...prev, {
      type: "command",
      content: `$ ${cmd}`,
      timestamp: Date.now()
    }]);

    setCommand("");
    setIsExecuting(true);

    try {
      const result = await invoke<{ stdout: string; stderr: string; success: boolean }>(
        "execute_terminal_command",
        { command: cmd, path: currentDir || projectPath }
      );

      // 🤖 Otonom Ajan Analizi (Bağlam ile birlikte)
      const allLines = outputs.map(o => o.content);
      if (result.stderr) {
        allLines.push(result.stderr);
        agentService.analyzeTerminalOutput(allLines);
      } else if (result.stdout) {
        allLines.push(result.stdout);
        agentService.analyzeTerminalOutput(allLines);
      }

      if (result.stderr && result.stderr.trim()) {
        setOutputs(prev => [...prev, {
          type: "error",
          content: result.stderr,
          timestamp: Date.now()
        }]);
      }

      if (result.stdout && result.stdout.trim()) {
        setOutputs(prev => [...prev, {
          type: "output",
          content: result.stdout,
          timestamp: Date.now()
        }]);
      }

      // cd komutu özel işleme
      if (cmd.trim().startsWith("cd ")) {
        const newPath = cmd.trim().substring(3).trim().replace(/['"]/g, "");
        if (newPath) {
          setCurrentDir(prev => {
            const updated = newPath.startsWith("/") || newPath.startsWith("C:")
              ? newPath
              : `${prev}/${newPath}`;
            return updated.replace(/\\/g, "/");
          });
        }
      }

    } catch (err) {
      setOutputs(prev => [...prev, {
        type: "error",
        content: `Hata: ${err}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsExecuting(false);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCommand(command);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      executeCommand(command);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 glass-panel z-50 flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden rounded-none border-0 animate-fade-in transition-all">
      {/* Terminal Header */}
      <div className="h-10 border-b border-white/5 px-6 flex items-center justify-between bg-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50 shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/50 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 ml-3">Terminal Sistemi v4.0</span>
          {currentDir && (
            <span className="text-[10px] font-bold text-white/20 tracking-wider">
              [ {currentDir.split(/[\\/]/).pop()} ]
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-white/20 hover:text-white transition-all p-1.5 hover:bg-white/5 rounded-lg">
          <span className="text-xs">✕</span>
        </button>
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
          {outputs.map((output, index) => (
            <div key={index} className="group/output relative">
              <div className={`whitespace-pre-wrap break-words leading-relaxed drop-shadow-[0_0_2px_rgba(52,211,153,0.4)] ${output.type === "command" ? "text-blue-400 opacity-90 font-bold" :
                output.type === "error" ? "text-red-400 animate-pulse" :
                  "text-emerald-400"
                }`}>
                {output.type === "command" && <span className="mr-2 opacity-50">❯</span>}
                {output.content}
              </div>

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
          {isExecuting && (
            <div className="text-yellow-400 animate-pulse flex items-center gap-2 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce" />
              </div>
              <span className="text-[11px] font-bold tracking-widest uppercase opacity-70">Alt program yürütülüyor...</span>
            </div>
          )}
          <div ref={outputEndRef} />
        </div>
      </div>

      {/* Terminal Input */}
      <div className="border-t border-white/5 bg-black/80 backdrop-blur-xl p-4 flex-shrink-0 relative z-20">
        <form onSubmit={handleSubmit} className="flex gap-4 items-center max-w-7xl mx-auto">
          <span className="text-[var(--neon-green)] font-black animate-pulse drop-shadow-[0_0_5px_var(--neon-green)]">
            {currentDir ? currentDir.split(/[\\/]/).pop() : "~"} $&gt;
          </span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-0 outline-none p-0 text-sm font-bold text-white placeholder-white/20 tracking-wide focus:ring-0"
            placeholder={isExecuting ? "Yürütülüyor..." : "Sistem erişimi..."}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isExecuting}
            autoFocus
          />
          <div className="flex gap-2">
            <span className="text-[10px] font-black uppercase text-white/20 tracking-widest border border-white/5 px-2 py-1 rounded-md">Bash</span>
            <span className="text-[10px] font-black uppercase text-white/20 tracking-widest border border-white/5 px-2 py-1 rounded-md">UTF-8</span>
          </div>
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
