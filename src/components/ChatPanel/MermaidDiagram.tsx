import { useEffect, useRef } from "react";

export function MermaidDiagram({ code }: { code: string }) {
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
