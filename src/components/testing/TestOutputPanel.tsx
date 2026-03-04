import { useState, useEffect } from 'react';
import { testService, TestRunResult } from '../../services/testing/testService';

export function TestOutputPanel() {
    const [outputs, setOutputs] = useState<string[]>([]);
    const [stats, setStats] = useState<{ total: number, passed: number, failed: number, skipped: number } | null>(null);

    useEffect(() => {
        const unsub = testService.subscribeRun((status, result?: TestRunResult) => {
            if (status === 'running') {
                setOutputs(prev => [...prev, '▶ Test başlatılıyor...']);
                setStats(null);
            } else if (status === 'idle') {
                if (result) {
                    const color = result.success ? 'text-green-400' : 'text-red-400';
                    const newLog = result.success
                        ? `✅ Testler tamamlandı (${result.passed}/${result.total} Başarılı)`
                        : `❌ Testler başarısız (${result.failed} Hatalı)`;

                    setOutputs(prev => [
                        ...prev,
                        `--------------------`,
                        `<span class="${color}">${newLog}</span>`
                    ]);

                    setStats({
                        total: result.total,
                        passed: result.passed,
                        failed: result.failed,
                        skipped: result.skipped
                    });
                }
            }
        });

        return unsub;
    }, []);

    return (
        <div className="flex flex-col h-full bg-[#181818] text-neutral-300 font-sans text-xs border-l border-neutral-700/50 min-w-[300px]">
            <div className="px-3 py-2 bg-[#1f1f1f] border-b border-neutral-700/50 flex justify-between items-center">
                <span className="font-semibold text-neutral-400 uppercase tracking-widest text-[10px]">Test Çıktısı</span>
                <button
                    onClick={() => { setOutputs([]); setStats(null); }}
                    className="p-1 hover:text-white transition-colors text-neutral-500 text-[10px]"
                >
                    Temizle
                </button>
            </div>

            {stats && (
                <div className="flex gap-4 px-3 py-2 bg-[#1a1a1a] border-b border-neutral-800 text-[11px] select-none">
                    <span className="text-blue-400 font-semibold" title="Toplam">T: {stats.total}</span>
                    <span className="text-green-500 font-semibold" title="Başarılı">P: {stats.passed}</span>
                    <span className="text-red-500 font-semibold" title="Başarısız">F: {stats.failed}</span>
                    {stats.skipped > 0 && <span className="text-yellow-500 font-semibold" title="Atlanan">S: {stats.skipped}</span>}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] whitespace-pre-wrap select-text leading-tight bg-[#0d0d0d]">
                {outputs.length === 0 ? (
                    <div className="text-center italic text-neutral-600 mt-4">Çıktı bekleniyor...</div>
                ) : (
                    outputs.map((log, i) => (
                        <div
                            key={i}
                            className="mb-1 p-0.5"
                            dangerouslySetInnerHTML={{ __html: log.includes('<span') ? log : `<span class="text-neutral-300">${log}</span>` }}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
