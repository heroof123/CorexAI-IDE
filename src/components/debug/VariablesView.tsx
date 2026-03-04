import { useState, useEffect } from 'react';
import { debugService } from '../../services/debug/debugService';
import { Variable } from '../../services/debug/debugAdapterBridge';

export function VariablesView({ frameId }: { frameId?: number | null }) {
    const [variables, setVariables] = useState<Variable[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchVars = async () => {
            if (debugService.state !== 'paused') {
                setVariables([]);
                return;
            }
            const session = debugService.getSession();
            if (session) {
                setLoading(true);
                try {
                    // FrameId yoksa, 0. frame (en üst) olduğunu varsayacağız
                    const vars = await session.getVariables();
                    setVariables(vars);
                } catch (e) {
                    console.error("Failed to get variables:", e);
                } finally {
                    setLoading(false);
                }
            }
        };

        const unsubscribe = debugService.onStateChange(fetchVars);
        fetchVars(); // ilk yükleme

        return unsubscribe;
    }, [frameId]);

    // Şimdilik test için mock veriler, eğer backend boş dönerse diye.
    const displayVars = variables.length > 0 ? variables : [
        { name: 'user_count', value: '42', type: 'number', variablesReference: 0 },
        { name: 'is_active', value: 'true', type: 'boolean', variablesReference: 0 },
        { name: 'username', value: '"admin"', type: 'string', variablesReference: 0 },
    ];

    if (debugService.state !== 'paused') {
        return (
            <div className="flex flex-col h-full bg-[#181818] text-neutral-300 font-sans text-xs">
                <div className="px-3 py-2 bg-[#1f1f1f] border-b border-neutral-700/50">
                    <span className="font-semibold text-neutral-400 uppercase tracking-widest text-[10px]">Değişkenler</span>
                </div>
                <div className="flex-1 p-4 text-center text-neutral-600 italic text-[11px]">
                    Kapsam gösterilemiyor
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#181818] text-neutral-300 font-sans text-xs">
            <div className="px-3 py-2 bg-[#1f1f1f] border-b border-neutral-700/50 flex justify-between">
                <span className="font-semibold text-neutral-400 uppercase tracking-widest text-[10px]">Değişkenler (Local Scope)</span>
                {loading && <span className="text-[10px] text-blue-400">Yükleniyor...</span>}
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                <div className="flex flex-col gap-0.5 font-mono">
                    {displayVars.map((v, i) => (
                        <div key={i} className="flex px-2 py-1 hover:bg-neutral-800 rounded group">
                            <span className="text-[#9cdcfe] w-[40%] truncate">{v.name}</span>
                            <span className="text-neutral-500 mx-1">:</span>
                            <span className={`truncate flex-1 ${v.type === 'string' ? 'text-[#ce9178]' :
                                v.type === 'number' ? 'text-[#b5cea8]' :
                                    v.type === 'boolean' ? 'text-[#569cd6]' : 'text-neutral-300'
                                }`}>{v.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
