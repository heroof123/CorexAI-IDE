import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import LivePreview from "../LivePreview";
import { MermaidDiagram } from "./MermaidDiagram";
import { copyToClipboard } from "./utils";

export function CodeBlock({ language, children }: { language: string; children: string }) {
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
