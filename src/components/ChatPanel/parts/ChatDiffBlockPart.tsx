/**
 * Chat Diff Block Part
 * Mesaj içinde AI tarafından önerilen Diff'leri (dosya değişikliklerini) gösterir
 */


export interface DiffPartData {
    filePath: string;
    oldContent?: string;
    newContent: string;
}

export function ChatDiffBlockPart({ data, onApply, onReject }: { data: DiffPartData, onApply?: () => void, onReject?: () => void }) {
    // Basit bir Diff Görünümü (Gerçek diff hesaplama yerine satırları tek tek yeni olarak kabul eden ya da gelişmiş diff kütüphanesi kullanan bir yapı eklenebilir)
    // Şimdilik DiffViewer.tsx yapısına benzer bir gösterim

    return (
        <div className="bg-neutral-900 border border-neutral-700/50 rounded overflow-hidden my-2 font-mono text-[10px]">
            <div className="flex items-center justify-between px-2 py-1.5 bg-neutral-800/80 border-b border-neutral-700/50">
                <div className="flex items-center gap-1.5 text-neutral-300">
                    <span className="text-yellow-500">📄</span>
                    <span>{data.filePath}</span>
                </div>
                <div className="flex gap-1">
                    {onApply && (
                        <button
                            onClick={onApply}
                            className="px-2 py-0.5 bg-green-600 hover:bg-green-500 text-white rounded font-sans text-[9px] transition-colors"
                        >
                            Uygula
                        </button>
                    )}
                    {onReject && (
                        <button
                            onClick={onReject}
                            className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded font-sans text-[9px] transition-colors"
                        >
                            Reddet
                        </button>
                    )}
                </div>
            </div>
            <div className="p-2 overflow-x-auto max-h-60 text-green-400">
                <pre className="m-0 leading-relaxed whitespace-pre-wrap">{data.newContent}</pre>
            </div>
        </div>
    );
}
