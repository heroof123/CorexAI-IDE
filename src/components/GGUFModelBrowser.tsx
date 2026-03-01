import { openUrl } from '@tauri-apps/plugin-opener';
import ModelComparison from './ModelComparison';
import HuggingFaceSearch from './GGUFModelBrowser/HuggingFaceSearch';
import LocalModelList from './GGUFModelBrowser/LocalModelList';
import DownloadManager from './GGUFModelBrowser/DownloadManager';
import ModelSettingsPanel from './GGUFModelBrowser/ModelSettingsPanel';
import AdvancedFilterModal from './GGUFModelBrowser/AdvancedFilterModal';
import CleanupModal from './GGUFModelBrowser/CleanupModal';
import { useGGUFBrowserLogic, calculateRequirements } from '../hooks/useGGUFBrowserLogic';
import { GGUFModelBrowserProps } from './GGUFModelBrowser/types';

export default function GGUFModelBrowser({ onModelSelect }: GGUFModelBrowserProps) {
  const {
    models, searchQuery, setSearchQuery, downloadFolder,
    contextLength, setContextLength, outputMode, setOutputMode, gpuLayers, setGpuLayers,
    showRequirements, setShowRequirements, hfSearchQuery, setHfSearchQuery,
    selectedModelForConfig, setSelectedModelForConfig, hfSearchResults, setHfSearchResults,
    isSearching, isLoadingToGPU, loadingProgress,
    activeGpuModel, gpuMemory, showComparison, setShowComparison,
    sortBy, setSortBy, filterBy, setFilterBy, activeTab, setActiveTab,
    temperature, setTemperature, topP, setTopP, topK, setTopK, repeatPenalty, setRepeatPenalty, minP, setMinP,
    modelMetadata, setModelMetadata, performanceLogs, setPerformanceLogs,
    conversationHistory, setConversationHistory, downloadQueue, setDownloadQueue,
    showSearchModal, setShowSearchModal, showFilterModal, setShowFilterModal,
    showCleanupModal, setShowCleanupModal, selectedForCleanup, setSelectedForCleanup,
    gpuBackendInfo, gpuInfo, backendRecommendation,
    // Methods
    selectDownloadFolder, downloadModel, selectLocalFile, addModelFromSearch,
    handleModelSelect, applyModelConfig, unloadFromGPU, deleteModel, toggleFavorite,
    readModelMetadata, getModelSuggestions, cleanupSelectedModels, filteredModels
  } = useGGUFBrowserLogic(onModelSelect);

  // Helper functions used in JSX
  const getTotalDiskUsage = () => {
    return models
      .filter(m => m.isDownloaded)
      .reduce((total, m) => total + m.sizeBytes, 0);
  };

  const getUnusedModels = (days: number) => {
    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    return models.filter(m => {
      if (m.isFavorite) return false;
      return !m.lastUsed || m.lastUsed < cutoffDate;
    });
  };

  const getNeverUsedModels = () => {
    return models.filter(m => !m.isFavorite && !m.lastUsed && m.isDownloaded);
  };

  const getCleanupSuggestions = () => {
    const suggestions = [];
    const neverUsed = getNeverUsedModels();
    if (neverUsed.length > 0) {
      suggestions.push({
        priority: 'high',
        title: 'Hiç Kullanılmayan Modeller',
        models: neverUsed,
        savings: neverUsed.reduce((sum, m) => sum + m.sizeBytes, 0),
        reason: 'Bu modeller hiç kullanılmadı'
      });
    }
    const unused60 = getUnusedModels(60);
    if (unused60.length > 0) {
      suggestions.push({
        priority: 'medium',
        title: '60+ Gün Kullanılmayan',
        models: unused60,
        savings: unused60.reduce((sum, m) => sum + m.sizeBytes, 0),
        reason: '60 günden fazla kullanılmadı'
      });
    }
    return suggestions;
  };

  return (
    <div className="gguf-model-browser flex gap-3">
      {/* Sol Panel - Model Listesi */}
      <div className={`${selectedModelForConfig ? 'w-2/3' : 'w-full'} transition-all`}>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">📦 GGUF Model Tarayıcı</h3>
            <a href="https://huggingface.co/models?library=gguf&sort=trending" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
              🤗 Tüm Modeller
            </a>
          </div>
        </div>

        <div className="mb-3 flex gap-2">
          <input type="text" value={downloadFolder || 'Klasör seçilmedi'} readOnly className="flex-1 px-2 py-1.5 bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]" placeholder="İndirme klasörü" />
          <button onClick={selectDownloadFolder} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs whitespace-nowrap">📁 Klasör</button>
          <button onClick={selectLocalFile} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-xs whitespace-nowrap">📄 Dosya Ekle</button>
          <button
            onClick={() => setShowSearchModal(true)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-xs whitespace-nowrap"
          >
            🤗 Model Ara
          </button>
          <button
            onClick={() => setShowComparison(true)}
            disabled={models.filter(m => m.isDownloaded).length < 2}
            className={`px-3 py-1.5 rounded text-xs whitespace-nowrap ${models.filter(m => m.isDownloaded).length >= 2
              ? 'bg-orange-600 hover:bg-orange-700 text-[var(--color-text)]'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            title="İki model karşılaştır"
          >
            ⚖️ Karşılaştır
          </button>
          <button
            onClick={() => setShowCleanupModal(true)}
            disabled={models.length === 0}
            className={`px-3 py-1.5 rounded text-xs whitespace-nowrap ${models.length > 0
              ? 'bg-[var(--color-background)] border-[var(--color-border)] text-[var(--color-text)]'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            title="Model temizlik ve disk yönetimi"
          >
            🧹 Temizlik
          </button>
          <button
            onClick={() => unloadFromGPU()}
            disabled={!activeGpuModel}
            className={`px-3 py-1.5 rounded text-xs whitespace-nowrap ${activeGpuModel
              ? 'bg-red-600 hover:bg-red-700 text-[var(--color-text)]'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            title={activeGpuModel ? "GPU'dan model(leri) kaldır" : "GPU'da model yok"}
          >
            🎮 GPU'dan Kaldır
          </button>
        </div>

        {/* 🆕 Filtre ve Bilgi Çubuğu */}
        {models.length > 0 && (
          <div className="mb-2 flex gap-2 items-start">
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => setFilterBy('all')}
                className={`px-2 py-1 rounded text-xs ${filterBy === 'all' ? 'bg-blue-600 text-[var(--color-text)]' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                📋 Tümü ({models.length})
              </button>
              <button
                onClick={() => setFilterBy('favorites')}
                className={`px-2 py-1 rounded text-xs ${filterBy === 'favorites' ? 'bg-yellow-600 text-[var(--color-text)]' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                ⭐ Favoriler ({models.filter(m => m.isFavorite).length})
              </button>
              <button
                onClick={() => setFilterBy('downloaded')}
                className={`px-2 py-1 rounded text-xs ${filterBy === 'downloaded' ? 'bg-green-600 text-[var(--color-text)]' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                ✓ İndirilmiş ({models.filter(m => m.isDownloaded).length})
              </button>
              <button
                onClick={() => setShowFilterModal(true)}
                className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs whitespace-nowrap"
              >
                🔍 Filtreler
              </button>
            </div>

            <div className="flex gap-2 flex-1 overflow-x-auto">
              {(() => {
                const suggestions = getModelSuggestions();
                return suggestions.length > 0 && (
                  <div className="flex-shrink-0 w-48 p-1.5 bg-cyan-900/20 border border-cyan-500/30 rounded">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-cyan-400">💡 Öneriler</span>
                    </div>
                    <div className="space-y-0.5 max-h-16 overflow-y-auto">
                      {suggestions.slice(0, 2).map((suggestion, index) => (
                        <div key={index} className="text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-cyan-300 truncate flex-1 text-xs">{suggestion.model.displayName}</span>
                            {suggestion.model.isDownloaded && (
                              <button onClick={() => handleModelSelect(suggestion.model)} className="px-1 py-0.5 bg-cyan-600 hover:bg-cyan-700 rounded text-xs ml-1">⚙️</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <DownloadManager
                downloadQueue={downloadQueue}
                setDownloadQueue={setDownloadQueue}
                processDownloadQueue={() => { }} // Hook handles this or extract it if needed
              />
            </div>
          </div>
        )}

        {models.length > 0 && (
          <div className="mb-2">
            <span className="text-xs text-gray-400">{filteredModels.length} model gösteriliyor</span>
          </div>
        )}

        <LocalModelList
          filteredModels={filteredModels}
          activeGpuModel={activeGpuModel}
          contextLength={contextLength}
          showRequirements={showRequirements}
          setShowRequirements={setShowRequirements}
          isBenchmarking={false}
          deleteModel={deleteModel}
          handleModelSelect={handleModelSelect}
          runBenchmark={() => { }}
          setSelectedModelForConfig={setSelectedModelForConfig}
          readModelMetadata={readModelMetadata}
          addToDownloadQueue={downloadModel}
          toggleFavorite={toggleFavorite}
        />
      </div>

      {/* Sağ Panel - Model Ayarları */}
      {selectedModelForConfig && (
        <ModelSettingsPanel
          selectedModelForConfig={selectedModelForConfig}
          setSelectedModelForConfig={setSelectedModelForConfig}
          modelMetadata={modelMetadata}
          setModelMetadata={setModelMetadata}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          gpuMemory={gpuMemory}
          contextLength={contextLength}
          setContextLength={setContextLength}
          outputMode={outputMode}
          setOutputMode={setOutputMode}
          gpuLayers={gpuLayers}
          setGpuLayers={setGpuLayers}
          maxGpuLayers={gpuBackendInfo?.recommended_gpu_layers || 40}
          temperature={temperature}
          setTemperature={setTemperature}
          topP={topP}
          setTopP={setTopP}
          topK={topK}
          setTopK={setTopK}
          repeatPenalty={repeatPenalty}
          setRepeatPenalty={setRepeatPenalty}
          minP={minP}
          setMinP={setMinP}
          applyModelConfig={applyModelConfig}
          isLoadingToGPU={isLoadingToGPU}
          activeGpuModel={activeGpuModel}
          unloadFromGPU={unloadFromGPU}
          performanceLogs={performanceLogs}
          setPerformanceLogs={setPerformanceLogs}
          conversationHistory={conversationHistory}
          setConversationHistory={setConversationHistory}
          gpuBackendInfo={gpuBackendInfo}
          gpuInfo={gpuInfo}
          backendRecommendation={backendRecommendation}
          calculateRequirements={calculateRequirements}
          loadingProgress={loadingProgress}
          openUrl={openUrl}
        />
      )}

      {showComparison && <ModelComparison onClose={() => setShowComparison(false)} />}

      <HuggingFaceSearch
        isVisible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        searchQuery={hfSearchQuery}
        setSearchQuery={setHfSearchQuery}
        isSearching={isSearching}
        searchResults={hfSearchResults}
        setSearchResults={setHfSearchResults}
        addModelFromSearch={addModelFromSearch}
        addToDownloadQueue={downloadModel}
      />

      <AdvancedFilterModal
        showFilterModal={showFilterModal}
        setShowFilterModal={setShowFilterModal}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      <CleanupModal
        showCleanupModal={showCleanupModal}
        setShowCleanupModal={setShowCleanupModal}
        models={models}
        getTotalDiskUsage={getTotalDiskUsage}
        getCleanupSuggestions={getCleanupSuggestions}
        selectedForCleanup={selectedForCleanup}
        setSelectedForCleanup={setSelectedForCleanup}
        cleanupSelectedModels={cleanupSelectedModels}
      />
    </div>
  );
}
