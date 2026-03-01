import { GGUFModel } from './types';
import { showToast } from '../ToastContainer';

interface CleanupSuggestion {
    priority: string;
    title: string;
    reason: string;
    savings: number;
    models: GGUFModel[];
}

interface CleanupModalProps {
    showCleanupModal: boolean;
    setShowCleanupModal: (show: boolean) => void;
    models: GGUFModel[];
    getTotalDiskUsage: () => number;
    getCleanupSuggestions: () => CleanupSuggestion[];
    selectedForCleanup: string[];
    setSelectedForCleanup: (selected: string[]) => void;
    cleanupSelectedModels: () => void;
}

export default function CleanupModal({
    showCleanupModal,
    setShowCleanupModal,
    models,
    getTotalDiskUsage,
    getCleanupSuggestions,
    selectedForCleanup,
    setSelectedForCleanup,
    cleanupSelectedModels
}: CleanupModalProps) {
    if (!showCleanupModal) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCleanupModal(false)}>
            <div className="bg-gray-800 rounded-lg p-3 max-w-2xl w-full max-h-[80vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-white">🧹 Model Temizlik ve Disk Yönetimi</h3>
                    <button onClick={() => setShowCleanupModal(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
                </div>

                {/* Disk Kullanımı */}
                <div className="mb-2 p-2 bg-gray-900 rounded border border-gray-700">
                    <h4 className="text-xs font-semibold text-white mb-1.5">💾 Disk Kullanımı</h4>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Toplam Model:</span>
                            <span className="text-white font-semibold">{models.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">İndirilmiş:</span>
                            <span className="text-white font-semibold">{models.filter(m => m.isDownloaded).length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Disk Kullanımı:</span>
                            <span className="text-white font-semibold">{(getTotalDiskUsage() / (1024 ** 3)).toFixed(2)} GB</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Favoriler:</span>
                            <span className="text-yellow-400 font-semibold">{models.filter(m => m.isFavorite).length} (korunur)</span>
                        </div>
                    </div>
                </div>

                {/* Temizlik Önerileri */}
                <div className="mb-2">
                    <h4 className="text-xs font-semibold text-white mb-1.5">⚠️ Temizlik Önerileri</h4>

                    {(() => {
                        const suggestions = getCleanupSuggestions();

                        if (suggestions.length === 0) {
                            return (
                                <div className="p-3 bg-green-900/20 border border-green-500/30 rounded text-center">
                                    <p className="text-green-400 text-xs">✅ Tüm modeller aktif kullanımda!</p>
                                    <p className="text-gray-400 text-xs mt-0.5">Temizlenecek model bulunamadı.</p>
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-1.5">
                                {suggestions.map((suggestion, index) => (
                                    <div key={index} className={`p-1.5 rounded border ${suggestion.priority === 'high' ? 'bg-red-900/20 border-red-500/30' :
                                        suggestion.priority === 'medium' ? 'bg-orange-900/20 border-orange-500/30' :
                                            'bg-yellow-900/20 border-yellow-500/30'
                                        }`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div>
                                                <h5 className={`text-xs font-semibold ${suggestion.priority === 'high' ? 'text-red-400' :
                                                    suggestion.priority === 'medium' ? 'text-orange-400' :
                                                        'text-yellow-400'
                                                    }`}>
                                                    {suggestion.title} ({suggestion.models.length})
                                                </h5>
                                                <p className="text-xs text-gray-400">{suggestion.reason}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-semibold text-white">
                                                    {(suggestion.savings / (1024 ** 3)).toFixed(2)} GB
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-0.5 max-h-24 overflow-y-auto">
                                            {suggestion.models.map(model => (
                                                <div key={model.id} className="flex items-center gap-1.5 p-1 bg-gray-900/50 rounded">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedForCleanup.includes(model.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedForCleanup([...selectedForCleanup, model.id]);
                                                            } else {
                                                                setSelectedForCleanup(selectedForCleanup.filter(id => id !== model.id));
                                                            }
                                                        }}
                                                        className="w-3 h-3 flex-shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs text-white truncate">{model.displayName}</p>
                                                        <div className="flex gap-1 text-xs text-gray-400">
                                                            <span>{model.size}</span>
                                                            <span>•</span>
                                                            <span className="truncate">{model.lastUsed ? `${Math.floor((Date.now() - model.lastUsed) / (24 * 60 * 60 * 1000))}g` : 'Hiç'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => {
                                                const modelIds = suggestion.models.map(m => m.id);
                                                setSelectedForCleanup([...new Set([...selectedForCleanup, ...modelIds])]);
                                            }}
                                            className="mt-1 w-full px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white"
                                        >
                                            ✓ Tümünü Seç
                                        </button>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>

                {/* Alt Butonlar */}
                <div className="flex gap-1.5">
                    <button
                        onClick={() => {
                            setSelectedForCleanup([]);
                            showToast('Seçim temizlendi', 'info');
                        }}
                        className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white"
                    >
                        🔄 Temizle
                    </button>
                    <button
                        onClick={cleanupSelectedModels}
                        disabled={selectedForCleanup.length === 0}
                        className={`flex-1 px-2 py-1 rounded text-xs text-white font-semibold ${selectedForCleanup.length > 0
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-gray-600 cursor-not-allowed'
                            }`}
                    >
                        🗑️ Sil ({selectedForCleanup.length})
                    </button>
                </div>

                {/* Uyarı */}
                {selectedForCleanup.length > 0 && (
                    <div className="mt-1.5 p-1.5 bg-red-900/20 border border-red-500/30 rounded">
                        <p className="text-xs text-red-300">
                            ⚠️ {selectedForCleanup.length} model silinecek!
                        </p>
                        <p className="text-xs text-gray-400">
                            Alan: {(
                                models
                                    .filter(m => selectedForCleanup.includes(m.id))
                                    .reduce((sum, m) => sum + m.sizeBytes, 0) / (1024 ** 3)
                            ).toFixed(2)} GB
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
