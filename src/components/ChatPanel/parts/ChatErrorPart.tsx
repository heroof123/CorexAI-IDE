/**
 * Chat Error Part
 * Hataları ve uyarıları göstermek için
 */


export interface ErrorPartData {
    title?: string;
    error: string;
    code?: string;
    stack?: string;
}

export function ChatErrorPart({ data, onRetry }: { data: ErrorPartData, onRetry?: () => void }) {
    return (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 my-2 text-xs flex items-start gap-2 shadow-[0_4px_12px_rgba(239,68,68,0.1)]">
            <span className="text-red-500 mt-0.5 flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            </span>
            <div className="flex-1 min-w-0">
                <div className="font-semibold text-red-400 mb-1">
                    {data.title || "Bir Hata Oluştu"}
                </div>
                <div className="text-red-200/80 mb-2 leading-relaxed break-words font-sans">
                    {data.error}
                </div>
                {data.code && (
                    <div className="font-mono text-[9px] bg-red-950/50 px-2 py-1 rounded text-red-300 border border-red-900 mb-2 truncate" title={data.code}>
                        Code: {data.code}
                    </div>
                )}
                {data.stack && (
                    <details className="mt-2 text-[9px] text-red-400/60 font-mono">
                        <summary className="cursor-pointer mb-1 hover:text-red-300">Stack Trace</summary>
                        <pre className="whitespace-pre-wrap overflow-x-auto bg-black/40 p-2 rounded border border-red-900/50">
                            {data.stack}
                        </pre>
                    </details>
                )}
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="mt-3 px-3 py-1 bg-red-800 hover:bg-red-700 text-white rounded font-medium transition-colors flex items-center gap-1"
                    >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
                        Yeniden Dene
                    </button>
                )}
            </div>
        </div>
    );
}
