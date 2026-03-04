import { useState, useEffect } from 'react';
import { debugService } from '../../services/debug/debugService';
import { DebugState } from '../../services/debug/debugSession';

export function CallStackView({ onFrameClick }: { onFrameClick?: (frameId: number) => void }) {
    const [state, setState] = useState<DebugState>(debugService.state);

    useEffect(() => {
        const unsubscribe = debugService.onStateChange((newState) => {
            setState(newState);
        });
        return unsubscribe;
    }, []);

    // Şimdilik mock callstack verisi
    const mockFrames = state === 'paused' ? [
        { id: 1, name: 'evaluateExpression', file: 'utils.ts', line: 42 },
        { id: 2, name: 'processData', file: 'main.ts', line: 120 },
        { id: 3, name: 'anonymous', file: 'index.ts', line: 15 }
    ] : [];

    return (
        <div className="flex flex-col h-full bg-[#181818] text-neutral-300 font-sans text-xs">
            {/* Header */}
            <div className="px-3 py-2 bg-[#1f1f1f] border-b border-neutral-700/50">
                <span className="font-semibold text-neutral-400 uppercase tracking-widest text-[10px]">Call Stack</span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
                {state !== 'paused' ? (
                    <div className="text-center text-neutral-600 mt-4 italic text-[11px]">
                        {state === 'inactive' ? 'Hata ayıklama aktif değil' : 'Duraklatılmadı'}
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {mockFrames.map((frame, idx) => (
                            <div
                                key={frame.id}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${idx === 0 ? 'bg-blue-500/10 text-blue-400 font-medium' : 'hover:bg-neutral-800'}`}
                                onClick={() => onFrameClick?.(frame.id)}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-blue-400' : 'bg-neutral-600'}`} />
                                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                    {frame.name}
                                </span>
                                <span className="text-neutral-500 text-[10px]">
                                    {frame.file}:{frame.line}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
