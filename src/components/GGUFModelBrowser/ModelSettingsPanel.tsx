import { GGUFModel } from './types';
import { showToast } from '../ToastContainer';

interface ModelSettingsPanelProps {
    selectedModelForConfig: GGUFModel;
    setSelectedModelForConfig: (model: GGUFModel | null) => void;
    modelMetadata: any;
    setModelMetadata: (meta: any) => void;
    activeTab: 'basic' | 'advanced' | 'logs' | 'history';
    setActiveTab: (tab: 'basic' | 'advanced' | 'logs' | 'history') => void;
    gpuMemory: any;
    contextLength: number;
    setContextLength: (len: number) => void;
    outputMode: string;
    setOutputMode: (mode: 'brief' | 'normal' | 'detailed') => void;
    gpuLayers: number;
    setGpuLayers: (layers: number) => void;
    maxGpuLayers: number;
    temperature: number;
    setTemperature: (temp: number) => void;
    topP: number;
    setTopP: (p: number) => void;
    topK: number;
    setTopK: (k: number) => void;
    repeatPenalty: number;
    setRepeatPenalty: (penalty: number) => void;
    minP: number;
    setMinP: (p: number) => void;
    applyModelConfig: () => void;
    isLoadingToGPU: boolean;
    activeGpuModel: string | null;
    unloadFromGPU: () => void;
    performanceLogs: any[];
    setPerformanceLogs: (logs: any[]) => void;
    conversationHistory: any[];
    setConversationHistory: (history: any[]) => void;
    gpuBackendInfo?: any;
    gpuInfo?: any;
    backendRecommendation?: any;
    calculateRequirements: (model: GGUFModel, context: number) => any;
    loadingProgress: number;
    openUrl: (url: string) => Promise<void>;
}

export default function ModelSettingsPanel({
    selectedModelForConfig,
    setSelectedModelForConfig,
    modelMetadata,
    setModelMetadata,
    activeTab,
    setActiveTab,
    gpuMemory,
    contextLength,
    setContextLength,
    outputMode,
    setOutputMode,
    gpuLayers,
    setGpuLayers,
    maxGpuLayers,
    temperature,
    setTemperature,
    topP,
    setTopP,
    topK,
    setTopK,
    repeatPenalty,
    setRepeatPenalty,
    minP,
    setMinP,
    applyModelConfig,
    isLoadingToGPU,
    activeGpuModel,
    unloadFromGPU,
    performanceLogs,
    setPerformanceLogs,
    conversationHistory,
    setConversationHistory,
    gpuBackendInfo,
    gpuInfo,
    backendRecommendation,
    calculateRequirements,
    loadingProgress,
    openUrl
}: ModelSettingsPanelProps) {
    return (
        <div className="w-1/3 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)] p-2.5 flex flex-col max-h-[calc(100vh-200px)]">
            <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-semibold text-[var(--color-text)]">⚙️ Model Ayarları</h3>
                <button onClick={() => setSelectedModelForConfig(null)} className="text-gray-400 hover:text-[var(--color-text)] text-sm">✕</button>
            </div>

            <div className="mb-1.5">
                <h4 className="text-xs font-medium text-[var(--color-text)] truncate">{selectedModelForConfig.displayName}</h4>
                <p className="text-xs text-gray-400 truncate">{selectedModelForConfig.description}</p>
            </div>

            {/* 📊 Metadata Gösterimi - AI kaydedilince otomatik gösterilir */}
            {modelMetadata && Object.keys(modelMetadata).length > 0 && (
                <div className="mb-1.5 p-1.5 bg-green-900/20 border border-green-500/30 rounded">
                    <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-semibold text-green-400">📊 Model Metadata</span>
                        <button
                            onClick={() => setModelMetadata(null)}
                            className="text-gray-400 hover:text-[var(--color-text)] text-xs"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="max-h-24 overflow-y-auto space-y-0.5 text-xs">
                        {Object.entries(modelMetadata).slice(0, 8).map(([key, value]) => (
                            <div key={key} className="flex justify-between gap-2">
                                <span className="text-gray-400 truncate text-xs">{key}:</span>
                                <span className="text-[var(--color-text)] font-mono text-xs break-all text-right">
                                    {typeof value === 'object' ? JSON.stringify(value).slice(0, 25) + '...' : String(value).slice(0, 25)}
                                </span>
                            </div>
                        ))}
                        {Object.keys(modelMetadata).length > 8 && (
                            <div className="text-gray-500 text-xs text-center pt-0.5">
                                +{Object.keys(modelMetadata).length - 8} alan daha...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 🆕 Sekme Sistemi */}
            <div className="mb-1.5 flex gap-0 border-b border-gray-700">
                <button
                    onClick={() => setActiveTab('basic')}
                    className={`px-1.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'basic'
                        ? 'text-blue-400 border-b-2 border-blue-400'
                        : 'text-gray-400 hover:text-[var(--color-text)]'
                        }`}
                >
                    🎯 Temel
                </button>
                <button
                    onClick={() => setActiveTab('advanced')}
                    className={`px-1.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'advanced'
                        ? 'text-purple-400 border-b-2 border-purple-400'
                        : 'text-gray-400 hover:text-[var(--color-text)]'
                        }`}
                >
                    🔬 Gelişmiş
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-1.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'logs'
                        ? 'text-yellow-400 border-b-2 border-yellow-400'
                        : 'text-gray-400 hover:text-[var(--color-text)]'
                        }`}
                >
                    📈 Loglar
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-1.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'history'
                        ? 'text-pink-400 border-b-2 border-pink-400'
                        : 'text-gray-400 hover:text-[var(--color-text)]'
                        }`}
                >
                    💬 Geçmiş
                </button>
            </div>

            {/* GPU Memory Göstergesi - Her iki sekmede de göster */}
            {gpuMemory && gpuMemory.available && (
                <div className="mb-2 p-1.5 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-[var(--color-text)]">🎮 GPU</span>
                        <span className="text-xs text-gray-400">
                            {gpuMemory.used_vram_gb.toFixed(1)} / {gpuMemory.total_vram_gb.toFixed(1)} GB
                        </span>
                    </div>

                    <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1.5 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ${gpuMemory.usage_percent > 90 ? 'bg-red-500' :
                                gpuMemory.usage_percent > 75 ? 'bg-yellow-500' :
                                    'bg-green-500'
                                }`}
                            style={{ width: `${Math.min(gpuMemory.usage_percent, 100)}%` }}
                        />
                    </div>

                    <div className="space-y-0.5 text-xs">
                        <div className="flex justify-between text-gray-400">
                            <span>Kullanım:</span>
                            <span className="font-semibold text-[var(--color-text)]">{gpuMemory.usage_percent.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                            <span>Model:</span>
                            <span className="text-[var(--color-text)]">{gpuMemory.model_size_gb.toFixed(1)} GB</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                            <span>KV Cache:</span>
                            <span className="text-[var(--color-text)]">{gpuMemory.kv_cache_size_gb.toFixed(1)} GB</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                            <span>Boş:</span>
                            <span className="text-[var(--color-text)]">{gpuMemory.free_vram_gb.toFixed(1)} GB</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 🎯 Temel Ayarlar Sekmesi */}
            {activeTab === 'basic' && (
                <div className="space-y-2 flex-1 overflow-y-auto pr-1 pb-16">
                    <div>
                        <label className="block text-xs font-medium mb-1.5 text-[var(--color-text)]">
                            📝 Bağlam Uzunluğu
                        </label>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-gray-400">Seçili:</span>
                            <span className="text-xs font-semibold text-[var(--color-text)]">{contextLength.toLocaleString()}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                            {[
                                { value: 4096, label: '4K', desc: '⚡ Hızlı' },
                                { value: 8192, label: '8K', desc: '✅ Standart' },
                                { value: 16384, label: '16K', desc: '📚 Uzun' },
                                { value: 32768, label: '32K', desc: '🔥 Çok Uzun' },
                                { value: 65536, label: '64K', desc: '💪 Maksimum' },
                                { value: 131072, label: '128K', desc: '🚀 Ultra' }
                            ].map((preset) => (
                                <button
                                    key={preset.value}
                                    onClick={() => setContextLength(preset.value)}
                                    className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${contextLength === preset.value
                                        ? 'bg-blue-600 text-[var(--color-text)] border-2 border-blue-400'
                                        : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                                        }`}
                                >
                                    <div className="font-bold text-xs">{preset.label}</div>
                                    <div className="text-xs opacity-75 leading-tight">{preset.desc}</div>
                                </button>
                            ))}
                        </div>

                        <p className="text-xs text-gray-500 mt-1 leading-tight">
                            {contextLength < 8192 && '⚡ Hızlı başlatma'}
                            {contextLength >= 8192 && contextLength < 32768 && '✅ Dengeli performans'}
                            {contextLength >= 32768 && contextLength < 65536 && '📚 Uzun konuşmalar'}
                            {contextLength >= 65536 && '🚀 Maksimum bağlam'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5 text-[var(--color-text)]">
                            📤 Cevap Uzunluğu (Output)
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                            {[
                                { value: 'brief', label: 'Kısa', tokens: '2K', desc: '⚡ Hızlı cevap', color: 'green' },
                                { value: 'normal', label: 'Normal', tokens: '8K', desc: '✅ Dengeli', color: 'blue' },
                                { value: 'detailed', label: 'Detaylı', tokens: '16K', desc: '📚 Uzun', color: 'purple' }
                            ].map((mode) => (
                                <button
                                    key={mode.value}
                                    onClick={() => setOutputMode(mode.value as any)}
                                    className={`px-2 py-1.5 rounded text-xs font-medium transition-all flex flex-col items-center ${outputMode === mode.value
                                        ? `bg-${mode.color}-600 text-[var(--color-text)] border-2 border-${mode.color}-400`
                                        : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                                        }`}
                                >
                                    <span className="font-bold">{mode.label}</span>
                                    <span className="text-[10px] opacity-75">{mode.tokens} max</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 🆕 GPU Backend Info Panel */}
                    {gpuBackendInfo && (
                        <div className="p-3 bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
                                    ⚡ GPU Hızlandırma
                                </h4>
                                <span className={`text-xs px-2 py-0.5 rounded ${gpuBackendInfo.backend === 'CUDA' ? 'bg-green-500/20 text-green-400' :
                                    gpuBackendInfo.backend === 'Vulkan' ? 'bg-blue-500/20 text-blue-400' :
                                        'bg-gray-500/20 text-gray-400'
                                    }`}>
                                    {gpuBackendInfo.backend}
                                </span>
                            </div>

                            <div className="space-y-2 text-xs">
                                <div className="flex items-start gap-2">
                                    <span className="text-gray-400">Backend:</span>
                                    <span className="text-[var(--color-text)] flex-1">{gpuBackendInfo.message}</span>
                                </div>

                                {gpuBackendInfo.backend === 'CUDA' && (
                                    <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-lg p-4">
                                        <div className="flex items-start gap-2 mb-2">
                                            <span className="text-lg">ℹ️</span>
                                            <div className="flex-1">
                                                <p className="text-yellow-400 font-medium mb-1">CUDA Toolkit Gerekli</p>
                                                <p className="text-gray-300 text-xs leading-relaxed">
                                                    Bu uygulama NVIDIA GPU'nuzda maksimum hız için CUDA kullanır.
                                                    CUDA Toolkit yüklü değilse, GPU hızlandırması çalışmayacaktır.
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={async () => {
                                                try {
                                                    await openUrl(gpuBackendInfo.cuda_download_url);
                                                    showToast('🌐 CUDA Toolkit indirme sayfası açılıyor...', 'info');
                                                } catch (error) {
                                                    console.error('URL açma hatası:', error);
                                                    showToast('❌ Link açılamadı', 'error');
                                                }
                                            }}
                                            className="flex items-center justify-center gap-2 w-full mt-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-[var(--color-text)] rounded transition-colors cursor-pointer"
                                        >
                                            <span>📥</span>
                                            <span className="font-medium">CUDA Toolkit İndir</span>
                                            <span className="text-xs opacity-75">(~3 GB)</span>
                                        </button>

                                        <p className="text-xs text-gray-400 mt-2 text-center">
                                            Kurulumdan sonra uygulamayı yeniden başlatın
                                        </p>
                                    </div>
                                )}

                                {gpuBackendInfo.backend === 'CPU' && (
                                    <div className="mt-2 p-2 bg-gray-800/50 border border-gray-600/30 rounded">
                                        <p className="text-gray-400 text-xs">
                                            💡 GPU hızlandırması için CUDA veya Vulkan desteği gereklidir.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 🆕 Model Registry - GPU Info & Backend Recommendation */}
                    {gpuInfo && gpuInfo.available && (
                        <div className="p-2 bg-gradient-to-br from-cyan-900/30 to-teal-900/30 border border-cyan-500/30 rounded-lg">
                            <div className="flex items-center justify-between mb-1.5">
                                <h4 className="text-xs font-semibold text-cyan-400">🎮 GPU Bilgileri</h4>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${gpuInfo.vendor === 'nvidia' ? 'bg-green-500/20 text-green-400' :
                                    gpuInfo.vendor === 'amd' ? 'bg-red-500/20 text-red-400' :
                                        gpuInfo.vendor === 'intel' ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-gray-500/20 text-gray-400'
                                    }`}>
                                    {gpuInfo.vendor.toUpperCase()}
                                </span>
                            </div>

                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Model:</span>
                                    <span className="text-[var(--color-text)] font-medium truncate ml-2">{gpuInfo.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">VRAM:</span>
                                    <span className="text-[var(--color-text)] font-semibold">{gpuInfo.totalVRAM_GB.toFixed(1)} GB</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Boş VRAM:</span>
                                    <span className="text-green-400 font-semibold">{gpuInfo.freeVRAM_GB.toFixed(1)} GB</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Önerilen Backend:</span>
                                    <span className="text-cyan-400 font-semibold">{gpuInfo.recommendedBackend.toUpperCase()}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 🆕 Model Registry - Backend Recommendation for Selected Model */}
                    {backendRecommendation && (
                        <div className={`p-2 rounded-lg border ${backendRecommendation.expectedPerformance === 'excellent' ? 'bg-green-900/20 border-green-500/30' :
                            backendRecommendation.expectedPerformance === 'good' ? 'bg-blue-900/20 border-blue-500/30' :
                                backendRecommendation.expectedPerformance === 'moderate' ? 'bg-yellow-900/20 border-yellow-500/30' :
                                    'bg-red-900/20 border-red-500/30'
                            }`}>
                            <div className="flex items-center justify-between mb-1.5">
                                <h4 className="text-xs font-semibold text-[var(--color-text)]">🎯 Bu Model İçin Öneri</h4>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${backendRecommendation.expectedPerformance === 'excellent' ? 'bg-green-500/20 text-green-400' :
                                    backendRecommendation.expectedPerformance === 'good' ? 'bg-blue-500/20 text-blue-400' :
                                        backendRecommendation.expectedPerformance === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-red-500/20 text-red-400'
                                    }`}>
                                    {backendRecommendation.expectedPerformance === 'excellent' ? '⚡ Mükemmel' :
                                        backendRecommendation.expectedPerformance === 'good' ? '✅ İyi' :
                                            backendRecommendation.expectedPerformance === 'moderate' ? '⚠️ Orta' :
                                                '🐌 Yavaş'}
                                </span>
                            </div>

                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Backend:</span>
                                    <span className="text-[var(--color-text)] font-semibold">{backendRecommendation.backend.toUpperCase()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">GPU Layers:</span>
                                    <span className="text-[var(--color-text)] font-semibold">{backendRecommendation.gpuLayers}/{maxGpuLayers}</span>
                                </div>
                                <p className="text-gray-300 mt-1.5 leading-relaxed">{backendRecommendation.reason}</p>

                                {backendRecommendation.warnings.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {backendRecommendation.warnings.map((warning: string, index: number) => (
                                            <p key={index} className="text-yellow-400 text-xs leading-relaxed">
                                                {warning}
                                            </p>
                                        ))}
                                    </div>
                                )}

                                {backendRecommendation.gpuLayers > 0 && backendRecommendation.gpuLayers !== gpuLayers && (
                                    <button
                                        onClick={() => setGpuLayers(backendRecommendation.gpuLayers)}
                                        className="w-full mt-2 px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-[var(--color-text)] rounded text-xs transition-colors"
                                    >
                                        ✨ Önerilen Ayarı Uygula ({backendRecommendation.gpuLayers} layer)
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="pt-2 border-t border-gray-700">
                        <h4 className="text-xs font-medium text-[var(--color-text)] mb-2 flex items-center justify-between">
                            <span>🎮 GPU Hızlandırma</span>
                            <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">
                                Max: {maxGpuLayers}
                            </span>
                        </h4>

                        <div className="space-y-3">
                            <div>
                                <div className="flex items-center justify-between mb-1 text-xs">
                                    <span className="text-gray-400">GPU Layers:</span>
                                    <span className="font-semibold text-[var(--color-text)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">
                                        {gpuLayers === 0 ? 'Kapalı (CPU)' : gpuLayers >= maxGpuLayers ? `Tümü (${gpuLayers})` : gpuLayers}
                                    </span>
                                </div>

                                <input
                                    type="range"
                                    min="0"
                                    max={maxGpuLayers}
                                    value={gpuLayers}
                                    onChange={(e) => setGpuLayers(Number(e.target.value))}
                                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    style={{
                                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(gpuLayers / maxGpuLayers) * 100}%, #374151 ${(gpuLayers / maxGpuLayers) * 100}%, #374151 100%)`
                                    }}
                                />

                                <div className="flex justify-between text-[10px] mt-1">
                                    <span className="text-gray-500">Sadece CPU</span>
                                    <span className="text-blue-400 font-medium">Full GPU Hızlandırma</span>
                                </div>
                            </div>

                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => setGpuLayers(0)}
                                    className="flex-1 py-1 px-2 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                                >
                                    Kapalı
                                </button>
                                <button
                                    onClick={() => setGpuLayers(Math.floor(maxGpuLayers / 2))}
                                    className="flex-1 py-1 px-2 text-xs bg-blue-900/50 hover:bg-blue-800/60 text-blue-200 border border-blue-800/50 rounded transition-colors"
                                >
                                    Yarım
                                </button>
                                <button
                                    onClick={() => setGpuLayers(maxGpuLayers)}
                                    className="flex-1 py-1 px-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors font-medium shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                >
                                    Maksimum
                                </button>
                            </div>
                        </div>

                        <p className="text-[10px] text-gray-500 mt-2 leading-tight">
                            Ayar <span className="text-gray-300">GPU bellek limitinize göre</span> optimize edilmiştir. Aşım olursa model CPU'ya taşar (performans düşer).
                        </p>
                    </div>

                    {/* Sistem Gereksinimleri */}
                    {selectedModelForConfig.sizeBytes > 0 && (
                        <div className="p-2 bg-gray-900 rounded text-xs space-y-0.5 mt-2">
                            <div className="font-medium text-[var(--color-text)] mb-1">📊 Gereksinimler</div>
                            {(() => {
                                const req = calculateRequirements(selectedModelForConfig, contextLength);
                                return (
                                    <>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">💾 RAM:</span>
                                            <span className="text-[var(--color-text)]">{req.recommendedRAM} GB</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">🎮 VRAM:</span>
                                            <span className="text-[var(--color-text)]">{req.recommendedVRAM} GB</span>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* 🆕 GPU Yükleme Progress Bar */}
                    {isLoadingToGPU && (
                        <div className="mt-3 p-2.5 bg-blue-900/30 border border-blue-500/30 rounded">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="animate-spin text-sm">🔄</div>
                                <span className="text-blue-400 font-medium text-xs">GPU'ya yükleniyor...</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="bg-blue-500 h-full transition-all duration-300 ease-out"
                                    style={{ width: `${Math.round(loadingProgress)}%` }}
                                />
                            </div>
                            <div className="text-xs text-gray-400 mt-1 text-right">{Math.round(loadingProgress)}%</div>
                            {loadingProgress > 90 && (
                                <div className="text-xs text-yellow-400 mt-1 leading-tight">
                                    ⏳ Model hazırlanıyor...
                                </div>
                            )}
                        </div>
                    )}

                    <div className="sticky bottom-0 bg-[var(--color-background)] pt-2 pb-1 mx-[-10px] px-[10px] border-t border-[var(--color-border)] mt-auto z-10 shadow-[0_-10px_10px_var(--color-background)] mt-2">
                        <button
                            onClick={applyModelConfig}
                            disabled={isLoadingToGPU}
                            className={`w-full px-3 py-2 ${isLoadingToGPU ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-[var(--color-text)] rounded-lg font-bold text-sm shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2`}
                        >
                            {isLoadingToGPU ? (
                                <>
                                    <span className="animate-spin text-lg">⏳</span>
                                    Yükleniyor...
                                </>
                            ) : (
                                <>
                                    <span className="text-lg">🚀</span>
                                    {activeGpuModel ? 'Değişiklikleri Uygula' : 'Seçili Modeli Ayarlarla Başlat'}
                                </>
                            )}
                        </button>
                        <p className="text-center text-[10px] text-gray-500 mt-1.5">
                            💡 <span className="text-blue-400">CorexAI Chat</span> bu model ile çalışacak
                        </p>
                    </div>

                    {activeGpuModel && (
                        <button
                            onClick={() => unloadFromGPU()}
                            className="mt-2 w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 text-[var(--color-text)] rounded font-medium text-xs flex items-center justify-center gap-1"
                        >
                            <span className="text-sm">🎮</span> GPU'dan Kaldır
                        </button>
                    )}
                </div>
            )}

            {/* 🔬 Gelişmiş Ayarlar Sekmesi */}
            {activeTab === 'advanced' && (
                <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                    <div>
                        <div className="flex items-center justify-between mb-0.5">
                            <label className="text-xs font-medium text-[var(--color-text)]">🌡️ Temperature</label>
                            <span className="text-xs font-semibold text-[var(--color-text)]">{temperature.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.05"
                            value={temperature}
                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                            className="w-full h-1"
                        />
                        <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                            {temperature < 0.3 && '🎯 Kesin, formel, öngörülebilir'}
                            {temperature >= 0.3 && temperature < 0.7 && '✅ Dengeli, doğal yanıtlar'}
                            {temperature >= 0.7 && temperature < 1.2 && '🎨 Yaratıcı, esnek, çeşitli'}
                            {temperature >= 1.2 && '🌪️ Kaotik, çok sürprizli'}
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-0.5">
                            <label className="text-xs font-medium text-[var(--color-text)]">🎯 Top-P (Nucleus)</label>
                            <span className="text-xs font-semibold text-[var(--color-text)]">{topP.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.05"
                            value={topP}
                            onChange={(e) => setTopP(parseFloat(e.target.value))}
                            className="w-full h-1"
                        />
                        <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                            {topP < 0.5 && '🎯 Çok odaklı'}
                            {topP >= 0.5 && topP < 0.9 && '✅ Dengeli kelime seçimi'}
                            {topP >= 0.9 && '🎨 Tüm olasılıklara açık'}
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-0.5">
                            <label className="text-xs font-medium text-[var(--color-text)]">🎲 Top-K</label>
                            <span className="text-xs font-semibold text-[var(--color-text)]">{topK}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="100"
                            step="1"
                            value={topK}
                            onChange={(e) => setTopK(parseInt(e.target.value))}
                            className="w-full h-1"
                        />
                        <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                            {topK < 20 && '🎯 Güvenli, garantili'}
                            {topK >= 20 && topK <= 50 && '✅ Normal kelime dağarcığı'}
                            {topK > 50 && topK <= 70 && '🎨 Nadir kelimeler'}
                            {topK > 70 && '🔥 Çok geniş'}
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-0.5">
                            <label className="text-xs font-medium text-[var(--color-text)]">🔁 Repeat Penalty</label>
                            <span className="text-xs font-semibold text-[var(--color-text)]">{repeatPenalty.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="2"
                            step="0.05"
                            value={repeatPenalty}
                            onChange={(e) => setRepeatPenalty(parseFloat(e.target.value))}
                            className="w-full h-1"
                        />
                        <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                            {repeatPenalty < 1.05 && '❌ Yok'}
                            {repeatPenalty >= 1.05 && repeatPenalty < 1.15 && '⚖️ Hafif'}
                            {repeatPenalty >= 1.15 && repeatPenalty < 1.3 && '✅ Dengeli'}
                            {repeatPenalty >= 1.3 && '🚫 Yüksek'}
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-0.5">
                            <label className="text-xs font-medium text-[var(--color-text)]">📉 Min-P</label>
                            <span className="text-xs font-semibold text-[var(--color-text)]">{minP.toFixed(3)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="0.5"
                            step="0.01"
                            value={minP}
                            onChange={(e) => setMinP(parseFloat(e.target.value))}
                            className="w-full h-1"
                        />
                        <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                            {minP < 0.05 && '🌈 Çok düşük'}
                            {minP >= 0.05 && minP < 0.15 && '⚖️ Dengeli'}
                            {minP >= 0.15 && '🎯 Yüksek'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1 text-[var(--color-text)]">🎨 Hızlı Ayarlar</label>
                        <div className="grid grid-cols-2 gap-1">
                            <button
                                onClick={() => {
                                    setTemperature(0.3);
                                    setTopP(0.9);
                                    setTopK(20);
                                    setRepeatPenalty(1.1);
                                    setMinP(0.05);
                                }}
                                className="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs"
                            >
                                🎯 Odaklı
                            </button>
                            <button
                                onClick={() => {
                                    setTemperature(0.7);
                                    setTopP(0.9);
                                    setTopK(40);
                                    setRepeatPenalty(1.1);
                                    setMinP(0.05);
                                }}
                                className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs"
                            >
                                ⚖️ Dengeli
                            </button>
                            <button
                                onClick={() => {
                                    setTemperature(1.2);
                                    setTopP(0.95);
                                    setTopK(70);
                                    setRepeatPenalty(1.15);
                                    setMinP(0.03);
                                }}
                                className="px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded text-xs"
                            >
                                🎨 Yaratıcı
                            </button>
                            <button
                                onClick={() => {
                                    setTemperature(0.1);
                                    setTopP(0.85);
                                    setTopK(10);
                                    setRepeatPenalty(1.2);
                                    setMinP(0.1);
                                }}
                                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                            >
                                📝 Kod/Teknik
                            </button>
                        </div>
                    </div>

                    <div className="p-1.5 bg-blue-900/20 border border-blue-500/30 rounded">
                        <p className="text-xs text-blue-300 leading-tight">
                            💡 Kod: 0.1-0.3, Yaratıcı: 0.8-1.2
                        </p>
                    </div>

                    <button
                        onClick={applyModelConfig}
                        disabled={isLoadingToGPU}
                        className={`w-full px-3 py-1.5 ${isLoadingToGPU ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-[var(--color-text)] rounded font-medium text-xs`}
                    >
                        {isLoadingToGPU ? '⏳ Yükleniyor...' : '✓ Gelişmiş Ayarları Uygula'}
                    </button>

                    {activeGpuModel && (
                        <button
                            onClick={() => unloadFromGPU()}
                            className="w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 text-[var(--color-text)] rounded font-medium text-xs"
                        >
                            🎮 GPU'dan Kaldır
                        </button>
                    )}
                </div>
            )}

            {/* 📈 Performans Logları Sekmesi */}
            {activeTab === 'logs' && (
                <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between flex-shrink-0">
                        <h5 className="text-xs font-semibold text-[var(--color-text)]">📈 Performans Logları</h5>
                        {performanceLogs.length > 0 && (
                            <button
                                onClick={() => {
                                    setPerformanceLogs([]);
                                    localStorage.removeItem('gguf-performance-logs');
                                    showToast('Loglar temizlendi', 'success');
                                }}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 rounded text-xs"
                            >
                                🗑️ Temizle
                            </button>
                        )}
                    </div>

                    {performanceLogs.length > 0 ? (
                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                            {performanceLogs.map((log, index) => (
                                <div key={index} className="p-2 bg-gray-900 rounded text-xs">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-semibold text-[var(--color-text)] truncate">{log.modelName}</span>
                                        <span className="text-green-400 font-bold">{log.tokensPerSecond.toFixed(1)} t/s</span>
                                    </div>
                                    <div className="space-y-0.5 text-gray-400">
                                        <div className="flex justify-between">
                                            <span>Context:</span>
                                            <span className="text-[var(--color-text)]">{log.contextLength.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>GPU Layers:</span>
                                            <span className="text-[var(--color-text)]">{log.gpuLayers}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Temperature:</span>
                                            <span className="text-[var(--color-text)]">{log.temperature.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Tarih:</span>
                                            <span className="text-[var(--color-text)] text-xs">
                                                {new Date(log.timestamp).toLocaleString('tr-TR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center p-3 bg-gray-900 rounded">
                                <p className="text-xs text-gray-400">
                                    📈 Henüz performans logu yok. Benchmark çalıştırın.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 💬 Konuşma Geçmişi Sekmesi */}
            {activeTab === 'history' && (
                <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between flex-shrink-0">
                        <h5 className="text-xs font-semibold text-[var(--color-text)]">💬 Konuşma Geçmişi</h5>
                        {conversationHistory.length > 0 && (
                            <button
                                onClick={() => {
                                    setConversationHistory([]);
                                    localStorage.removeItem('gguf-conversation-history');
                                    showToast('Geçmiş temizlendi', 'success');
                                }}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 rounded text-xs"
                            >
                                🗑️ Temizle
                            </button>
                        )}
                    </div>

                    {conversationHistory.length > 0 ? (
                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                            {conversationHistory.map((entry, index) => (
                                <div key={index} className="p-2 bg-gray-900 rounded text-xs">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-semibold text-[var(--color-text)] truncate">{entry.modelName}</span>
                                        <span className="text-gray-400 text-xs">
                                            {new Date(entry.timestamp).toLocaleDateString('tr-TR', {
                                                day: '2-digit',
                                                month: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="p-1.5 bg-blue-900/30 rounded">
                                            <p className="text-blue-300 text-xs line-clamp-2">{entry.prompt}</p>
                                        </div>
                                        <div className="p-1.5 bg-green-900/30 rounded">
                                            <p className="text-green-300 text-xs line-clamp-3">{entry.response}</p>
                                        </div>
                                        <div className="text-gray-500 text-xs">
                                            {entry.tokensUsed} tokens kullanıldı
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center p-3 bg-gray-900 rounded">
                                <p className="text-xs text-gray-400">
                                    💬 Henüz konuşma geçmişi yok.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
