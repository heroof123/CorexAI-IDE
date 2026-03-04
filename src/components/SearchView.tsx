import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { searchService, SearchMatch } from '../services/searchService';
import { aiSearchService, AISearchResult } from '../services/aiSearchService';
import { replaceService } from '../services/replaceService';
import { FileIndex } from '../types/index';

interface SearchViewProps {
    files: string[];
    fileIndex: FileIndex[];
    onFileSelect: (filePath: string, lineNumber?: number) => void;
}

export default function SearchView({ files: _files, fileIndex, onFileSelect }: SearchViewProps) {
    const { t } = useLanguage();

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');
    const [includes, setIncludes] = useState('');
    const [excludes, setExcludes] = useState('');
    const [isRegex, setIsRegex] = useState(false);
    const [matchCase, setMatchCase] = useState(false);
    const [wholeWord, setWholeWord] = useState(false);

    // Mode Selection
    const [searchMode, setSearchMode] = useState<'text' | 'semantic'>('text');

    // Results State
    const [textResults, setTextResults] = useState<SearchMatch[]>([]);
    const [aiResults, setAiResults] = useState<AISearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Replace Mode
    const [showReplace, setShowReplace] = useState(false);

    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            setTextResults([]);
            setAiResults([]);
            return;
        }

        setIsSearching(true);

        if (searchMode === 'text') {
            const results = await searchService.searchFiles({
                query: searchTerm,
                isRegex,
                matchCase,
                matchWholeWord: wholeWord,
                includes,
                excludes
            }, fileIndex);
            setTextResults(results);
        } else {
            const results = await aiSearchService.semanticSearch(searchTerm, 10);
            setAiResults(results);
        }

        setIsSearching(false);
    };

    const handleReplaceAll = async () => {
        if (searchMode !== 'text' || textResults.length === 0) return;

        const confirmMessage = `${textResults.length} adet sonucu "${replaceTerm}" ile değiştirmek istediğinize emin misiniz?`;
        if (!window.confirm(confirmMessage)) return;

        const ops = textResults.map(r => ({
            file: r.file,
            line: r.line,
            matchStart: r.matchStart,
            matchEnd: r.matchEnd,
            replacement: replaceTerm
        }));

        const result = await replaceService.replaceAll(ops);

        if (result.success) {
            alert(`✅ ${result.count} değişiklik başarıyla uygulandı.`);
            handleSearch(); // Yenile
        } else {
            alert(`❌ Değiştirme sırasında hata: ${result.failedFiles.length} dosya güncellenemedi.`);
        }
    };

    // Ağaç yapısı için gruplama
    const groupedTextResults = textResults.reduce((acc, match) => {
        if (!acc[match.file]) acc[match.file] = [];
        acc[match.file].push(match);
        return acc;
    }, {} as Record<string, SearchMatch[]>);

    return (
        <div className="h-full flex flex-col bg-[var(--color-background)]">
            {/* Header */}
            <div className="px-3 py-2 border-b border-[var(--color-border)]">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-semibold text-[var(--color-text)]">
                        {t("search.title") || "Gelişmiş Arama"}
                    </h2>
                    <div className="flex gap-1 bg-[#1e1e1e] p-1 rounded border border-[#333]">
                        <button
                            onClick={() => setSearchMode('text')}
                            className={`px-2 py-0.5 text-xs rounded transition-colors ${searchMode === 'text' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500'}`}
                        >
                            RegEx
                        </button>
                        <button
                            onClick={() => setSearchMode('semantic')}
                            className={`px-2 py-0.5 text-xs rounded transition-colors ${searchMode === 'semantic' ? 'bg-purple-600/20 text-purple-400' : 'text-gray-500'}`}
                            title="AI Semantik Kod Arama"
                        >
                            ✨ AI
                        </button>
                    </div>
                </div>

                {/* Inputs */}
                <div className="space-y-1.5">
                    <div className="flex gap-1">
                        <input
                            type="text"
                            placeholder={searchMode === 'text' ? "Metin veya Regex Ara..." : "Ne arıyorsunuz? (Örn: Veritabanına bağlanan fonksiyonlar)"}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="flex-1 px-3 py-1.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)]"
                        />
                    </div>

                    {searchMode === 'text' && showReplace && (
                        <div className="flex gap-1">
                            <input
                                type="text"
                                placeholder="Şununla değiştir..."
                                value={replaceTerm}
                                onChange={e => setReplaceTerm(e.target.value)}
                                className="flex-1 px-3 py-1.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:border-[var(--color-primary)]"
                            />
                            <button
                                onClick={handleReplaceAll}
                                className="px-2 bg-yellow-600/20 text-yellow-500 border border-yellow-600/50 rounded hover:bg-yellow-600/30 text-xs"
                                title="Hepsini Değiştir"
                            >
                                Tüm. Değiştir
                            </button>
                        </div>
                    )}

                    {searchMode === 'text' && (
                        <>
                            <div className="flex gap-1">
                                <input
                                    type="text"
                                    placeholder="Dahil et (*.ts)"
                                    value={includes}
                                    onChange={e => setIncludes(e.target.value)}
                                    className="flex-1 px-3 py-1 inline border border-[var(--color-border)] rounded text-[11px] bg-transparent"
                                />
                                <input
                                    type="text"
                                    placeholder="Hariç tut (node_modules)"
                                    value={excludes}
                                    onChange={e => setExcludes(e.target.value)}
                                    className="flex-1 px-3 py-1 inline border border-[var(--color-border)] rounded text-[11px] bg-transparent"
                                />
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                                <label className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <input type="checkbox" checked={matchCase} onChange={e => setMatchCase(e.target.checked)} />
                                    Aa
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <input type="checkbox" checked={wholeWord} onChange={e => setWholeWord(e.target.checked)} />
                                    Ab
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <input type="checkbox" checked={isRegex} onChange={e => setIsRegex(e.target.checked)} />
                                    .*
                                </label>
                                <button
                                    onClick={() => setShowReplace(!showReplace)}
                                    className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${showReplace ? 'border-blue-500 text-blue-400' : 'border-neutral-600 text-neutral-400'}`}
                                >
                                    Değiştir
                                </button>
                            </div>
                        </>
                    )}

                    <button
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded py-1.5 text-xs transition-colors disabled:opacity-50"
                    >
                        {isSearching ? "Aranıyor..." : "Ara"}
                    </button>
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-1 py-2 text-sm">
                {isSearching ? (
                    <div className="text-center py-8 text-[var(--color-textSecondary)]">
                        <div className="animate-spin text-2xl mb-2">⚙️</div>
                        <p>Aranıyor...</p>
                    </div>
                ) : searchMode === 'text' && textResults.length > 0 ? (
                    <div className="space-y-1">
                        <div className="px-2 text-xs text-[var(--color-textSecondary)] mb-2">
                            {textResults.length} eşleşme ({Object.keys(groupedTextResults).length} dosya)
                        </div>

                        {/* Ağaç Görünümü (Tree View) */}
                        {Object.entries(groupedTextResults).map(([file, matches]) => (
                            <div key={file} className="mb-2">
                                <button
                                    onClick={() => onFileSelect(file)}
                                    className="flex items-center gap-1.5 px-2 py-1 w-full text-left font-medium text-[var(--color-text)] hover:bg-[var(--color-hover)] rounded transition-colors"
                                >
                                    <span className="text-sm">📄</span>
                                    <span className="truncate">{file.split(/[/\\]/).pop()}</span>
                                    <span className="text-[10px] bg-neutral-700/50 px-1.5 rounded-full text-neutral-400 ml-auto flex-shrink-0">
                                        {matches.length}
                                    </span>
                                </button>

                                {/* Hiyerarşik Satırlar */}
                                <div className="ml-5 flex flex-col gap-[1px]">
                                    {matches.map((match, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => onFileSelect(match.file, match.line)}
                                            className="flex items-start gap-2 px-1 py-1 hover:bg-[var(--color-hover)] rounded text-left"
                                        >
                                            <span className="text-[10px] text-blue-400 mt-[2px] w-6 shrink-0">{match.line}</span>
                                            <span className="font-mono text-xs text-neutral-300 truncate" title={match.text.trim()}>
                                                {match.text.substring(0, match.matchStart).trimStart()}
                                                <span className="bg-yellow-500/30 text-yellow-200 px-[2px] rounded">
                                                    {match.text.substring(match.matchStart, match.matchEnd)}
                                                </span>
                                                {match.text.substring(match.matchEnd)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : searchMode === 'semantic' && aiResults.length > 0 ? (
                    <div className="space-y-3 px-2">
                        <div className="text-xs text-purple-400 mb-2 font-medium">✨ AI, {aiResults.length} adet kod bağlamı buldu.</div>

                        {aiResults.map((res, i) => (
                            <div key={i} className="bg-neutral-800/40 border border-neutral-700/50 rounded-md p-2 hover:border-purple-500/30 transition-colors">
                                <button
                                    onClick={() => onFileSelect(res.file)}
                                    className="flex justify-between items-center w-full mb-1 group"
                                >
                                    <span className="text-[11px] font-mono text-neutral-300 group-hover:text-blue-400 break-all text-left">
                                        📄 {res.file.split(/[/\\]/).pop()}
                                    </span>
                                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                                        Skor: %{res.relevanceScore}
                                    </span>
                                </button>
                                <p className="text-[11px] text-neutral-400 leading-snug line-clamp-3 mb-2">{res.explanation}</p>
                                {res.snippet && (
                                    <div className="bg-black/30 rounded p-1.5 border border-black/20">
                                        <pre className="text-[9px] font-mono text-neutral-300 whitespace-pre-wrap line-clamp-4">
                                            {res.snippet}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : searchTerm ? (
                    <div className="text-center py-8 text-[var(--color-textSecondary)]">
                        <div className="text-2xl mb-2">🔍</div>
                        <p>Sonuç bulunamadı</p>
                    </div>
                ) : (
                    <div className="text-center py-8 text-[var(--color-textSecondary)]">
                        <div className="text-2xl mb-2">🔍</div>
                        <p className="text-xs px-4">
                            {searchMode === 'text'
                                ? "Çalışma alanında metin veya regex arayın."
                                : "Yapay zekaya kodlama mantığıyla ilgili bir soru sorun."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
