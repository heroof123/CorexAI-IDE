import React, { useState, useEffect } from 'react';
import { mergeConflictResolver } from '../services/mergeConflictResolver';
import { Bot, Check, FileCode2, X } from 'lucide-react';

interface MergeEditorProps {
    filePath: string;
    initialContent: string;
    onResolve: (resolvedContent: string) => void;
    onCancel: () => void;
}

export const MergeEditor: React.FC<MergeEditorProps> = ({ filePath, initialContent, onResolve, onCancel }) => {
    const [loading, setLoading] = useState(true);
    const [resolvedText, setResolvedText] = useState<string>('');
    const [conflictsCount, setConflictsCount] = useState(0);

    useEffect(() => {
        executeAutonomousResolution();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialContent]);

    const executeAutonomousResolution = async () => {
        setLoading(true);
        try {
            // 1. Çakışmaları bul
            const conflicts = mergeConflictResolver.parseConflicts(initialContent);
            setConflictsCount(conflicts.length);

            if (conflicts.length === 0) {
                setResolvedText(initialContent);
                setLoading(false);
                return;
            }

            // 2. Otonom olarak hepsini çöz
            const result = await mergeConflictResolver.resolveAutonomously(filePath, initialContent, conflicts);

            setResolvedText(result.resolvedContent);
        } catch (err) {
            console.error(err);
            alert('Otomatik Çözümleme başarısız oldu. Dosya bozuk veya çok karmaşık olabilir.');
            setResolvedText(initialContent); // Fallback
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-gray-300 relative z-50 animate-in fade-in duration-300">
            <div className="h-12 bg-[#252526] border-b border-[#333] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center">
                        <Bot size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                            Otonom Merge Çözümleyici (Modül 4.4)
                        </h3>
                        <p className="text-[10px] text-gray-500 truncate max-w-xs">{filePath}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {!loading && (
                        <button
                            onClick={() => onResolve(resolvedText)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium text-white flex items-center gap-1.5 transition-colors"
                        >
                            <Check size={14} />
                            AI Çözümünü Onayla
                        </button>
                    )}
                    <button
                        onClick={onCancel}
                        className="p-1.5 hover:bg-[#333] text-gray-400 hover:text-white rounded transition-colors"
                        title="Kapat"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col items-center justify-center relative bg-[#1e1e1e]">
                {loading ? (
                    <div className="text-center space-y-4">
                        <div className="relative w-16 h-16 mx-auto">
                            <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin"></div>
                            <div className="absolute inset-2 rounded-full border-t-2 border-purple-500 animate-spin-reverse"></div>
                            <Bot size={24} className="absolute inset-0 m-auto text-blue-400 animate-pulse" />
                        </div>

                        <div className="space-y-1">
                            <h4 className="text-sm font-medium text-gray-200">✨ AI Çakışmaları Çözümlüyor</h4>
                            <p className="text-xs text-gray-500">
                                {conflictsCount > 0 ? `${conflictsCount} adet Git Confilct bulundu.` : `Dosya taranıyor...`} Lütfen bekleyin.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full flex p-4 gap-4">
                        {/* Öncesi & Sonrası Gösterim Paneli */}
                        <div className="flex-1 flex flex-col bg-[#252526] rounded-md border border-[#333] overflow-hidden">
                            <div className="h-8 bg-[#2d2d2d] border-b border-[#333] flex items-center px-4 shrink-0 justify-between">
                                <div className="flex items-center gap-2 text-xs font-medium text-red-400">
                                    <FileCode2 size={14} />
                                    Örijinal (Çakışmalı Durum)
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-4 font-mono text-xs">
                                <pre className="text-gray-400 opacity-80 select-all">{initialContent}</pre>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col bg-[#252526] rounded-md border border-blue-500/30 overflow-hidden shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                            <div className="h-8 bg-[#2d2d2d] border-b border-[#333] flex items-center px-4 shrink-0 justify-between">
                                <div className="flex items-center gap-2 text-xs font-medium text-green-400">
                                    <Bot size={14} />
                                    AI Tarafından Çözümlenmiş Sonuç
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-4 font-mono text-xs">
                                <pre className="text-gray-200 select-all">{resolvedText}</pre>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
