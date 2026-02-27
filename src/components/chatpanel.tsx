import { useState, useRef, useEffect, memo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { invoke } from "@tauri-apps/api/core";
import { Message, CodeAction } from "../types/index";
import { TaskProgressCard } from "./TaskProgressCard";
import DiffViewer from "./Diffviewer";
import SmartSuggestions from "./SmartSuggestions";
import LivePreview from "./LivePreview";

interface ChatPanelProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string, context?: string) => void;
  pendingActions: CodeAction[];
  onAcceptAction: (actionId: string) => void;
  onRejectAction: (actionId: string) => void;
  onAcceptAllActions?: () => void;
  onNewSession?: () => void;
  isIndexing: boolean;
  currentFile?: string;
  projectContext?: {
    name: string;
    type: string;
    mainLanguages: string[];
  };
  onStopGeneration?: () => void;
  onRegenerateResponse?: () => void;
  isStreaming?: boolean;
  modelName?: string;
}

// ─── Yardımcı: panoya kopyala ────────────────────────────────────────────────
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  });
}

// ─── Kod Bloğu (syntax highlight + kopyala butonu) ───────────────────────────
function CodeBlock({ language, children }: { language: string; children: string }) {
  const isPreviewable = ["html", "css", "javascript", "typescript", "jsx", "tsx", "react"].includes(language?.toLowerCase() || "");
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Mermaid diagram özel render
  if (language === "mermaid") {
    return <MermaidDiagram code={children} />;
  }

  return (
    <div style={{ position: "relative", margin: "6px 0" }}>
      {/* Dil etiketi + kopyala */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#1e293b",
          padding: "3px 10px",
          borderRadius: "6px 6px 0 0",
          borderBottom: "1px solid #334155",
        }}
      >
        <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace" }}>
          {language || "code"}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {isPreviewable && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              style={{
                fontSize: 10,
                padding: "1px 7px",
                borderRadius: 4,
                border: "1px solid #334155",
                background: showPreview ? "#3b82f6" : "transparent",
                color: showPreview ? "white" : "#94a3b8",
                cursor: "pointer",
              }}
            >
              {showPreview ? "Kod Gör" : "Önizle"}
            </button>
          )}
          <button
            onClick={handleCopy}
            style={{
              fontSize: 10,
              padding: "1px 7px",
              borderRadius: 4,
              border: "1px solid #334155",
              background: "transparent",
              color: copied ? "#22c55e" : "#94a3b8",
              cursor: "pointer",
              transition: "color 0.2s",
            }}
          >
            {copied ? "✓ Kopyalandı" : "Kopyala"}
          </button>
        </div>
      </div>
      {showPreview && isPreviewable ? (
        <div style={{ height: 350, marginTop: 0 }}>
          <LivePreview code={children} showControls={false} className="rounded-t-none border-t-0" />
        </div>
      ) : (
        <SyntaxHighlighter
          language={language || "text"}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            borderRadius: "0 0 6px 6px",
            fontSize: 11,
            padding: "10px 12px",
            border: "1px solid #1e293b",
            borderTop: "none",
          }}
          wrapLongLines
        >
          {children}
        </SyntaxHighlighter>
      )}
    </div>
  );
}

// ─── Mermaid Diagram ──────────────────────────────────────────────────────────
function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "dark" });
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = `<pre style="color:#ef4444;font-size:10px">${code}</pre>`;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div
      ref={ref}
      style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 8,
        padding: 12,
        margin: "6px 0",
        overflow: "auto",
      }}
    />
  );
}

// ─── Tool sonucu zengin kartı ─────────────────────────────────────────────────
function ToolResultCard({
  toolName,
  result,
  onAutoFix,
}: {
  toolName: string;
  result: any;
  onAutoFix?: (error: string) => void;
}) {
  if (!result || !result.success) {
    return (
      <div
        style={{
          marginTop: 4,
          padding: "4px 8px",
          background: "#ef444415",
          border: "1px solid #ef444430",
          borderRadius: 6,
          fontSize: 10,
          color: "#ef4444",
        }}
      >
        ❌ {result?.error || "Analiz başarısız"}
      </div>
    );
  }
  const scoreColor = (s: number) => (s >= 80 ? "#22c55e" : s >= 60 ? "#eab308" : "#ef4444");

  if (toolName === "code_review") {
    return (
      <div
        style={{
          marginTop: 8,
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          overflow: "hidden",
          fontSize: 11,
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            background: "linear-gradient(90deg,#1e293b,#0f172a)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 20, color: scoreColor(result.score) }}>
            {result.score}
          </span>
          <div>
            <div style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 10 }}>
              {result.path?.split(/[/\\]/).pop()}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 9 }}>
              {result.issueCount} sorun · {result.suggestions?.length || 0} öneri
            </div>
          </div>
          {result.criticalIssues > 0 && (
            <span
              style={{
                marginLeft: "auto",
                padding: "2px 7px",
                background: "#ef444420",
                color: "#ef4444",
                borderRadius: 4,
                fontSize: 10,
              }}
            >
              🔴 {result.criticalIssues} kritik
            </span>
          )}
        </div>
        {result.summary && (
          <div
            style={{
              padding: "6px 12px",
              color: "#94a3b8",
              borderBottom: "1px solid #1e293b",
              lineHeight: 1.5,
            }}
          >
            {result.summary}
          </div>
        )}
        {result.issues?.slice(0, 5).map((issue: any, i: number) => (
          <div
            key={i}
            style={{
              padding: "5px 12px",
              borderBottom: "1px solid #1e293b20",
              display: "flex",
              gap: 8,
            }}
          >
            <span>
              {issue.severity === "high" ? "🔴" : issue.severity === "medium" ? "🟡" : "🔵"}
            </span>
            <span style={{ color: "#cbd5e1", flex: 1 }}>{issue.message}</span>
            {issue.line > 0 && (
              <code style={{ color: "#64748b", fontSize: 10 }}>:{issue.line}</code>
            )}
          </div>
        ))}
        {result.issueCount > 5 && (
          <div style={{ padding: "4px 12px", color: "#64748b", fontSize: 10 }}>
            +{result.issueCount - 5} sorun daha...
          </div>
        )}
      </div>
    );
  }

  if (toolName === "security_scan") {
    return (
      <div
        style={{
          marginTop: 8,
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          overflow: "hidden",
          fontSize: 11,
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            background: "linear-gradient(90deg,#1e293b,#0f172a)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 20, color: scoreColor(result.securityScore) }}>
            {result.securityScore}
          </span>
          <div>
            <div style={{ fontWeight: 600, color: "#e2e8f0" }}>🔒 Güvenlik Taraması</div>
            <div style={{ color: "#94a3b8", fontSize: 10 }}>
              {result.path?.split(/[/\\]/).pop()} · {result.vulnerabilityCount} açık
            </div>
          </div>
          {result.criticalVulnerabilities > 0 && (
            <span
              style={{
                marginLeft: "auto",
                padding: "2px 7px",
                background: "#ef444420",
                color: "#ef4444",
                borderRadius: 4,
                fontSize: 10,
              }}
            >
              ⚠️ {result.criticalVulnerabilities} kritik
            </span>
          )}
        </div>
        {result.summary && (
          <div style={{ padding: "6px 12px", color: "#94a3b8", borderBottom: "1px solid #1e293b" }}>
            {result.summary}
          </div>
        )}
        {result.vulnerabilities?.slice(0, 4).map((v: any, i: number) => (
          <div
            key={i}
            style={{
              padding: "5px 12px",
              borderBottom: "1px solid #1e293b20",
              display: "flex",
              gap: 8,
            }}
          >
            <span>
              {v.severity === "critical" || v.severity === "high"
                ? "🔴"
                : v.severity === "medium"
                  ? "🟡"
                  : "🔵"}
            </span>
            <span style={{ color: "#cbd5e1", flex: 1 }}>{v.description || v.message}</span>
          </div>
        ))}
      </div>
    );
  }

  if (toolName === "generate_docs") {
    return (
      <div
        style={{
          marginTop: 8,
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          overflow: "hidden",
          fontSize: 11,
        }}
      >
        <div
          style={{ padding: "8px 12px", background: "#1e293b", color: "#e2e8f0", fontWeight: 600 }}
        >
          📄 Dokümantasyon — {result.path?.split(/[/\\]/).pop()}
        </div>
        {result.readme && (
          <div
            style={{ padding: "8px 12px", color: "#94a3b8", borderBottom: "1px solid #1e293b10" }}
          >
            <div style={{ color: "#7dd3fc", marginBottom: 4, fontSize: 10 }}>README</div>
            {result.readme}
          </div>
        )}
        {result.apiDocs && (
          <div style={{ padding: "8px 12px", color: "#94a3b8" }}>
            <div style={{ color: "#7dd3fc", marginBottom: 4, fontSize: 10 }}>API</div>
            {result.apiDocs}
          </div>
        )}
      </div>
    );
  }

  if (toolName === "generate_tests") {
    return (
      <div
        style={{
          marginTop: 8,
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          overflow: "hidden",
          fontSize: 11,
        }}
      >
        <div
          style={{ padding: "8px 12px", background: "#1e293b", color: "#e2e8f0", fontWeight: 600 }}
        >
          🧪 Test Kodu — {result.path?.split(/[/\\]/).pop()}
        </div>
        {result.unitTests && (
          <div style={{ padding: "8px 12px" }}>
            <div style={{ color: "#7dd3fc", marginBottom: 4, fontSize: 10 }}>UNIT TESTS</div>
            <pre
              style={{
                color: "#94a3b8",
                overflow: "auto",
                maxHeight: 180,
                fontSize: 10,
                margin: 0,
              }}
            >
              {result.unitTests}
            </pre>
          </div>
        )}
      </div>
    );
  }

  if (toolName === "refactor_code") {
    return (
      <div
        style={{
          marginTop: 8,
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          overflow: "hidden",
          fontSize: 11,
        }}
      >
        <div
          style={{ padding: "8px 12px", background: "#1e293b", color: "#e2e8f0", fontWeight: 600 }}
        >
          ♻️ Refactoring Önerileri — {result.path?.split(/[/\\]/).pop()}
        </div>
        {result.summary && (
          <div
            style={{ padding: "6px 12px", color: "#94a3b8", borderBottom: "1px solid #1e293b10" }}
          >
            {result.summary}
          </div>
        )}
        {result.suggestions?.map((s: any, i: number) => (
          <div
            key={i}
            style={{
              padding: "7px 12px",
              borderBottom: "1px solid #1e293b10",
              display: "flex",
              gap: 8,
            }}
          >
            <span>{s.impact === "high" ? "🔴" : s.impact === "medium" ? "🟡" : "🔵"}</span>
            <div>
              <div style={{ color: "#7dd3fc", fontSize: 10 }}>{s.type}</div>
              <div style={{ color: "#cbd5e1" }}>{s.description}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* ── Web Arama ─────────────────────────────────────── */
  if (toolName === "web_search") {
    return (
      <div
        style={{
          marginTop: 8,
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          overflow: "hidden",
          fontSize: 11,
        }}
      >
        <div
          style={{
            padding: "6px 10px",
            background: "#1e293b",
            color: "#e2e8f0",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10
          }}
        >
          <span>🔍</span> Arama:{" "}
          <i style={{ color: "#94a3b8", fontWeight: 400 }}>{result.query}</i>
          <span style={{ marginLeft: "auto", fontSize: 9, color: "#64748b" }}>
            {result.resultCount || 0} sonuç
          </span>
        </div>
        {result.results?.map((r: any, i: number) => (
          <div key={i} style={{ padding: "7px 12px", borderBottom: "1px solid #1e293b20" }}>
            <div style={{ fontWeight: 600, color: "#60a5fa", marginBottom: 2 }}>
              {i + 1}. {r.title}
            </div>
            <div style={{ color: "#94a3b8", marginBottom: 3, lineHeight: 1.5 }}>
              {r.snippet?.slice(0, 200)}
            </div>
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#334155", fontSize: 10 }}
            >
              🔗 {r.url?.slice(0, 70)}
            </a>
          </div>
        ))}
        {(!result.results || result.results.length === 0) && (
          <div style={{ padding: 12, color: "#64748b", fontSize: 11 }}>Sonuç bulunamadı.</div>
        )}
      </div>
    );
  }

  /* ── Plan Task (görev adımları kartı) ─────────────── */
  if (toolName === "plan_task") {
    // result.plan varsa yeni format (AgentTask)
    if (result.plan) {
      return <TaskProgressCard task={result.plan} />;
    }

    // Fallback: Eski format (string array)
    const steps: string[] = result.steps || [];
    return (
      <div
        style={{
          marginTop: 8,
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          overflow: "hidden",
          fontSize: 11,
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            background: "linear-gradient(90deg,#1e293b,#0f172a)",
            color: "#e2e8f0",
            fontWeight: 600,
          }}
        >
          📋 Görev Planı
        </div>
        {result.task && (
          <div
            style={{
              padding: "6px 12px",
              color: "#7dd3fc",
              borderBottom: "1px solid #1e293b20",
              fontStyle: "italic",
            }}
          >
            {result.task}
          </div>
        )}
        {steps.map((step: string, i: number) => (
          <div
            key={i}
            style={{
              padding: "6px 12px",
              borderBottom: "1px solid #1e293b10",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#1e40af",
                color: "#93c5fd",
                display: "flex",
                alignItems: "start",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              {i + 1}
            </div>
            <span style={{ color: "#cbd5e1", flex: 1, lineHeight: 1.5 }}>{step}</span>
          </div>
        ))}
      </div>
    );
  }

  /* ── Terminal Çıktısı (Auto-Fix destekli) ─────────── */
  if (toolName === "run_terminal") {
    const isError = !result.success || result.exitCode !== 0;
    return (
      <div
        style={{
          marginTop: 8,
          background: "#0f172a",
          border: `1px solid ${isError ? "#ef444430" : "#1e293b"}`,
          borderRadius: 8,
          overflow: "hidden",
          fontSize: 11,
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            background: isError ? "#450a0a" : "#1e293b",
            color: "#e2e8f0",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{isError ? "❌" : "✅"}</span> Terminal
          {isError && (
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#fca5a5" }}>
              Exit Code: {result.exitCode}
            </span>
          )}
        </div>
        <div
          style={{
            padding: 12,
            fontFamily: "monospace",
            overflow: "auto",
            maxHeight: 200,
            color: "#cbd5e1",
            whiteSpace: "pre-wrap",
          }}
        >
          {result.stdout || result.stderr || result.message}
        </div>
        {isError && onAutoFix && (
          <div
            style={{
              padding: "8px 12px",
              borderTop: "1px solid #ef444430",
              background: "#450a0a30",
            }}
          >
            <button
              onClick={() => onAutoFix(result.stderr || result.message || "Unknown error")}
              style={{
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 11,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>✨</span> Otomatik Düzelt
            </button>
          </div>
        )}
      </div>
    );
  }

  if (toolName.startsWith("mcp_")) {
    return (
      <div
        style={{
          marginTop: 8,
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          overflow: "hidden",
          fontSize: 11,
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            background: "linear-gradient(90deg,#1e293b,#0f172a)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: "#3b82f615",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#3b82f6",
              fontSize: 14,
            }}
          >
            🔌
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 10, opacity: 0.7 }}>
              MCP SERVER: {result.server || toolName.split("_")[1]}
            </div>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 12 }}>
              {result.tool || toolName.split("_").slice(2).join("_")}
            </div>
          </div>
          <div
            style={{
              padding: "2px 8px",
              background: "#22c55e15",
              color: "#22c55e",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            SUCCESS
          </div>
        </div>

        {result.message && (
          <div style={{ padding: "6px 12px", color: "#94a3b8", borderBottom: "1px solid #1e293b" }}>
            {result.message}
          </div>
        )}

        <div style={{ padding: "8px 12px" }}>
          <pre style={{
            background: "#00000040",
            padding: 8,
            borderRadius: 4,
            overflow: "auto",
            maxHeight: 200,
            fontSize: 10,
            color: "#cbd5e1"
          }}>
            {typeof result.data === 'string'
              ? result.data
              : JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <details style={{ marginTop: 6, fontSize: 10 }}>
      <summary style={{ cursor: "pointer", color: "#64748b" }}>Sonuç</summary>
      <pre
        style={{
          marginTop: 4,
          padding: 8,
          background: "#0f172a",
          borderRadius: 4,
          overflow: "auto",
          color: "#94a3b8",
          fontSize: 10,
        }}
      >
        {JSON.stringify(result, null, 2)}
      </pre>
    </details>
  );
}

// ─── Dosya linki algılama: `src/App.tsx:45` → tıklanabilir ───────────────────
function parseFileLinks(text: string, onFileClick?: (path: string) => void): React.ReactNode {
  // Pattern: word chars + .ext veya :satır
  const re = /`([^`]+\.(tsx?|jsx?|py|rs|go|java|cpp?|css|html|vue|svelte)(?::\d+)?)`/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const raw = m[1];
    const [filePath, line] = raw.split(":");
    parts.push(
      <span
        key={m.index}
        onClick={() => onFileClick?.(filePath)}
        style={{
          color: "#60a5fa",
          cursor: onFileClick ? "pointer" : "default",
          textDecoration: "underline",
          fontFamily: "monospace",
          fontSize: 10,
        }}
        title={onFileClick ? `${filePath} aç` : filePath}
      >
        {raw}
      </span>
    );
    // Suppress unused warning
    void line;
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

// ─── Mesaj bileşeni ───────────────────────────────────────────────────────────
const MessageItem = memo(
  ({
    msg,
    onRate,
    onFileClick,
    onAutoFix,
  }: {
    msg: Message;
    onRate?: (id: string, rating: "up" | "down") => void;
    onFileClick?: (path: string) => void;
    onAutoFix?: (error: string) => void;
  }) => {
    const [msgCopied, setMsgCopied] = useState(false);

    const handleMsgCopy = () => {
      copyToClipboard(msg.content);
      setMsgCopied(true);
      setTimeout(() => setMsgCopied(false), 2000);
    };

    const isAssistant = msg.role === "assistant";

    return (
      <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
        <div
          className={`w-full rounded-lg px-3 py-2 ${msg.role === "user"
            ? "bg-[var(--color-primary)] text-white shadow-sm"
            : msg.role === "system"
              ? msg.toolExecution
                ? "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                : "bg-blue-500/10 text-[var(--color-primary)] border border-blue-500/20"
              : "bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] shadow-sm"
            }`}
          style={{ position: "relative" }}
        >
          {/* Tool Execution Header */}
          {msg.toolExecution && (
            <div className="flex items-center gap-2 mb-1">
              {msg.toolExecution.status === "running" && (
                <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              )}
              {msg.toolExecution.status === "completed" && (
                <div className="w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-2 h-2 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {msg.toolExecution.status === "failed" && (
                <div className="w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-2 h-2 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              <span className="text-[10px] font-mono opacity-70">
                {msg.toolExecution.toolName.startsWith('mcp_') ? (
                  <>
                    <span className="text-blue-400 font-bold">🔌 MCP</span>{' '}
                    {msg.toolExecution.toolName.split('_').slice(1).join(' > ')}
                  </>
                ) : (
                  msg.toolExecution.toolName
                )}
              </span>
              {msg.toolExecution.endTime && (
                <span className="text-[10px] opacity-50">
                  ({((msg.toolExecution.endTime - msg.toolExecution.startTime) / 1000).toFixed(1)}s)
                </span>
              )}
            </div>
          )}

          {/* Mesaj içeriği */}
          <div
            className="text-xs leading-relaxed"
          >
            {isAssistant ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        margin: "8px 0 4px",
                        color: "var(--color-text)",
                        borderBottom: "1px solid #1e293b",
                        paddingBottom: 4,
                      }}
                    >
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        margin: "6px 0 3px",
                        color: "var(--color-text)",
                      }}
                    >
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        margin: "5px 0 2px",
                        color: "#cbd5e1",
                      }}
                    >
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <div style={{ marginBottom: 8, lineHeight: 1.65 }}>{children}</div>
                  ),
                  strong: ({ children }) => (
                    <strong style={{ color: "var(--color-text)", fontWeight: 700 }}>{children}</strong>
                  ),
                  em: ({ children }) => <em style={{ color: "#94a3b8" }}>{children}</em>,
                  code({ inline, className, children, ...props }: any) {
                    const lang = /language-(\w+)/.exec(className || "")?.[1] || "";
                    const code = String(children).replace(/\n$/, "");
                    if (inline) {
                      return (
                        <code
                          style={{
                            background: "#1e293b",
                            color: "#7dd3fc",
                            padding: "1px 5px",
                            borderRadius: 3,
                            fontSize: 10,
                            fontFamily: "monospace",
                          }}
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return <CodeBlock language={lang}>{code}</CodeBlock>;
                  },
                  ul: ({ children }) => (
                    <ul style={{ paddingLeft: 18, marginBottom: 4 }}>{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol style={{ paddingLeft: 18, marginBottom: 4 }}>{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li style={{ marginBottom: 3, lineHeight: 1.5 }}>{children}</li>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote
                      style={{
                        borderLeft: "3px solid #334155",
                        paddingLeft: 10,
                        margin: "4px 0",
                        color: "#94a3b8",
                        fontStyle: "italic",
                      }}
                    >
                      {children}
                    </blockquote>
                  ),
                  a: ({ href, children }) => {
                    if (href?.startsWith("command:corex.applyAutofix")) {
                      const error = decodeURIComponent(href.split("?")[1] || "");
                      return (
                        <button
                          onClick={() => onAutoFix?.(error)}
                          style={{
                            color: "#ef4444",
                            textDecoration: "underline",
                            background: "transparent",
                            border: "none",
                            padding: 0,
                            font: "inherit",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          {children}
                        </button>
                      );
                    }
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#60a5fa", textDecoration: "underline" }}
                      >
                        {children}
                      </a>
                    );
                  },
                  hr: () => (
                    <hr
                      style={{ border: "none", borderTop: "1px solid #1e293b", margin: "8px 0" }}
                    />
                  ),
                  table: ({ children }) => (
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 10,
                        margin: "6px 0",
                        border: "1px solid #1e293b",
                      }}
                    >
                      {children}
                    </table>
                  ),
                  th: ({ children }) => (
                    <th
                      style={{
                        padding: "5px 8px",
                        background: "#1e293b",
                        color: "#e2e8f0",
                        textAlign: "left",
                        border: "1px solid #334155",
                      }}
                    >
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td
                      style={{ padding: "4px 8px", border: "1px solid #1e293b", color: "#94a3b8" }}
                    >
                      {children}
                    </td>
                  ),
                }}
              >
                {msg.content}
              </ReactMarkdown>
            ) : (
              <span style={{ whiteSpace: "pre-wrap" }}>
                {parseFileLinks(msg.content, onFileClick)}
              </span>
            )}
          </div>

          {/* Tool Result */}
          {msg.toolExecution?.result && msg.toolExecution.status === "completed" && (
            <ToolResultCard
              toolName={msg.toolExecution.toolName}
              result={msg.toolExecution.result}
              onAutoFix={onAutoFix}
            />
          )}

          {/* Asistan mesajı alt araç çubuğu: kopyala + rating */}
          {isAssistant && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 6,
                paddingTop: 5,
                borderTop: "1px solid #1e293b20",
              }}
            >
              {/* Kopyala */}
              <button
                onClick={handleMsgCopy}
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 4,
                  border: "1px solid #1e293b",
                  background: "transparent",
                  color: msgCopied ? "#22c55e" : "#64748b",
                  cursor: "pointer",
                }}
                title="Yanıtı kopyala"
              >
                {msgCopied ? "✓" : "⎘"} {msgCopied ? "Kopyalandı" : "Kopyala"}
              </button>

              {/* Rating */}
              {onRate && (
                <>
                  <button
                    onClick={() => onRate(msg.id, "up")}
                    style={{
                      fontSize: 12,
                      padding: "1px 4px",
                      borderRadius: 4,
                      border: "none",
                      background: (msg as any).rating === "up" ? "#22c55e30" : "transparent",
                      color: (msg as any).rating === "up" ? "#22c55e" : "#64748b",
                      cursor: "pointer",
                    }}
                    title="Beğen"
                  >
                    👍
                  </button>
                  <button
                    onClick={() => onRate(msg.id, "down")}
                    style={{
                      fontSize: 12,
                      padding: "1px 4px",
                      borderRadius: 4,
                      border: "none",
                      background: (msg as any).rating === "down" ? "#ef444430" : "transparent",
                      color: (msg as any).rating === "down" ? "#ef4444" : "#64748b",
                      cursor: "pointer",
                    }}
                    title="Beğenme"
                  >
                    👎
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

MessageItem.displayName = "MessageItem";

// ─── Session History (localStorage) ──────────────────────────────────────────
const SESSION_STORAGE_KEY = "corex-chat-sessions";

interface StoredSession {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}

function loadSessions(): StoredSession[] {
  try {
    return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSession(session: StoredSession) {
  const sessions = loadSessions().filter(s => s.id !== session.id);
  sessions.unshift(session);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions.slice(0, 20)));
}

// ─── Ana ChatPanel ────────────────────────────────────────────────────────────
function ChatPanel({
  messages,
  isLoading,
  onSendMessage,
  pendingActions,
  onAcceptAction,
  onRejectAction,
  onAcceptAllActions,
  onNewSession,
  isIndexing,
  currentFile,
  projectContext,
  onStopGeneration,
  onRegenerateResponse,
  isStreaming = false,
  modelName = "Corex AI",
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isPendingExpanded, setIsPendingExpanded] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, "up" | "down">>({});
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [currentSessionId] = useState(() => Math.random().toString(36).slice(2));

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mesajları oturuma kaydet
  useEffect(() => {
    if (messages.length === 0) return;
    const firstUserMsg = messages.find(m => m.role === "user");
    const title = firstUserMsg?.content.slice(0, 40) || "Yeni Sohbet";
    saveSession({ id: currentSessionId, title, createdAt: Date.now(), messages });
  }, [messages, currentSessionId]);

  const checkScrollPosition = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (!isAtBottom) {
      isUserScrollingRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 2000);
    } else {
      isUserScrollingRef.current = false;
    }
  };

  const scrollToBottom = (force = false) => {
    if (!messagesEndRef.current || !messagesContainerRef.current) return;
    if (isUserScrollingRef.current && !force) return;

    // Smooth scroll for normal messages, instant for streaming to stay at the very edge
    const behavior = isStreaming ? "auto" : "smooth";
    messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
  };

  // 🆕 Throttled scroll for streaming (FIX-24)
  const throttledScrollRef = useRef<number>(0);

  useEffect(() => {
    // If streaming, scroll with throttle (instantly) to prevent UI jank
    if (isStreaming) {
      const now = Date.now();
      if (now - throttledScrollRef.current > 100) {
        scrollToBottom();
        throttledScrollRef.current = now;
      }
    } else {
      // Normal message arrival, smooth scroll
      const timeout = setTimeout(() => scrollToBottom(), 100);
      return () => clearTimeout(timeout);
    }
  }, [messages, isStreaming]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || isIndexing) return;

    let messageToSend = input;
    let systemContext = "";

    // 📂 Aktif dosya içeriğini bağlam olarak ekle
    if (currentFile) {
      try {
        const fileContent = await invoke<string>("read_file_content", { path: currentFile });
        systemContext = `\n\n--- AKTİF DOSYA: ${currentFile} ---\n\`\`\`${currentFile.split(".").pop()}\n${fileContent}\n\`\`\`\n`;
      } catch (e) {
        console.error("Aktif dosya okunamadı:", e);
      }
    }

    if (uploadedImages.length > 0) {
      messageToSend = `[IMAGES:${uploadedImages.length}]\n${uploadedImages.map((img, i) => `[IMAGE_${i}]:${img}`).join("\n")}\n\n${input}`;
    }

    // Mesajı ve bağlamı ayrı ayrı gönder
    // messageToSend -> UI'da görünür
    // systemContext -> Sadece AI'ya gider (Prompt'a eklenir)
    onSendMessage(messageToSend, systemContext);

    setInput("");
    setUploadedImages([]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = event => setUploadedImages(prev => [...prev, event.target?.result as string]);
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) =>
    setUploadedImages(prev => prev.filter((_, i) => i !== index));

  const handleRate = useCallback((id: string, rating: "up" | "down") => {
    setRatings(prev => ({ ...prev, [id]: prev[id] === rating ? (undefined as any) : rating }));
  }, []);

  const messagesWithRatings = messages.map(m => ({ ...m, rating: ratings[m.id] }));

  const quickActions = [
    {
      icon: "📖",
      text: "Açıkla",
      message: currentFile ? `${currentFile} açıkla` : "Bu projeyi açıkla",
    },
    {
      icon: "🐛",
      text: "Hata",
      message: currentFile ? `${currentFile} hata kontrolü yap` : "Hata kontrolü yap",
    },
    {
      icon: "🧪",
      text: "Test",
      message: currentFile ? `${currentFile} için test yaz` : "Test yaz",
    },
    {
      icon: "🎨",
      text: "Optimize",
      message: currentFile ? `${currentFile} optimize et` : "Optimize et",
    },
  ];

  return (
    <div className="h-full flex flex-col bg-[var(--color-background)]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-neutral-800 px-3 py-1.5 bg-[var(--color-background)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex items-center justify-center w-5 h-5 rounded bg-primary/20 text-primary flex-shrink-0">
              <span className="text-[10px]">🤖</span>
            </div>
            <h3 className="text-xs font-medium text-neutral-300 truncate">
              {modelName}
              {messages.length > 0 && (
                <span className="ml-1.5 text-neutral-500 font-normal">
                  · {messages.length} mesaj
                </span>
              )}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {isIndexing && (
              <span className="text-[10px] text-slate-400 animate-pulse">🧠 İndeksleniyor...</span>
            )}
            {/* Geçmiş butonu */}
            <button
              onClick={() => {
                setSessions(loadSessions());
                setShowHistory(h => !h);
              }}
              className="px-2 py-1 text-[10px] text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
              title="Sohbet Geçmişi"
            >
              🕙
            </button>
            {onNewSession && (
              <button
                onClick={onNewSession}
                className="px-2 py-1 text-[10px] text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
              >
                Yeni
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Oturum Geçmişi Dropdown */}
      {showHistory && (
        <div
          style={{
            position: "absolute",
            top: 36,
            right: 4,
            zIndex: 9999,
            width: 260,
            background: "#181818",
            border: "1px solid #334155",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            maxHeight: 320,
            overflow: "auto",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 600,
              color: "#94a3b8",
              borderBottom: "1px solid #1e293b",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Sohbet Geçmişi</span>
            <button
              onClick={() => setShowHistory(false)}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>
          {sessions.length === 0 ? (
            <div
              style={{ padding: "16px 12px", color: "#64748b", fontSize: 11, textAlign: "center" }}
            >
              Henüz kayıtlı oturum yok
            </div>
          ) : (
            sessions.map(s => (
              <div
                key={s.id}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #1e293b10",
                }}
                onClick={() => setShowHistory(false)}
                className="hover:bg-neutral-800"
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.title}
                </div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                  {new Date(s.createdAt).toLocaleDateString("tr-TR")} · {s.messages.length} mesaj
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={checkScrollPosition}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0 custom-scrollbar"
      >
        {messages.length === 0 && (
          <div className="text-center text-neutral-500 text-xs mt-6">
            <p className="text-white font-medium mb-2">Corex AI ile sohbete başlayın 😊</p>
            <div className="grid grid-cols-1 gap-1.5 max-w-xs mx-auto mb-3">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => onSendMessage(action.message)}
                  className="px-2 py-1.5 bg-[var(--color-surface)] border-[var(--color-border)] rounded text-[10px] flex items-center gap-2"
                >
                  <span>{action.icon}</span>
                  <span>{action.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-2">
          {messagesWithRatings.map(msg => (
            <MessageItem
              key={msg.id}
              msg={msg}
              onRate={handleRate}
              onAutoFix={err => onSendMessage(`Please fix this terminal error: ${err}`)}
            />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[var(--color-surface)] border-[var(--color-border)] rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        style={{
                          width: 5,
                          height: 5,
                          background: "#3b82f6",
                          borderRadius: "50%",
                          animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-white text-[10px]">{modelName} düşünüyor...</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Pending Actions */}
      {pendingActions.length > 0 && (
        <div className="flex-shrink-0 border-t border-neutral-800">
          <button
            onClick={() => setIsPendingExpanded(!isPendingExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[var(--color-surface)]"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <span className={`transition-transform ${isPendingExpanded ? "" : "-rotate-90"}`}>
                ▼
              </span>
              💡 Bekleyen Değişiklikler ({pendingActions.length})
            </div>
            {onAcceptAllActions && pendingActions.length > 1 && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onAcceptAllActions();
                }}
                className="px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white text-[10px] rounded"
              >
                ✓ Tümü
              </button>
            )}
          </button>
          {isPendingExpanded && (
            <div className="max-h-[200px] overflow-y-auto p-2 space-y-2 bg-[var(--color-background)]">
              {pendingActions.map(action => (
                <DiffViewer
                  key={action.id}
                  filePath={action.filePath}
                  oldContent={action.oldContent || ""}
                  newContent={action.content}
                  onAccept={() => onAcceptAction(action.id)}
                  onReject={() => onRejectAction(action.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-neutral-800 p-2 bg-[var(--color-background)]">
        <div className="relative">
          <SmartSuggestions
            input={input}
            currentFile={currentFile}
            projectContext={projectContext}
            onSuggestionSelect={setInput}
          />
          {uploadedImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {uploadedImages.map((img, index) => (
                <div key={index} className="relative group">
                  <img
                    src={img}
                    className="w-16 h-16 object-cover rounded border-[var(--color-border)]"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center text-white text-[10px]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            className="w-full bg-[var(--color-hover)] border border-[var(--color-border)] focus:neon-border rounded-lg px-2.5 py-1.5 pr-10 text-xs outline-none resize-none text-[var(--color-text)] transition-all duration-200 placeholder-neutral-500"
            placeholder={isIndexing ? "🧠 Proje indeksleniyor..." : "✨ AI ile sohbet et..."}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isLoading || isIndexing}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || isIndexing || !input.trim()}
            className="absolute right-1.5 bottom-1.5 p-1.5 rounded-md bg-[var(--color-primary)] text-white disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-600">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 hover:text-neutral-300"
            >
              📷
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
            {isStreaming && onStopGeneration && (
              <button onClick={onStopGeneration} className="text-red-400">
                Durdur
              </button>
            )}
            {!isStreaming && !isLoading && messages.length > 0 && onRegenerateResponse && (
              <button onClick={onRegenerateResponse} className="hover:text-neutral-300">
                🔄 Yeniden
              </button>
            )}
          </div>
          <span>Shift+Enter yeni satır</span>
        </div>
      </div>
    </div>
  );
}

export default memo(ChatPanel);
