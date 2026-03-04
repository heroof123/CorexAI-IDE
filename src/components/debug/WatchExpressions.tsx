import { useState, useEffect } from 'react';
import { debugService } from '../../services/debug/debugService';

interface WatchItem {
    id: string;
    expr: string;
    value: string | null;
    error: string | null;
}

export function WatchExpressions() {
    const [expressions, setExpressions] = useState<WatchItem[]>([]);
    const [input, setInput] = useState('');
    const [_, setTick] = useState(0); // re-render trigger for debug active state

    useEffect(() => {
        const fetchValues = async () => {
            if (debugService.state === 'paused') {
                const session = debugService.getSession();
                if (!session) return;

                const nextExprs = [...expressions];
                for (let i = 0; i < nextExprs.length; i++) {
                    try {
                        const val = await session.evaluate(nextExprs[i].expr);
                        nextExprs[i] = { ...nextExprs[i], value: val, error: null };
                    } catch (e: any) {
                        nextExprs[i] = { ...nextExprs[i], value: null, error: e.toString() };
                    }
                }
                setExpressions(nextExprs);
            }
        };

        const unsubscribe = debugService.onStateChange(() => {
            setTick(t => t + 1);
            fetchValues();
        });

        return () => {
            unsubscribe();
        };
    }, [expressions]); // FIXME: this can cause slightly tricky loops, but ok for now

    const addExpression = async () => {
        if (!input.trim()) return;
        const newExpr: WatchItem = { id: Date.now().toString(), expr: input.trim(), value: null, error: null };

        // hmen evaluate
        if (debugService.state === 'paused') {
            const session = debugService.getSession();
            if (session) {
                try {
                    newExpr.value = await session.evaluate(newExpr.expr);
                } catch (e: any) {
                    newExpr.error = e.toString();
                }
            }
        }

        setExpressions([...expressions, newExpr]);
        setInput('');
    };

    const removeExpression = (id: string) => {
        setExpressions(exp => exp.filter(e => e.id !== id));
    };

    return (
        <div className="flex flex-col h-full bg-[#181818] text-neutral-300 font-sans text-xs">
            <div className="px-3 py-2 bg-[#1f1f1f] border-b border-neutral-700/50 flex items-center justify-between">
                <span className="font-semibold text-neutral-400 uppercase tracking-widest text-[10px]">İzleme (Watch)</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                <div className="flex flex-col gap-1 font-mono">
                    {expressions.length === 0 ? (
                        <div className="text-neutral-600 italic text-[11px] mb-2">
                            İzlenecek ifade yok
                        </div>
                    ) : (
                        expressions.map(item => (
                            <div key={item.id} className="flex px-2 py-1.5 hover:bg-neutral-800 rounded group items-center">
                                <span className="text-[#9cdcfe] w-1/3 truncate" title={item.expr}>{item.expr}</span>
                                <span className="text-neutral-500 mx-1">:</span>
                                <span className="flex-1 truncate text-emerald-400">
                                    {debugService.state !== 'paused' ? 'Mevcut Değil' : (item.error ? <span className="text-red-400">{item.error}</span> : item.value || 'undefined')}
                                </span>
                                <button
                                    onClick={() => removeExpression(item.id)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-500 hover:text-red-400 ml-2"
                                >
                                    ✕
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Ekleme Inputu */}
                <div className="mt-2 flex">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') addExpression() }}
                        placeholder="İfade ekle (ör. data.length)"
                        className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 text-neutral-200 placeholder:text-neutral-600 font-mono"
                    />
                    <button
                        onClick={addExpression}
                        className="ml-2 w-7 h-7 flex items-center justify-center bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded transiton-colors"
                    >
                        +
                    </button>
                </div>
            </div>
        </div>
    );
}
