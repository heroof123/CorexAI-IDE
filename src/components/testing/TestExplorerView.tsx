import { useState, useEffect } from 'react';
import { testService, TestSuite } from '../../services/testing/testService';

export function TestExplorerView() {
    const [suites, setSuites] = useState<TestSuite[]>(testService.getSuites());
    const [runningId, setRunningId] = useState<string | null>(null);

    useEffect(() => {
        testService.scanWorkspace();

        const unsub = testService.subscribe((s) => setSuites([...s]));
        const unsubRun = testService.subscribeRun((status, _result) => {
            if (status === 'idle') {
                setRunningId(null);
            }
        });

        return () => {
            unsub();
            unsubRun();
        };
    }, []);

    const runSuite = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setRunningId(id);
        testService.runSuite(id);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'passed': return <span className="text-green-500">✅</span>;
            case 'failed': return <span className="text-red-500">❌</span>;
            case 'pending': return <span className="text-neutral-500">○</span>;
            case 'skipped': return <span className="text-yellow-500">⏭</span>;
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#181818] text-neutral-300 font-sans text-xs">
            <div className="px-3 py-2 bg-[#1f1f1f] border-b border-neutral-700/50 flex justify-between items-center">
                <span className="font-semibold text-neutral-400 uppercase tracking-widest text-[10px]">Test Explorer</span>
                <button
                    onClick={() => testService.scanWorkspace()}
                    className="p-1 hover:text-white transition-colors text-neutral-500"
                    title="Yenile"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.44l5.46 5.46" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {suites.length === 0 ? (
                    <div className="text-center italic text-neutral-600 mt-4 text-[11px]">Test bulunamadı.</div>
                ) : (
                    suites.map(suite => (
                        <div key={suite.id} className="mb-2">
                            <div className="flex items-center justify-between bg-neutral-800/50 px-2 py-1.5 rounded cursor-pointer group">
                                <div className="flex items-center gap-2">
                                    <span>🧪</span>
                                    <span className="font-semibold text-neutral-300">{suite.name}</span>
                                </div>

                                {runningId === suite.id ? (
                                    <span className="text-blue-400 text-[10px] animate-pulse">Running...</span>
                                ) : (
                                    <button
                                        className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 hover:border-blue-400/50 transition-all text-[10px]"
                                        onClick={(e) => runSuite(suite.id, e)}
                                    >
                                        Run
                                    </button>
                                )}
                            </div>

                            <div className="pl-4 mt-1 border-l border-neutral-800 ml-2.5 flex flex-col gap-0.5">
                                {suite.tests.map(test => (
                                    <div key={test.id} className="flex flex-col py-1 px-2 hover:bg-neutral-800/40 rounded transition-colors group cursor-pointer">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 truncate">
                                                {getStatusIcon(test.status)}
                                                <span className={`truncate ${test.status === 'failed' ? 'text-red-300' : 'text-neutral-400'}`}>
                                                    {test.name}
                                                </span>
                                            </div>
                                        </div>
                                        {test.message && test.status === 'failed' && (
                                            <div className="text-red-400/80 text-[10px] mt-1 italic pl-5 truncate" title={test.message}>
                                                {test.message}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
