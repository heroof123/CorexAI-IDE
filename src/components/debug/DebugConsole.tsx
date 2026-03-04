import { useState, useEffect, useRef } from 'react';
import { debugService } from '../../services/debug/debugService';

export function DebugConsole() {
    const [output, setOutput] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setOutput([...debugService.consoleOutput]);
        const unsubscribe = debugService.onStateChange(() => {
            setOutput([...debugService.consoleOutput]);
        });

        // Also we poll internal state lightly just in case output changes 
        // normally we would have an event specific for output pushing, but for now we poll
        const interval = setInterval(() => {
            if (debugService.consoleOutput.length !== output.length) {
                setOutput([...debugService.consoleOutput]);
            }
        }, 500);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, [output.length]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [output]);

    const handleEval = async () => {
        if (!input.trim()) return;
        const expr = input.trim();
        setInput('');

        // print the input first
        debugService.consoleOutput.push(`> ${expr}`);
        setOutput([...debugService.consoleOutput]);

        const session = debugService.getSession();
        if (session) {
            try {
                const res = await session.evaluate(expr);
                debugService.consoleOutput.push(`< ${res || 'undefined'}`);
            } catch (err: any) {
                debugService.consoleOutput.push(`! ${err.toString()}`);
            }
        } else {
            debugService.consoleOutput.push(`! Session not active`);
        }
        setOutput([...debugService.consoleOutput]);
    };

    return (
        <div className="flex flex-col h-full bg-[#181818] text-neutral-300 font-sans text-xs">
            <div className="px-3 py-2 bg-[#1f1f1f] border-b border-neutral-700/50 flex justify-between items-center">
                <span className="font-semibold text-neutral-400 uppercase tracking-widest text-[10px]">Debug Console</span>
                <button
                    onClick={() => { debugService.clearConsole(); setOutput([]); }}
                    className="text-neutral-500 hover:text-neutral-300 transition-colors"
                    title="Temizle"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                </button>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-2 font-mono whitespace-pre-wrap select-text"
            >
                {output.length === 0 ? (
                    <div className="text-neutral-600 italic mt-2 text-center text-[11px]">Konsol boş...</div>
                ) : (
                    output.map((line, i) => (
                        <div key={i} className={`mb-1 ${line.startsWith('!') ? 'text-red-400' : line.startsWith('>') ? 'text-blue-400' : line.startsWith('<') ? 'text-green-400' : 'text-neutral-300'}`}>
                            {line}
                        </div>
                    ))
                )}
            </div>

            <div className="p-2 border-t border-neutral-800 flex items-center bg-[#1a1a1a]">
                <span className="text-blue-500 mr-2 font-bold select-none">{'>'}</span>
                <input
                    className="flex-1 bg-transparent border-none outline-none font-mono text-neutral-200"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleEval();
                    }}
                    placeholder="İfadeyi değerlendirin..."
                />
            </div>
        </div>
    );
}
