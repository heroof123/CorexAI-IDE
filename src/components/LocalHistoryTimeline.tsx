import React, { useState, useEffect } from 'react';
import { localHistoryService, HistoryEntry } from '../services/localHistoryService';
import { Clock, RotateCcw, X, FileClock, RefreshCw } from 'lucide-react';

interface LocalHistoryTimelineProps {
    filePath: string;
    onClose: () => void;
    onRestore: (content: string) => void;
}

export const LocalHistoryTimeline: React.FC<LocalHistoryTimelineProps> = ({ filePath, onClose, onRestore }) => {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadHistory = async () => {
            setLoading(true);
            try {
                const entries = await localHistoryService.getHistory(filePath);
                setHistory(entries);
            } catch (err) {
                console.error("Failed to load history", err);
            } finally {
                setLoading(false);
            }
        };

        if (filePath) {
            loadHistory();
        }
    }, [filePath]);

    const handleRestore = async (entryId: string) => {
        if (!confirm('Bu snapshot geri yüklensin mi? Mevcut içerik bu versiyonla değişecek.')) return;

        try {
            const restoredContent = await localHistoryService.restoreSnapshot(filePath, entryId);
            onRestore(restoredContent);
            onClose();
        } catch (err) {
            console.error(err);
            alert("Geri yükleme başarısız.");
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-[#333] text-gray-300 w-80 shadow-2xl z-50 absolute right-0 top-0 bottom-0 select-none">
            <div className="p-4 flex items-center justify-between border-b border-[#333] bg-[#252526]">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                    <FileClock size={16} className="text-blue-400" />
                    Zaman Çizelgesi
                </div>
                <button title="Kapat" onClick={onClose} className="p-1 hover:bg-[#333] rounded transition-colors text-gray-400 hover:text-white">
                    <X size={16} />
                </button>
            </div>

            <div className="p-3 bg-[#1e1e1e] border-b border-[#333] text-xs font-mono text-gray-400 truncate">
                {filePath.split(/[\\/]/).pop()}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center flex-col items-center gap-2 mt-10">
                        <div className="animate-spin text-blue-500">
                            <RefreshCw size={24} />
                        </div>
                        <p className="text-xs text-gray-400">Geçmiş yükleniyor...</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm mt-10">
                        Bu dosya için henüz snapshot yok. (Kaydettikçe burada birikir)
                    </div>
                ) : (
                    <div className="relative border-l border-[#444] ml-3 pl-4 space-y-6">
                        {history.map((entry, index) => {
                            const date = new Date(entry.timestamp);
                            const isLatest = index === 0;

                            return (
                                <div key={entry.id} className="relative group">
                                    <div className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-[#1e1e1e] ${isLatest ? 'bg-blue-500 ring-2 ring-blue-500/30' : 'bg-[#555] group-hover:bg-blue-400'}`}></div>

                                    <div className="bg-[#2d2d2d] hover:bg-[#363636] border border-[#444] rounded-md p-3 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium">
                                                <Clock size={12} className="text-gray-400" />
                                                {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </div>
                                            <div className="text-[10px] text-gray-500">
                                                {date.toLocaleDateString()}
                                            </div>
                                        </div>

                                        <div className="text-xs text-gray-400 mb-3 truncate">
                                            Boyut: {(entry.content.length / 1024).toFixed(1)} KB
                                        </div>

                                        <button
                                            onClick={() => handleRestore(entry.id)}
                                            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 bg-[#3a3d41] hover:bg-blue-600 hover:text-white text-gray-300 text-xs rounded border border-[#555] hover:border-blue-500 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <RotateCcw size={12} />
                                            Restore Et
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
