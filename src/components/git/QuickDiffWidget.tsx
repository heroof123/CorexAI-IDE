import { LineDiff } from '../../services/git/QuickDiffDecorator';

interface QuickDiffWidgetProps {
    diff: LineDiff | null;
    onRevert: () => void;
    onClose: () => void;
    position: { top: number, left: number } | null;
}

export default function QuickDiffWidget({ diff, onRevert, onClose, position }: QuickDiffWidgetProps) {
    if (!diff || !position) return null;

    return (
        <div
            className="fixed z-50 bg-[#1e1e1e] border border-[#333] shadow-2xl rounded rounded-l flex flex-col min-w-[300px] max-w-[500px]"
            style={{ top: position.top, left: position.left }}
        >
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[#333] rounded-t text-xs">
                <span className="font-semibold text-white">Çalışma Ağıcı Değişikliği (Quick Diff)</span>
                <div className="flex items-center gap-1 text-[10px]">
                    <button
                        onClick={onRevert}
                        className="px-2 py-0.5 hover:bg-[#333] rounded text-[#ccc] hover:text-white transition-colors flex items-center gap-1"
                        title="Değişikliği geri al"
                    >
                        ↩️ Geri Al
                    </button>
                    <button
                        onClick={onClose}
                        className="w-5 h-5 flex items-center justify-center hover:bg-red-500/20 text-[#ccc] hover:text-red-400 rounded transition-colors"
                        title="Kapat"
                    >
                        x
                    </button>
                </div>
            </div>

            <div className="p-2 overflow-x-auto bg-[#1e1e1e] rounded-b">
                <pre className="text-xs font-mono m-0 text-left">
                    {diff.content.split('\\n').map((line, idx) => {
                        let lineClass = "text-gray-300";
                        if (line.startsWith('+') && !line.startsWith('+++')) {
                            lineClass = "text-green-400 bg-green-500/10 px-1 rounded";
                        } else if (line.startsWith('-') && !line.startsWith('---')) {
                            lineClass = "text-red-400 bg-red-500/10 px-1 rounded line-through";
                        } else if (line.startsWith('@@')) {
                            lineClass = "text-blue-400 font-bold opacity-70";
                        }

                        return (
                            <div key={idx} className={`${lineClass} mb-0.5`}>
                                {line || ' '}
                            </div>
                        );
                    })}
                </pre>
            </div>
        </div>
    );
}
