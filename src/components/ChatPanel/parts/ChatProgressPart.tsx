/**
 * Chat Progress Part
 * Yüklenme, indeksleme vb. arka plan görevleri için gösterge
 */


export interface ProgressPartData {
    message: string;
    percentage?: number; // 0-100 veya undefined (belirsiz/indeterminate)
    details?: string;
}

export function ChatProgressPart({ data }: { data: ProgressPartData }) {
    const isIndeterminate = typeof data.percentage !== 'number';

    return (
        <div className="bg-blue-900/10 border border-blue-800/30 rounded-md p-2 my-2 flex items-center gap-3">
            {/* Spinner */}
            <div className="flex-shrink-0 w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-blue-300 truncate">
                        {data.message}
                    </span>
                    {!isIndeterminate && (
                        <span className="text-[9px] font-mono text-blue-400 font-bold ml-2">
                            {data.percentage}%
                        </span>
                    )}
                </div>

                {/* Progress bar */}
                {!isIndeterminate ? (
                    <div className="h-1 bg-black/40 rounded-full overflow-hidden w-full">
                        <div
                            className="h-1 bg-blue-500 transition-all duration-300"
                            style={{ width: `${Math.max(0, Math.min(100, data.percentage!))}%` }}
                        />
                    </div>
                ) : (
                    <div className="h-1 rounded-full overflow-hidden w-full relative bg-black/40">
                        <div className="absolute top-0 bottom-0 left-0 bg-blue-500/50 animate-[progress_1.5s_infinite_ease-in-out] rounded-full" style={{ width: '40%' }} />
                    </div>
                )}

                {data.details && (
                    <div className="text-[9px] text-blue-400/60 mt-1 truncate">
                        {data.details}
                    </div>
                )}
            </div>

            <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); width: 40%; }
          100% { transform: translateX(250%); width: 100%; }
        }
      `}</style>
        </div>
    );
}
