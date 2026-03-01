interface AdvancedFilterModalProps {
    showFilterModal: boolean;
    setShowFilterModal: (show: boolean) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    sortBy: string;
    setSortBy: (sort: 'name' | 'size' | 'recent' | 'usage') => void;
}

export default function AdvancedFilterModal({
    showFilterModal,
    setShowFilterModal,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy
}: AdvancedFilterModalProps) {
    if (!showFilterModal) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowFilterModal(false)}>
            <div className="bg-gray-800 rounded-lg p-4 max-w-2xl w-full m-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white">🔍 Gelişmiş Filtreler ve Arama</h3>
                    <button onClick={() => setShowFilterModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>

                {/* İsme Göre Arama */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-white mb-2">🔤 İsme Göre Ara</label>
                    <input
                        type="text"
                        placeholder="Model adı veya açıklama..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                        autoFocus
                    />
                </div>

                {/* Özellik Filtreleri */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                    {/* Sıralama */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5"> Sıralama</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="w-full px-2 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] focus:border-blue-500 focus:outline-none"
                        >
                            <option value="name">İsim</option>
                            <option value="size">Boyut</option>
                            <option value="recent">Son Kullanım</option>
                            <option value="usage">Kullanım Sayısı</option>
                        </select>
                    </div>
                </div>

                {/* Sonuç Sayısı */}
                <div className="mb-4 p-2 bg-green-900/20 border border-green-500/30 rounded">
                    <p className="text-sm text-green-300">
                        Tüm GGUF modelleri gösteriliyor - boyut kısıtlaması yok
                    </p>
                </div>

                {/* Butonlar */}
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setSearchQuery('');
                            setSortBy('name');
                        }}
                        className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
                    >
                        Temizle
                    </button>
                    <button
                        onClick={() => setShowFilterModal(false)}
                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white"
                    >
                        ✓ Uygula
                    </button>
                </div>
            </div>
        </div>
    );
}
