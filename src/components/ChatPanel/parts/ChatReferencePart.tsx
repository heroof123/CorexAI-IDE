/**
 * Chat Reference Part
 * Mesaj formatındaki dosya/sembol referanslarını göstermek için UI parçası.
 */


export interface ReferencePartData {
    items: Array<{
        type: 'file' | 'symbol' | 'link';
        title: string;
        path: string;
        lineNumber?: number;
    }>;
}

export function ChatReferencePart({ data, onFileClick }: { data: ReferencePartData, onFileClick?: (path: string, line?: number) => void }) {
    if (!data.items || data.items.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1.5 my-2">
            {data.items.map((item, idx) => (
                <button
                    key={idx}
                    onClick={() => {
                        if (item.type === 'file' || item.type === 'symbol') {
                            onFileClick?.(item.path, item.lineNumber);
                        } else if (item.type === 'link') {
                            window.open(item.path, '_blank');
                        }
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-neutral-800/60 hover:bg-blue-900/40 border border-neutral-700/50 hover:border-blue-500/50 rounded-md text-[10px] text-neutral-300 transition-colors"
                    title={`Git: ${item.path}${item.lineNumber ? ` (Satır: ${item.lineNumber})` : ''}`}
                >
                    {item.type === 'file' && <span className="text-blue-400">📄</span>}
                    {item.type === 'symbol' && <span className="text-purple-400">ƒ</span>}
                    {item.type === 'link' && <span className="text-green-400">🔗</span>}
                    <span>{item.title}</span>
                </button>
            ))}
        </div>
    );
}
