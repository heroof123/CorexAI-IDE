import { useState, useEffect } from 'react';
import { breakpointService } from '../../services/debug/breakpointService';
import { Breakpoint } from '../../services/debug/debugAdapterBridge';

export function BreakpointsView({ onFileClick }: { onFileClick?: (path: string, line: number) => void }) {
    const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);

    useEffect(() => {
        setBreakpoints(breakpointService.getAllBreakpoints());
        const unsubscribe = breakpointService.subscribe((bps) => {
            setBreakpoints(bps);
        });
        return unsubscribe;
    }, []);

    return (
        <div className="flex flex-col h-full bg-[#181818] text-neutral-300 font-sans text-xs">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#1f1f1f] border-b border-neutral-700/50">
                <span className="font-semibold text-neutral-400 uppercase tracking-widest text-[10px]">Breakpoints</span>
                <button
                    onClick={() => breakpointService.removeAllBreakpoints()}
                    className="p-1 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="Hepsini Sil"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
                {breakpoints.length === 0 ? (
                    <div className="text-center text-neutral-600 mt-4 italic text-[11px]">
                        Hiç breakpoint yok
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {breakpoints.map(bp => (
                            <div
                                key={bp.id}
                                className="flex items-center gap-2 p-1.5 hover:bg-neutral-800 rounded group cursor-pointer"
                                onClick={() => onFileClick?.(bp.path, bp.line)}
                            >
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${bp.verified ? 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'bg-red-500/30'}`} />
                                <div className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                                    <span className="text-neutral-300 font-medium">
                                        {bp.path.split('/').pop() || bp.path}
                                    </span>
                                    <span className="text-neutral-500 ml-2">
                                        satır {bp.line}
                                    </span>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        breakpointService.toggleBreakpoint(bp.path, bp.line);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-red-400 rounded transition-all"
                                >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
