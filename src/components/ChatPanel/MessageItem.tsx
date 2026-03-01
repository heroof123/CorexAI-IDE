import { useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "../../types/index";
import { CodeBlock } from "./CodeBlock";
import { ToolResultCard } from "./ToolResultCard";
import { copyToClipboard, parseFileLinks } from "./utils";

interface MessageItemProps {
    msg: Message;
    onRate?: (id: string, rating: "up" | "down") => void;
    onFileClick?: (path: string) => void;
    onAutoFix?: (error: string) => void;
}

export const MessageItem = memo(
    ({
        msg,
        onRate,
        onFileClick,
        onAutoFix,
    }: MessageItemProps) => {
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
                    <div className="text-xs leading-relaxed">
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
