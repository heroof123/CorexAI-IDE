import { useState, useEffect } from 'react';
import { debugService } from '../../services/debug/debugService';

interface DebugHoverProps {
    x: number;
    y: number;
    expression: string;
    onClose: () => void;
}

export function DebugHover({ x, y, expression, onClose }: DebugHoverProps) {
    const [value, setValue] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const evaluate = async () => {
            const session = debugService.getSession();
            if (session && debugService.state === 'paused') {
                try {
                    const res = await session.evaluate(expression);
                    if (active) {
                        setValue(res || 'undefined');
                        setLoading(false);
                    }
                } catch (e: any) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    if (active) {
                        setValue(`Hata: ${e.toString()}`);
                        setLoading(false);
                    }
                }
            } else {
                if (active) {
                    setValue('Oturum aktif değil');
                    setLoading(false);
                }
            }
        };

        evaluate();

        return () => { active = false; };
    }, [expression]);

    return (
        <div
            className="fixed z-[9999] bg-[#1e1e1e] border border-[#454545] rounded shadow-lg p-2 font-mono text-xs text-neutral-300 min-w-[200px]"
            style={{ left: x, top: y, transform: 'translateY(-100%)', marginTop: -8 }}
            onMouseLeave={onClose}
        >
            <div className="flex justify-between items-center mb-1 text-[10px] text-neutral-500 font-sans border-b border-neutral-800 pb-1">
                <span>{expression}</span>
                <button onClick={onClose} className="hover:text-neutral-300">✕</button>
            </div>
            <div className="py-1">
                {loading ? (
                    <span className="text-neutral-500 italic">Değerlendiriliyor...</span>
                ) : (
                    <span className="text-blue-400 font-semibold">{value}</span>
                )}
            </div>
        </div>
    );
}
