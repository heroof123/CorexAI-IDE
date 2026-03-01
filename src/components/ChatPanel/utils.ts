import React from "react";

/**
 * Yardımcı: panoya kopyala
 */
export function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {
        const el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
    });
}

/**
 * Dosya linki algılama: `src/App.tsx:45` → tıklanabilir
 */
export function parseFileLinks(text: string, onFileClick?: (path: string) => void): React.ReactNode {
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
            React.createElement('span', {
                key: m.index,
                onClick: () => onFileClick?.(filePath),
                style: {
                    color: "#60a5fa",
                    cursor: onFileClick ? "pointer" : "default",
                    textDecoration: "underline",
                    fontFamily: "monospace",
                    fontSize: 10,
                },
                title: onFileClick ? `${filePath} aç` : filePath
            }, raw)
        );

        void line;
        last = m.index + m[0].length;
    }

    if (last < text.length) parts.push(text.slice(last));
    return parts.length > 0 ? parts : text;
}
