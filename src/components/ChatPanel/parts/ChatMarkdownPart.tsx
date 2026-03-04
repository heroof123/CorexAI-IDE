import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseFileLinks } from '../utils';

export interface MarkdownPartData {
    content: string;
    isAssistant: boolean;
    onFileClick?: (path: string) => void;
}

export function ChatMarkdownPart({ data }: { data: MarkdownPartData }) {
    if (!data.isAssistant) {
        return (
            <span style={{ whiteSpace: "pre-wrap" }}>
                {parseFileLinks(data.content, data.onFileClick)}
            </span>
        );
    }

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                h1: ({ children }) => (
                    <h1 style={{ fontSize: 14, fontWeight: 700, margin: "8px 0 4px", color: "var(--color-text)", borderBottom: "1px solid #1e293b", paddingBottom: 4 }}>
                        {children}
                    </h1>
                ),
                h2: ({ children }) => <h2 style={{ fontSize: 13, fontWeight: 700, margin: "6px 0 3px", color: "var(--color-text)" }}>{children}</h2>,
                h3: ({ children }) => <h3 style={{ fontSize: 12, fontWeight: 600, margin: "5px 0 2px", color: "#cbd5e1" }}>{children}</h3>,
                p: ({ children }) => <div style={{ marginBottom: 8, lineHeight: 1.65 }}>{children}</div>,
                strong: ({ children }) => <strong style={{ color: "var(--color-text)", fontWeight: 700 }}>{children}</strong>,
                em: ({ children }) => <em style={{ color: "#94a3b8" }}>{children}</em>,
                ul: ({ children }) => <ul style={{ paddingLeft: 18, marginBottom: 4 }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ paddingLeft: 18, marginBottom: 4 }}>{children}</ol>,
                li: ({ children }) => <li style={{ marginBottom: 3, lineHeight: 1.5 }}>{children}</li>,
                blockquote: ({ children }) => <blockquote style={{ borderLeft: "3px solid #334155", paddingLeft: 10, margin: "4px 0", color: "#94a3b8", fontStyle: "italic" }}>{children}</blockquote>,
                a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "underline" }}>
                        {children}
                    </a>
                ),
                hr: () => <hr style={{ border: "none", borderTop: "1px solid #1e293b", margin: "8px 0" }} />,
                table: ({ children }) => <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, margin: "6px 0", border: "1px solid #1e293b" }}>{children}</table>,
                th: ({ children }) => <th style={{ padding: "5px 8px", background: "#1e293b", color: "#e2e8f0", textAlign: "left", border: "1px solid #334155" }}>{children}</th>,
                td: ({ children }) => <td style={{ padding: "4px 8px", border: "1px solid #1e293b", color: "#94a3b8" }}>{children}</td>,
                code({ inline, className, children, ...props }: any) {
                    if (inline) {
                        return (
                            <code style={{ background: "#1e293b", color: "#7dd3fc", padding: "1px 5px", borderRadius: 3, fontSize: 10, fontFamily: "monospace" }} {...props}>
                                {children}
                            </code>
                        );
                    }
                    // For code blocks we don't handle them here if we let a separate part render it,
                    // but if the markdown itself includes code blocks as content logic, we return them raw 
                    // or standard pre logic right now. (ChatCodeBlockPart works outside Markdown context mostly or inside it via registry).
                    // In VS Code, entire markdown isn't tokenized inside a single generic component if it has custom parts, but since we rely on ReactMarkdown,
                    // we can rely on standard CodeBlock import
                    return <pre style={{ background: "#1a1a2e", padding: 8, overflowX: "auto" }}><code>{children}</code></pre>;
                }
            }}
        >
            {data.content}
        </ReactMarkdown>
    );
}
