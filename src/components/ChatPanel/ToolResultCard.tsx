import { TaskProgressCard } from "../TaskProgressCard";

interface ToolResultCardProps {
    toolName: string;
    result: any;
    onAutoFix?: (error: string) => void;
}

export function ToolResultCard({
    toolName,
    result,
    onAutoFix,
}: ToolResultCardProps) {
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

    if (toolName === "plan_task") {
        if (result.plan) {
            return <TaskProgressCard task={result.plan} />;
        }
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
