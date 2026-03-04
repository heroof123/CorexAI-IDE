import React, { useState, useEffect } from 'react';
import { markersService, MarkerInfo, MarkerSeverity } from '../services/markersService';
import { aiDebugService } from '../services/aiDebugService';
import { FileCode2, AlertCircle, AlertTriangle, Info, Lightbulb, Search, Filter } from 'lucide-react';

interface MarkersViewProps {
    onFileSelect: (file: string, line: number) => void;
    // Panel kapanma vs
}

export default function MarkersView({ onFileSelect }: MarkersViewProps) {
    const [markers, setMarkers] = useState<MarkerInfo[]>([]);
    const [filterText, setFilterText] = useState('');
    const [showFilters, setShowFilters] = useState({
        error: true,
        warning: true,
        info: true,
        hint: true,
    });

    useEffect(() => {
        // Initial fetch
        setMarkers(markersService.getAllMarkers());

        const unsubscribe = markersService.onDidChangeMarkers(() => {
            setMarkers(markersService.getAllMarkers());
        });

        return unsubscribe;
    }, []);

    // Gruplama
    const fileGroups = new Map<string, MarkerInfo[]>();
    for (const m of markers) {
        if (!fileGroups.has(m.file)) {
            fileGroups.set(m.file, []);
        }
        fileGroups.get(m.file)!.push(m);
    }

    // Filtreme
    const filteredGroups: Record<string, MarkerInfo[]> = {};
    let totalVisible = 0;

    for (const [file, items] of fileGroups) {
        const validItems = items.filter(m => {
            // Metin arama (dosya adı veya mesaj icinde)
            if (filterText && !m.message.toLowerCase().includes(filterText.toLowerCase()) && !file.toLowerCase().includes(filterText.toLowerCase())) {
                return false;
            }

            // Checkbox
            if (!showFilters[m.severity]) return false;

            return true;
        });

        if (validItems.length > 0) {
            filteredGroups[file] = validItems;
            totalVisible += validItems.length;
        }
    }

    const getIconForSeverity = (s: MarkerSeverity) => {
        switch (s) {
            case 'error': return <AlertCircle size={14} className="text-red-500" />;
            case 'warning': return <AlertTriangle size={14} className="text-yellow-500" />;
            case 'info': return <Info size={14} className="text-blue-500" />;
            case 'hint': return <Lightbulb size={14} className="text-gray-400" />;
            default: return null;
        }
    };

    const getStyleForSeverity = (s: MarkerSeverity) => {
        switch (s) {
            case 'error': return 'text-red-400 font-medium';
            case 'warning': return 'text-yellow-400 font-medium';
            case 'info': return 'text-blue-400';
            case 'hint': return 'text-gray-400';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="h-full flex flex-col bg-[var(--color-surface)]">
            {/* ── Toolbar ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between p-2 border-b border-[var(--color-border)] bg-[var(--color-background)] shrink-0">
                <div className="flex items-center gap-2 flex-1">
                    <div className="relative w-64">
                        <Search size={14} className="absolute left-2.5 top-2 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Sorunlarda Ara..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded pl-8 pr-2 py-1 text-xs text-white focus:outline-none focus:border-[var(--neon-blue)]"
                        />
                    </div>

                    {/* Quick Filters */}
                    <div className="flex items-center gap-2 ml-4">
                        <Filter size={14} className="text-gray-400" />
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                            <input type="checkbox" checked={showFilters.error} onChange={e => setShowFilters({ ...showFilters, error: e.target.checked })} />
                            <AlertCircle size={12} className="text-red-500" /> Hatalar
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                            <input type="checkbox" checked={showFilters.warning} onChange={e => setShowFilters({ ...showFilters, warning: e.target.checked })} />
                            <AlertTriangle size={12} className="text-yellow-500" /> Uyarılar
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                            <input type="checkbox" checked={showFilters.info} onChange={e => setShowFilters({ ...showFilters, info: e.target.checked })} />
                            <Info size={12} className="text-blue-500" /> Bilgiler
                        </label>
                    </div>
                </div>

                <div className="text-xs text-gray-500 mr-2">
                    Toplam {totalVisible} sorun gizleniyor
                </div>
            </div>

            {/* ── List ─────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto bg-[var(--color-background)]">
                {totalVisible === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                        <FileCode2 size={48} className="mb-4 opacity-20" />
                        <p className="text-sm">Çalışma alanında yapılandırılmış sorun bulunamadı.</p>
                        <p className="text-xs mt-1">Sistem ve kod pürüzsüz çalışıyor! 🚀</p>
                    </div>
                ) : (
                    <div className="p-2 space-y-2">
                        {Object.entries(filteredGroups).map(([fileName, items]) => (
                            <div key={fileName} className="mb-4">
                                <div className="flex items-center gap-2 px-2 py-1.5 bg-[#1e1e1e] rounded-t border-b border-[#333]">
                                    <FileCode2 size={14} className="text-blue-400" />
                                    <span className="text-xs font-semibold text-gray-200">
                                        {fileName.split(/[/\\]/).pop()}
                                    </span>
                                    <span className="text-[10px] text-gray-500 truncate mr-auto ml-2">
                                        {fileName}
                                    </span>
                                    <span className="text-[10px] bg-[#333] px-2 py-0.5 rounded text-gray-400">
                                        {items.length} sorun
                                    </span>
                                </div>

                                <div className="border border-[#222] border-t-0 bg-[#161616] rounded-b flex flex-col">
                                    {items.map((m, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => onFileSelect(m.file, m.line)}
                                            className="flex items-start gap-3 px-3 py-2 border-b border-[#222] last:border-b-0 hover:bg-[#1a1a1a] cursor-pointer group"
                                        >
                                            <div className="mt-[2px] shrink-0">
                                                {getIconForSeverity(m.severity)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex gap-2">
                                                    <span className={`text-[11px] truncate ${getStyleForSeverity(m.severity)}`}>
                                                        {m.message}
                                                    </span>
                                                    <span className="text-[10px] text-gray-600 ml-auto whitespace-nowrap">
                                                        [{m.source}]
                                                    </span>
                                                </div>
                                                <div className="text-[10px] font-mono text-gray-500 mt-0.5 flex items-center justify-between">
                                                    <span>Satır: {m.line} {m.column ? `, Sütun: ${m.column}` : ''}</span>

                                                    {m.severity === 'error' && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                aiDebugService.triggerMockBreakpoint(m.file, m.line);
                                                            }}
                                                            className="hidden group-hover:flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded hover:bg-indigo-500/30 transition-colors"
                                                        >
                                                            <span className="text-[8px] uppercase tracking-wider font-bold">AI ile Çöz</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
