interface ExceptionWidgetProps {
    message: string;
    stackTrace: string[];
    onClose: () => void;
}

export function ExceptionWidget({ message, stackTrace, onClose }: ExceptionWidgetProps) {
    return (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 z-[10000] min-w-[300px] max-w-[600px] rounded shadow-2xl overflow-hidden border border-red-900 bg-[#2d1b1b] font-sans">
            <div className="bg-red-900/40 px-3 py-2 flex items-center justify-between border-b border-red-900/50">
                <div className="flex items-center gap-2">
                    <span className="text-red-400 font-bold uppercase tracking-wider text-[10px]">Exception Occurred</span>
                </div>
                <button onClick={onClose} className="text-red-300 hover:text-white transition-colors">
                    ✕
                </button>
            </div>

            <div className="p-3 text-red-200">
                <div className="font-semibold mb-2">{message}</div>

                {stackTrace.length > 0 && (
                    <div className="bg-black/20 rounded p-2 overflow-auto max-h-[150px] font-mono text-[11px] text-red-300">
                        <ul className="list-disc list-inside">
                            {stackTrace.map((stack, i) => (
                                <li key={i} className="mb-0.5 truncate">{stack}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
