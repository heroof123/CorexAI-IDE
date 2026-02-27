import React from 'react';
import { motion } from 'framer-motion';

export interface DebuggerAlertProps {
    error: string;
    file?: string;
    line?: number;
    onFix?: () => void;
    onIgnore: () => void;
}

const DebuggerAlert: React.FC<DebuggerAlertProps> = ({ error, file, line, onFix, onIgnore }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 right-6 z-[60] max-w-md w-full"
        >
            <div className="bg-[#1e1e1e] border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl bg-opacity-90">
                <div className="bg-red-500/10 p-4 border-b border-red-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                            <span className="text-xl">⚠️</span>
                        </div>
                        <div>
                            <h3 className="text-red-400 font-bold text-sm">Hata Tespit Edildi</h3>
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Proactive Debugger</p>
                        </div>
                    </div>
                    <button
                        onClick={onIgnore}
                        className="p-1 hover:bg-neutral-800 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-4">
                    <div className="bg-neutral-900/50 rounded-lg p-3 mb-4 font-mono text-xs text-red-300 border border-red-500/10 max-h-32 overflow-auto">
                        {error}
                    </div>

                    {(file || line) && (
                        <div className="flex items-center gap-2 mb-4 text-[11px] text-neutral-400">
                            <span className="bg-neutral-800 px-2 py-0.5 rounded text-neutral-300">
                                {file} {line ? `:${line}` : ''}
                            </span>
                        </div>
                    )}

                    <div className="flex gap-3">
                        {onFix && (
                            <button
                                onClick={onFix}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span>✨</span>
                                AI ile Düzelt
                            </button>
                        )}
                        <button
                            onClick={onIgnore}
                            className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                        >
                            Yoksay
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default DebuggerAlert;
