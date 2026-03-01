import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { showToast } from '../components/ToastContainer';
import { GGUFModel, HuggingFaceModel, SystemRequirements } from '../components/GGUFModelBrowser/types';

export const QUANT_INFO: Record<string, { quality: string; vramMultiplier: number }> = {
    'Q4_K_M': { quality: 'Önerilen - İyi kalite', vramMultiplier: 0.55 },
    'Q5_K_M': { quality: 'Çok yüksek kalite', vramMultiplier: 0.7 },
    'Q6_K': { quality: 'En yüksek kalite', vramMultiplier: 0.8 },
};

export const calculateRequirements = (model: GGUFModel, contextLength: number = 4096): SystemRequirements => {
    const sizeGB = model.sizeBytes / (1024 ** 3);
    const quantInfo = QUANT_INFO[model.quantization] || { vramMultiplier: 0.5 };
    const contextRAM = (contextLength / 1000) * sizeGB * 0.002;

    return {
        minRAM: Math.ceil(sizeGB * 1.2),
        minVRAM: Math.ceil(sizeGB * quantInfo.vramMultiplier),
        recommendedRAM: Math.ceil(sizeGB * 1.5 + contextRAM),
        recommendedVRAM: Math.ceil(sizeGB * quantInfo.vramMultiplier * 1.2)
    };
};

export function useGGUFBrowserLogic(onModelSelect?: (model: GGUFModel) => void) {
    const [models, setModels] = useState<GGUFModel[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [downloadFolder, setDownloadFolder] = useState<string>('');
    const [contextLength, setContextLength] = useState<number>(32768);
    const [outputMode, setOutputMode] = useState<'brief' | 'normal' | 'detailed'>('normal');
    const [gpuLayers, setGpuLayers] = useState<number>(28);
    const [showRequirements, setShowRequirements] = useState<string | null>(null);
    const [hfSearchQuery, setHfSearchQuery] = useState('');
    const [selectedModelForConfig, setSelectedModelForConfig] = useState<GGUFModel | null>(null);
    const [hfSearchResults, setHfSearchResults] = useState<GGUFModel[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingToGPU, setIsLoadingToGPU] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [activeGpuModel, setActiveGpuModel] = useState<string | null>(null);
    const [gpuMemory, setGpuMemory] = useState<any | null>(null);
    const [showComparison, setShowComparison] = useState(false);
    const [isBenchmarking, setIsBenchmarking] = useState(false);
    const [sortBy, setSortBy] = useState<'name' | 'size' | 'recent' | 'usage'>('name');
    const [filterBy, setFilterBy] = useState<'all' | 'favorites' | 'downloaded'>('all');
    const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'logs' | 'history'>('basic');

    const [temperature, setTemperature] = useState<number>(0.7);
    const [topP, setTopP] = useState<number>(0.9);
    const [topK, setTopK] = useState<number>(40);
    const [repeatPenalty, setRepeatPenalty] = useState<number>(1.1);
    const [minP, setMinP] = useState<number>(0.05);

    const [modelMetadata, setModelMetadata] = useState<any>(null);
    const [performanceLogs, setPerformanceLogs] = useState<any[]>([]);
    const [conversationHistory, setConversationHistory] = useState<any[]>([]);
    const [downloadQueue, setDownloadQueue] = useState<GGUFModel[]>([]);

    const [showSearchModal, setShowSearchModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showCleanupModal, setShowCleanupModal] = useState(false);
    const [selectedForCleanup, setSelectedForCleanup] = useState<string[]>([]);

    const [gpuBackendInfo, setGpuBackendInfo] = useState<any | null>(null);
    const [gpuInfo, setGpuInfo] = useState<any | null>(null);
    const [backendRecommendation, setBackendRecommendation] = useState<any | null>(null);

    const saveModels = (newModels: GGUFModel[]) => {
        setModels(newModels);
        localStorage.setItem('gguf-models', JSON.stringify(newModels));
    };

    const updateModelUsage = (modelId: string) => {
        const newModels = models.map(m =>
            m.id === modelId
                ? {
                    ...m,
                    lastUsed: Date.now(),
                    usageCount: (m.usageCount || 0) + 1
                }
                : m
        );
        saveModels(newModels);
    };

    const saveConversationHistory = (modelId: string, modelName: string, prompt: string, response: string, tokensUsed: number) => {
        const newEntry = {
            timestamp: Date.now(),
            modelId,
            modelName,
            prompt,
            response,
            tokensUsed
        };

        const updatedHistory = [newEntry, ...conversationHistory].slice(0, 100);
        setConversationHistory(updatedHistory);
        localStorage.setItem('gguf-conversation-history', JSON.stringify(updatedHistory));
    };

    useEffect(() => {
        (window as any).saveGGUFConversationHistory = saveConversationHistory;
    }, [conversationHistory]);

    const initDefaultFolder = async () => {
        try {
            let homeDir = await invoke<string>('get_home_dir');
            const separator = homeDir.includes('\\') ? '\\' : '/';
            const defaultPath = `${homeDir}${separator}.corex${separator}models`;
            const saved = localStorage.getItem('gguf-download-folder');

            if (saved && saved.includes('.corex')) {
                setDownloadFolder(saved);
                checkDownloadedModels(saved);
            } else {
                setDownloadFolder(defaultPath);
                localStorage.setItem('gguf-download-folder', defaultPath);
                try {
                    await invoke('create_directory', { path: defaultPath });
                } catch (e) { }
                checkDownloadedModels(defaultPath);
            }
        } catch (error) {
            console.error('Default folder error:', error);
        }
    };

    const checkDownloadedModels = async (folder: string) => {
        try {
            const files = await invoke<string[]>('get_all_files', { path: folder });
            const ggufFiles = files.filter(f => f.endsWith('.gguf'));

            setModels(prev => prev.map(model => ({
                ...model,
                isDownloaded: ggufFiles.some(f => f.includes(model.name)),
                localPath: ggufFiles.find(f => f.includes(model.name))
            })));
        } catch (error) {
            console.error('Check models error:', error);
        }
    };

    useEffect(() => {
        initDefaultFolder();
        const savedModels = localStorage.getItem('gguf-models');
        if (savedModels) {
            try {
                setModels(JSON.parse(savedModels));
            } catch (error) { }
        }

        const savedLogs = localStorage.getItem('gguf-performance-logs');
        if (savedLogs) {
            try {
                setPerformanceLogs(JSON.parse(savedLogs));
            } catch (error) { }
        }

        const savedHistory = localStorage.getItem('gguf-conversation-history');
        if (savedHistory) {
            try {
                setConversationHistory(JSON.parse(savedHistory));
            } catch (error) { }
        }

        const initDownloadManager = async () => {
            try {
                const { downloadManager } = await import('../services/downloadManager');
                const activeDownloads = downloadManager.getActiveDownloads();

                if (activeDownloads.length > 0) {
                    setModels(prev => prev.map(model => {
                        const activeDownload = activeDownloads.find(d => d.url === model.downloadUrl);
                        if (activeDownload) {
                            return {
                                ...model,
                                isDownloading: true,
                                downloadProgress: activeDownload.progress,
                                downloadedBytes: activeDownload.downloadedSize
                            };
                        }
                        return model;
                    }));
                }

                const unsubscribe = downloadManager.onAnyTaskUpdate((task) => {
                    setModels(prev => prev.map(model => {
                        if (model.downloadUrl === task.url) {
                            return {
                                ...model,
                                isDownloading: task.status === 'downloading',
                                downloadProgress: task.progress,
                                downloadedBytes: task.downloadedSize,
                                isDownloaded: task.status === 'completed',
                                localPath: task.status === 'completed' ? task.destination : model.localPath
                            };
                        }
                        return model;
                    }));
                });
                return unsubscribe;
            } catch (error) { }
        };

        const unsub = initDownloadManager();

        const checkActiveGpuModel = async () => {
            try {
                const { getGgufModelStatus } = await import('../services/ai');
                const status = await getGgufModelStatus();
                if (status.loaded && status.loaded_models && status.loaded_models.length > 0) {
                    setActiveGpuModel(status.loaded_models[0]);
                }
            } catch (error) { }
        };
        checkActiveGpuModel();

        const checkGpuBackend = async () => {
            try {
                const backendInfo = await invoke('check_cuda_support');
                setGpuBackendInfo(backendInfo as any);
            } catch (error) { }
        };
        checkGpuBackend();

        const detectGPU = async () => {
            try {
                const { getGPUInfo } = await import('../services/modelRegistry');
                const info = await getGPUInfo();
                setGpuInfo(info);
                if (info.available && info.totalVRAM_GB > 0) {
                    const { calculateOptimalGPULayers } = await import('../services/modelRegistry');
                    const optimalLayers = calculateOptimalGPULayers(4, info.freeVRAM_GB, contextLength);
                    setGpuLayers(optimalLayers);
                }
            } catch (error) { }
        };
        detectGPU();

        const updateGpuMemory = async () => {
            try {
                const { getGpuMemoryInfo } = await import('../services/ai');
                const info = await getGpuMemoryInfo();
                setGpuMemory(info);
            } catch (error) { }
        };
        updateGpuMemory();
        const interval = setInterval(updateGpuMemory, 3000);

        return () => {
            clearInterval(interval);
            if (unsub && typeof unsub === 'function') (unsub as any)();
        };
    }, []);

    useEffect(() => {
        const searchHF = async () => {
            if (hfSearchQuery.length < 2) {
                setHfSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const response = await fetch(
                    `https://huggingface.co/api/models?search=${encodeURIComponent(hfSearchQuery)}&filter=gguf&sort=downloads&limit=20`
                );
                if (!response.ok) throw new Error('Arama başarısız');

                const data: HuggingFaceModel[] = await response.json();
                const uniqueModels = new Map<string, GGUFModel>();

                for (const model of data) {
                    try {
                        const baseModelName = model.id.split('/').pop()?.replace(/-GGUF$/i, '') || model.id;
                        if (uniqueModels.has(baseModelName)) continue;

                        const filesResponse = await fetch(`https://huggingface.co/api/models/${model.id}/tree/main`);
                        if (!filesResponse.ok) continue;

                        const files = await filesResponse.json();
                        const ggufFiles = files.filter((f: any) => f.path && f.path.endsWith('.gguf') && !f.path.includes('-of-'));

                        if (ggufFiles.length > 0) {
                            const file = ggufFiles.find((f: any) => f.path.toLowerCase().includes('q4_k_m'))
                                || ggufFiles.find((f: any) => f.path.toLowerCase().includes('q5_k_m'))
                                || ggufFiles.find((f: any) => f.path.toLowerCase().includes('q4_0'))
                                || ggufFiles.find((f: any) => f.path.toLowerCase().includes('q8_0'))
                                || ggufFiles.find((f: any) => f.path.toLowerCase().includes('q6_k'))
                                || ggufFiles[0];

                            const fileName = file.path;
                            const sizeBytes = file.size || 0;
                            const sizeGB = (sizeBytes / (1024 ** 3)).toFixed(1);

                            const quantMatch = fileName.match(/[Qq](\d+)_[KkMm]_?[MmLl]?/);
                            const quant = quantMatch ? quantMatch[0].toUpperCase() : 'Q4_K_M';

                            const paramMatch = fileName.match(/(\d+\.?\d*)[Bb]/);
                            const params = paramMatch ? paramMatch[0].toUpperCase() : '';

                            uniqueModels.set(baseModelName, {
                                id: `hf-${model.id}-${fileName}`,
                                name: fileName,
                                displayName: model.id.split('/').pop() || fileName,
                                size: sizeBytes > 0 ? `${sizeGB} GB` : 'Bilinmiyor',
                                sizeBytes: sizeBytes,
                                quantization: quant,
                                parameters: params,
                                contextLength: 4096,
                                description: `${model.id.split('/')[0]} - ${(model.downloads || 0).toLocaleString()} indirme`,
                                huggingFaceUrl: `https://huggingface.co/${model.id}`,
                                downloadUrl: `https://huggingface.co/${model.id}/resolve/main/${fileName}`,
                                isDownloaded: false,
                                isDownloading: false,
                                downloads: model.downloads,
                                likes: model.likes
                            });
                        }
                    } catch (error) { }
                }

                setHfSearchResults(Array.from(uniqueModels.values()));
            } catch (error) {
                setHfSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        };

        const debounce = setTimeout(searchHF, 800);
        return () => clearTimeout(debounce);
    }, [hfSearchQuery]);

    const selectDownloadFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'GGUF Modelleri İçin Klasör Seçin'
            });

            if (selected && typeof selected === 'string') {
                setDownloadFolder(selected);
                localStorage.setItem('gguf-download-folder', selected);
                await checkDownloadedModels(selected);
            }
        } catch (error) { }
    };

    const downloadModel = async (model: GGUFModel) => {
        if (!downloadFolder) {
            alert('⚠️ Önce indirme klasörü seçin!');
            return;
        }

        setModels(prev => prev.map(m =>
            m.id === model.id ? {
                ...m,
                isDownloading: true,
                downloadProgress: 0,
                downloadedBytes: 0,
                downloadStartTime: Date.now()
            } : m
        ));

        try {
            const destination = `${downloadFolder}\\${model.name}`;
            const { downloadManager } = await import('../services/downloadManager');

            const unsubscribe = downloadManager.onAnyTaskUpdate((task) => {
                if (task.url === model.downloadUrl) {
                    setModels(prev => prev.map(m =>
                        m.id === model.id ? {
                            ...m,
                            isDownloading: task.status === 'downloading',
                            downloadProgress: task.progress,
                            downloadedBytes: task.downloadedSize,
                            isDownloaded: task.status === 'completed',
                            localPath: task.status === 'completed' ? destination : m.localPath
                        } : m
                    ));

                    if (task.status === 'completed') {
                        showToast(`✅ ${model.displayName} indirildi!`, 'success');
                        unsubscribe();
                    } else if (task.status === 'failed') {
                        showToast(`❌ İndirme başarısız: ${task.error}`, 'error');
                        unsubscribe();
                    }
                }
            });

            await downloadManager.startDownload(model.downloadUrl, destination, model.displayName);
            showToast(`📥 ${model.displayName} indiriliyor...`, 'info');
        } catch (error) {
            showToast('❌ İndirme başarısız: ' + error, 'error');
            setModels(prev => prev.map(m =>
                m.id === model.id ? { ...m, isDownloading: false, downloadProgress: 0, downloadedBytes: 0 } : m
            ));
        }
    };

    const selectLocalFile = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{ name: 'GGUF Models', extensions: ['gguf'] }],
                title: 'GGUF Model Dosyası Seçin'
            });

            if (selected && typeof selected === 'string') {
                const fileName = selected.split(/[/\\]/).pop() || '';
                let sizeBytes = 0;
                let sizeStr = 'Bilinmiyor';

                try {
                    const fileInfo = await invoke<{ size: number }>('get_file_size', { path: selected });
                    sizeBytes = fileInfo.size;
                    sizeStr = `${(sizeBytes / (1024 ** 3)).toFixed(1)} GB`;
                } catch (error) { }

                const quantMatch = fileName.match(/[Qq](\d+)_[KkMm]_?[MmLl]?/);
                const quant = quantMatch ? quantMatch[0].toUpperCase() : 'Q4_K_M';
                const paramMatch = fileName.match(/(\d+\.?\d*)[Bb]/);
                const params = paramMatch ? paramMatch[0].toUpperCase() : '';

                const customModel: GGUFModel = {
                    id: 'custom-' + Date.now(),
                    name: fileName,
                    displayName: fileName.replace('.gguf', ''),
                    size: sizeStr,
                    sizeBytes: sizeBytes,
                    quantization: quant,
                    parameters: params,
                    description: 'Yerel GGUF dosyası',
                    huggingFaceUrl: '',
                    downloadUrl: '',
                    localPath: selected,
                    isDownloaded: true,
                    isDownloading: false,
                    contextLength: 4096
                };

                saveModels([...models, customModel]);
                setSelectedModelForConfig(customModel);
                showToast(`${fileName} eklendi`, 'success');
            }
        } catch (error) { }
    };

    const addModelFromSearch = (model: GGUFModel) => {
        const modelToAdd = { ...model, isDownloaded: false, isDownloading: false };
        saveModels([...models, modelToAdd]);
        setHfSearchResults(prev => prev.filter(m => m.id !== model.id));
        setTimeout(() => downloadModel(modelToAdd), 100);
    };

    const handleModelSelect = async (model: GGUFModel) => {
        if (!model.isDownloaded) {
            alert('⚠️ Bu model henüz indirilmemiş. Önce indirin.');
            return;
        }
        setSelectedModelForConfig(model);

        if (model.localPath) {
            try {
                const { getBackendRecommendation } = await import('../services/modelRegistry');
                const recommendation = await getBackendRecommendation(model.localPath);
                setBackendRecommendation(recommendation);
                setGpuLayers(recommendation.gpuLayers);
                showToast(`Öneri: ${recommendation.backend.toUpperCase()} (${recommendation.expectedPerformance})`, 'info');
            } catch (error) { }
        }
    };

    const applyModelConfig = async () => {
        if (!selectedModelForConfig) return;
        setIsLoadingToGPU(true);
        setLoadingProgress(0);

        try {
            const modelContextLength = contextLength;
            const maxOutputTokens = outputMode === 'brief' ? 2048 : outputMode === 'detailed' ? 16384 : 8192;
            localStorage.setItem('ai-output-mode', outputMode);

            const ggufConfig = {
                modelPath: selectedModelForConfig.localPath,
                contextLength: modelContextLength,
                gpuLayers: gpuLayers,
                modelName: selectedModelForConfig.displayName
            };

            localStorage.setItem('gguf-active-model', JSON.stringify(ggufConfig));
            setLoadingProgress(5);

            const progressInterval = setInterval(() => {
                setLoadingProgress(prev => prev < 90 ? prev + Math.random() * 3 : prev);
            }, 500);

            const { loadGgufModel } = await import('../services/ai');
            await loadGgufModel({
                modelPath: selectedModelForConfig.localPath as string,
                contextLength: modelContextLength,
                gpuLayers: gpuLayers,
                maxTokens: maxOutputTokens,
                temperature,
                topP,
                topK,
                repeatPenalty,
                minP
            });

            clearInterval(progressInterval);
            setLoadingProgress(100);
            setActiveGpuModel(selectedModelForConfig.localPath as string);
            const updatedModel = {
                ...selectedModelForConfig,
                contextLength: modelContextLength
            };
            if (onModelSelect) onModelSelect(updatedModel);
            updateModelUsage(selectedModelForConfig.id);

            showToast(`${selectedModelForConfig.displayName} başarıyla yüklendi!`, 'success');

            window.dispatchEvent(new CustomEvent('gguf-model-loaded', { detail: ggufConfig }));
        } catch (error) {
            showToast('Yükleme hatası: ' + error, 'error');
        } finally {
            setIsLoadingToGPU(false);
            setTimeout(() => setLoadingProgress(0), 1000);
        }
    };

    const unloadFromGPU = async (modelPath?: string) => {
        if (!confirm(modelPath ? `Modeli GPU'dan kaldırmak istediğinize emin misiniz?` : 'Tüm modelleri GPU\'dan kaldırmak istediğinize emin misiniz?')) return;

        try {
            const { unloadGgufModel } = await import('../services/ai');
            await unloadGgufModel();

            if (!modelPath) {
                localStorage.removeItem('gguf-active-model');
                setActiveGpuModel(null);
            }

            const savedProviders = localStorage.getItem('corex-ai-providers');
            if (savedProviders) {
                try {
                    const providers = JSON.parse(savedProviders);
                    const ggufProvider = providers.find((p: any) => p.id === 'gguf-direct');
                    if (ggufProvider) {
                        if (modelPath) {
                            ggufProvider.models = ggufProvider.models.map((m: any) =>
                                m.localPath === modelPath ? { ...m, isActive: false } : m
                            );
                        } else {
                            ggufProvider.models = ggufProvider.models.map((m: any) => ({ ...m, isActive: false }));
                            ggufProvider.isActive = false;
                        }
                        localStorage.setItem('corex-ai-providers', JSON.stringify(providers));
                        window.dispatchEvent(new CustomEvent('ai-providers-updated', { detail: providers }));
                    }
                } catch (e) { }
            }
            showToast('GPU temizlendi', 'success');
        } catch (error) {
            showToast('Kaldırma hatası: ' + error, 'error');
        }
    };

    const deleteModel = (modelId: string) => {
        const model = models.find(m => m.id === modelId);
        if (!model) return;
        if (!confirm(`${model.displayName} modelini silmek istediğinize emin misiniz?`)) return;

        const newModels = models.filter(m => m.id !== modelId);
        saveModels(newModels);
        showToast('Model silindi', 'info');
    };

    const toggleFavorite = (modelId: string) => {
        const newModels = models.map(m => m.id === modelId ? { ...m, isFavorite: !m.isFavorite } : m);
        saveModels(newModels);
    };

    const readModelMetadata = async (modelPath: string) => {
        try {
            showToast('Metadata okunuyor...', 'info');
            const { readModelMetadata: readMeta } = await import('../services/modelRegistry');
            const metadata = await readMeta(modelPath);
            setModelMetadata(metadata);
            showToast('Metadata okundu', 'success');
        } catch (error) {
            showToast('Hata: ' + error, 'error');
        }
    };

    const getModelSuggestions = () => {
        const suggestions: Array<{ reason: string; model: GGUFModel }> = [];
        const sortedUsage = [...models].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
        if (sortedUsage[0]?.usageCount) suggestions.push({ reason: '⭐ En çok kullandığınız', model: sortedUsage[0] });

        const sortedRecent = [...models].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
        if (sortedRecent[0]?.lastUsed) suggestions.push({ reason: '🕐 En son kullandığınız', model: sortedRecent[0] });

        return suggestions;
    };

    const cleanupSelectedModels = () => {
        if (selectedForCleanup.length === 0) return;
        if (!confirm(`${selectedForCleanup.length} model silinecek?`)) return;
        saveModels(models.filter(m => !selectedForCleanup.includes(m.id)));
        setSelectedForCleanup([]);
        setShowCleanupModal(false);
        showToast('Temizlik tamam', 'success');
    };

    const filteredModels = models
        .filter(model => {
            const matchesSearch = model.displayName.toLowerCase().includes(searchQuery.toLowerCase());
            if (filterBy === 'favorites' && !model.isFavorite) return false;
            if (filterBy === 'downloaded' && !model.isDownloaded) return false;
            return matchesSearch;
        })
        .sort((a, b) => {
            if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
            if (sortBy === 'size') return b.sizeBytes - a.sizeBytes;
            if (sortBy === 'recent') return (b.lastUsed || 0) - (a.lastUsed || 0);
            if (sortBy === 'usage') return (b.usageCount || 0) - (a.usageCount || 0);
            return 0;
        });

    return {
        models, setModels, searchQuery, setSearchQuery, downloadFolder, setDownloadFolder,
        contextLength, setContextLength, outputMode, setOutputMode, gpuLayers, setGpuLayers,
        showRequirements, setShowRequirements, hfSearchQuery, setHfSearchQuery,
        selectedModelForConfig, setSelectedModelForConfig, hfSearchResults, setHfSearchResults,
        isSearching, setIsSearching, isLoadingToGPU, setIsLoadingToGPU, loadingProgress, setLoadingProgress,
        activeGpuModel, setActiveGpuModel, gpuMemory, setGpuMemory, showComparison, setShowComparison,
        isBenchmarking, setIsBenchmarking, sortBy, setSortBy, filterBy, setFilterBy, activeTab, setActiveTab,
        temperature, setTemperature, topP, setTopP, topK, setTopK, repeatPenalty, setRepeatPenalty, minP, setMinP,
        modelMetadata, setModelMetadata, performanceLogs, setPerformanceLogs,
        conversationHistory, setConversationHistory, downloadQueue, setDownloadQueue,
        showSearchModal, setShowSearchModal, showFilterModal, setShowFilterModal,
        showCleanupModal, setShowCleanupModal, selectedForCleanup, setSelectedForCleanup,
        gpuBackendInfo, setGpuBackendInfo, gpuInfo, setGpuInfo, backendRecommendation, setBackendRecommendation,
        // Methods
        updateModelUsage, selectDownloadFolder, downloadModel, selectLocalFile, addModelFromSearch,
        handleModelSelect, applyModelConfig, unloadFromGPU, deleteModel, toggleFavorite,
        readModelMetadata, getModelSuggestions, cleanupSelectedModels, filteredModels
    };
}
