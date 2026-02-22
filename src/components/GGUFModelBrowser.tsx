import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { showToast } from './ToastContainer';
import ModelComparison from './ModelComparison';

interface GGUFModel {
  id: string;
  name: string;
  displayName: string;
  size: string;
  sizeBytes: number;
  quantization: string;
  description: string;
  huggingFaceUrl: string;
  downloadUrl: string;
  localPath?: string;
  isDownloaded: boolean;
  isDownloading: boolean;
  downloadProgress?: number;
  downloadedBytes?: number;
  downloadStartTime?: number;
  parameters?: string;
  contextLength?: number;
  downloads?: number;
  likes?: number;
  isFavorite?: boolean; // 🆕 Favori mi?
  lastUsed?: number; // 🆕 Son kullanım zamanı (timestamp)
  usageCount?: number; // 🆕 Kaç kez kullanıldı
}

interface HuggingFaceModel {
  id: string;
  modelId: string;
  author: string;
  downloads: number;
  likes: number;
  tags: string[];
  siblings?: Array<{ rfilename: string; size?: number }>;
}

interface SystemRequirements {
  minRAM: number;
  minVRAM: number;
  recommendedRAM: number;
  recommendedVRAM: number;
}

interface GGUFModelBrowserProps {
  onModelSelect: (model: GGUFModel) => void;
}

const QUANT_INFO: Record<string, { quality: string; vramMultiplier: number }> = {
  'Q4_K_M': { quality: 'Önerilen - İyi kalite', vramMultiplier: 0.55 },
  'Q5_K_M': { quality: 'Çok yüksek kalite', vramMultiplier: 0.7 },
  'Q6_K': { quality: 'En yüksek kalite', vramMultiplier: 0.8 },
};

const calculateRequirements = (model: GGUFModel, contextLength: number = 4096): SystemRequirements => {
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

export default function GGUFModelBrowser({ onModelSelect }: GGUFModelBrowserProps) {
  const [models, setModels] = useState<GGUFModel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadFolder, setDownloadFolder] = useState<string>('');
  const [contextLength, setContextLength] = useState<number>(32768); // 32K default
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
  const [gpuMemory, setGpuMemory] = useState<{
    available: boolean;
    total_vram_gb: number;
    used_vram_gb: number;
    free_vram_gb: number;
    usage_percent: number;
    model_size_gb: number;
    kv_cache_size_gb: number;
  } | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'recent' | 'usage'>('name');
  const [filterBy, setFilterBy] = useState<'all' | 'favorites' | 'downloaded'>('all');
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'logs' | 'history'>('basic');

  // 🆕 Gelişmiş Sampling Parametreleri
  const [temperature, setTemperature] = useState<number>(0.7);
  const [topP, setTopP] = useState<number>(0.9);
  const [topK, setTopK] = useState<number>(40);
  const [repeatPenalty, setRepeatPenalty] = useState<number>(1.1);
  const [minP, setMinP] = useState<number>(0.05);

  // 🆕 Yeni Özellikler için State'ler
  const [modelMetadata, setModelMetadata] = useState<any>(null);
  const [performanceLogs, setPerformanceLogs] = useState<Array<{
    timestamp: number;
    modelId: string;
    modelName: string;
    tokensPerSecond: number;
    contextLength: number;
    gpuLayers: number;
    temperature: number;
  }>>([]);
  const [conversationHistory, setConversationHistory] = useState<Array<{
    timestamp: number;
    modelId: string;
    modelName: string;
    prompt: string;
    response: string;
    tokensUsed: number;
  }>>([]);
  const [downloadQueue, setDownloadQueue] = useState<GGUFModel[]>([]);

  // 🆕 Modal state'leri
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [selectedForCleanup, setSelectedForCleanup] = useState<string[]>([]);

  // 🆕 GPU Backend Info
  const [gpuBackendInfo, setGpuBackendInfo] = useState<{
    backend: string;
    cuda_available: boolean;
    vulkan_available: boolean;
    recommended_gpu_layers: number;
    cuda_download_url: string;
    message: string;
  } | null>(null);

  // 🆕 Model Registry - GPU Info & Backend Recommendation
  const [gpuInfo, setGpuInfo] = useState<{
    available: boolean;
    vendor: string;
    name: string;
    totalVRAM_GB: number;
    freeVRAM_GB: number;
    recommendedBackend: string;
  } | null>(null);

  const [backendRecommendation, setBackendRecommendation] = useState<{
    backend: string;
    reason: string;
    gpuLayers: number;
    expectedPerformance: string;
    warnings: string[];
  } | null>(null);

  // 🆕 Kullanım istatistiklerini güncelle
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

  // 🆕 Konuşma geçmişi kaydet - Export edilebilir hale getirmek için window'a ekle
  const saveConversationHistory = (modelId: string, modelName: string, prompt: string, response: string, tokensUsed: number) => {
    const newEntry = {
      timestamp: Date.now(),
      modelId,
      modelName,
      prompt,
      response,
      tokensUsed
    };

    const updatedHistory = [newEntry, ...conversationHistory].slice(0, 100); // Son 100 konuşma
    setConversationHistory(updatedHistory);
    localStorage.setItem('gguf-conversation-history', JSON.stringify(updatedHistory));
  };

  // Window'a ekle ki diğer componentler kullanabilsin
  (window as any).saveGGUFConversationHistory = saveConversationHistory;

  useEffect(() => {
    const saved = localStorage.getItem('gguf-download-folder');
    if (saved) {
      setDownloadFolder(saved);
      checkDownloadedModels(saved);
    }

    const savedModels = localStorage.getItem('gguf-models');
    if (savedModels) {
      try {
        setModels(JSON.parse(savedModels));
      } catch (error) {
        console.error('Model yükleme hatası:', error);
      }
    }

    // 🆕 Performans loglarını yükle
    const savedLogs = localStorage.getItem('gguf-performance-logs');
    if (savedLogs) {
      try {
        setPerformanceLogs(JSON.parse(savedLogs));
      } catch (error) {
        console.error('Log yükleme hatası:', error);
      }
    }

    // 🆕 Konuşma geçmişini yükle
    const savedHistory = localStorage.getItem('gguf-conversation-history');
    if (savedHistory) {
      try {
        setConversationHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Geçmiş yükleme hatası:', error);
      }
    }

    // 🆕 Download Manager - Aktif indirmeleri yükle
    const initDownloadManager = async () => {
      try {
        const { downloadManager } = await import('../services/downloadManager');

        // Aktif indirmeleri kontrol et
        const activeDownloads = downloadManager.getActiveDownloads();
        console.log(`📥 ${activeDownloads.length} aktif indirme bulundu`);

        // Aktif indirmeleri model listesine yansıt
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

        // Global listener ekle - tüm indirme güncellemelerini dinle
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

        // Cleanup
        return () => {
          unsubscribe();
        };
      } catch (error) {
        console.error('Download Manager başlatılamadı:', error);
      }
    };

    initDownloadManager();

    // 🆕 GPU'da aktif model kontrolü
    const checkActiveGpuModel = async () => {
      try {
        const { getGgufModelStatus } = await import('../services/ggufProvider');
        const status = await getGgufModelStatus();
        if (status.loaded && status.loaded_models && status.loaded_models.length > 0) {
          // İlk modeli varsayılan aktif olarak göster
          setActiveGpuModel(status.loaded_models[0]);
          console.log('🎮 GPU\'da aktif modeller:', status.loaded_models);
        }
      } catch (error) {
        console.error('GPU model status kontrolü hatası:', error);
      }
    };

    checkActiveGpuModel();

    // 🆕 GPU Backend bilgisini al
    const checkGpuBackend = async () => {
      try {
        const backendInfo = await invoke('check_cuda_support');
        setGpuBackendInfo(backendInfo as any);
        console.log('🎮 GPU Backend:', backendInfo);
      } catch (error) {
        console.error('GPU backend kontrolü hatası:', error);
      }
    };

    checkGpuBackend();


    // 🆕 Model Registry - GPU Info Detection
    const detectGPU = async () => {
      try {
        const { getGPUInfo } = await import('../services/modelRegistry');
        const info = await getGPUInfo();
        setGpuInfo(info);
        console.log('🎮 GPU Info:', info);

        // Auto-set GPU layers based on VRAM
        if (info.available && info.totalVRAM_GB > 0) {
          const { calculateOptimalGPULayers } = await import('../services/modelRegistry');
          const optimalLayers = calculateOptimalGPULayers(4, info.freeVRAM_GB, contextLength);
          setGpuLayers(optimalLayers);
          console.log(`🎯 Optimal GPU layers: ${optimalLayers}/33`);
        }
      } catch (error) {
        console.error('GPU detection error:', error);
      }
    };

    detectGPU();

    // 🆕 GPU memory bilgisini periyodik olarak güncelle
    const updateGpuMemory = async () => {
      try {
        const { getGpuMemoryInfo } = await import('../services/ggufProvider');
        const info = await getGpuMemoryInfo();
        setGpuMemory(info);
      } catch (error) {
        console.error('GPU memory güncelleme hatası:', error);
      }
    };

    // İlk yüklemede güncelle
    updateGpuMemory();

    // Her 3 saniyede bir güncelle
    const interval = setInterval(updateGpuMemory, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Hugging Face'de gerçek zamanlı arama
  useEffect(() => {
    const searchHF = async () => {
      if (hfSearchQuery.length < 2) {
        setHfSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        // Hugging Face API - GGUF tag'i ile arama
        const response = await fetch(
          `https://huggingface.co/api/models?search=${encodeURIComponent(hfSearchQuery)}&filter=gguf&sort=downloads&limit=20`
        );

        if (!response.ok) {
          console.error('HF API hatası:', response.status);
          throw new Error('Arama başarısız');
        }

        const data: HuggingFaceModel[] = await response.json();
        console.log('HF API sonuçları:', data.length, 'model bulundu');

        // 🆕 Duplicate temizleme için Map kullan
        const uniqueModels = new Map<string, GGUFModel>();

        for (const model of data) {
          try {
            // Base model adını çıkar (quantization olmadan)
            const baseModelName = model.id.split('/').pop()?.replace(/-GGUF$/i, '') || model.id;

            // Eğer bu base model zaten varsa, atla
            if (uniqueModels.has(baseModelName)) {
              console.log(`⏭️ Duplicate atlandı: ${model.id}`);
              continue;
            }

            // Her model için dosya listesini al
            const filesResponse = await fetch(`https://huggingface.co/api/models/${model.id}/tree/main`);
            if (!filesResponse.ok) continue;

            const files = await filesResponse.json();
            // 🚫 -of- içeren parçalı modelleri (split gguf) filtrele
            const ggufFiles = files.filter((f: any) => f.path && f.path.endsWith('.gguf') && !f.path.includes('-of-'));

            console.log(`${model.id}: ${ggufFiles.length} GGUF dosyası bulundu (Parçalılar hariç)`);

            // 🎯 Öncelikli olarak Q4_K_M veya Q5_K_M olanı bul
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

              // Quantization'ı dosya adından çıkar
              const quantMatch = fileName.match(/[Qq](\d+)_[KkMm]_?[MmLl]?/);
              const quant = quantMatch ? quantMatch[0].toUpperCase() : 'Q4_K_M';

              // Parametre sayısını çıkar
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
          } catch (error) {
            console.error(`${model.id} dosyaları alınamadı:`, error);
          }
        }

        // Map'ten array'e çevir
        const results = Array.from(uniqueModels.values());
        console.log('✅ Toplam unique model:', results.length, '(duplicate temizlendi)');
        setHfSearchResults(results);
      } catch (error) {
        console.error('HF arama hatası:', error);
        setHfSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchHF, 800);
    return () => clearTimeout(debounce);
  }, [hfSearchQuery]);

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
      console.error('Model kontrolü hatası:', error);
    }
  };

  const saveModels = (newModels: GGUFModel[]) => {
    setModels(newModels);
    localStorage.setItem('gguf-models', JSON.stringify(newModels));
  };

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
    } catch (error) {
      console.error('Klasör seçme hatası:', error);
    }
  };

  const downloadModel = async (model: GGUFModel) => {
    if (!downloadFolder) {
      alert('⚠️ Önce indirme klasörü seçin!');
      return;
    }

    const requirements = calculateRequirements(model, contextLength);
    const confirmMsg = `📦 ${model.displayName} indirilecek\n\n` +
      `📊 Boyut: ${model.size}\n` +
      `🔢 Quantization: ${model.quantization}\n` +
      `💾 Min RAM: ${requirements.minRAM} GB\n` +
      `🎮 Min VRAM: ${requirements.minVRAM} GB\n` +
      `📝 Context: ${model.contextLength?.toLocaleString()} tokens\n\n` +
      `İndirmeye devam edilsin mi?`;

    if (!confirm(confirmMsg)) return;

    // Model durumunu güncelle
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

      // 🆕 Download Manager kullan - arka planda çalışır
      const { downloadManager } = await import('../services/downloadManager');

      // İndirme progress'ini dinle
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

          // Tamamlandıysa bildirim göster
          if (task.status === 'completed') {
            showToast(`✅ ${model.displayName} indirildi!`, 'success');
            unsubscribe(); // Listener'ı temizle
          } else if (task.status === 'failed') {
            showToast(`❌ İndirme başarısız: ${task.error}`, 'error');
            unsubscribe();
          }
        }
      });

      // İndirmeyi başlat (arka planda devam eder)
      await downloadManager.startDownload(
        model.downloadUrl,
        destination,
        model.displayName
      );

      showToast(`📥 ${model.displayName} indiriliyor... (Arka planda devam edecek)`, 'info');

      // LocalStorage'ı güncelle
      const updatedModels = models.map(m =>
        m.id === model.id ? {
          ...m,
          isDownloading: true
        } : m
      );
      saveModels(updatedModels);

    } catch (error) {
      console.error('İndirme hatası:', error);
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

        // 🆕 Dosya boyutunu al
        let sizeBytes = 0;
        let sizeStr = 'Bilinmiyor';

        try {
          // Tauri'nin file system API'sini kullanarak dosya boyutunu al
          const fileInfo = await invoke<{ size: number }>('get_file_size', { path: selected });
          sizeBytes = fileInfo.size;
          const sizeGB = (sizeBytes / (1024 ** 3)).toFixed(1);
          sizeStr = `${sizeGB} GB`;
          console.log(`📦 Dosya boyutu: ${sizeStr} (${sizeBytes} bytes)`);
        } catch (error) {
          console.error('Dosya boyutu alınamadı:', error);
        }

        // Quantization'ı dosya adından çıkar
        const quantMatch = fileName.match(/[Qq](\d+)_[KkMm]_?[MmLl]?/);
        const quant = quantMatch ? quantMatch[0].toUpperCase() : 'Q4_K_M';

        // Parametre sayısını çıkar
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

        // Modeli listeye ekle
        const newModels = [...models, customModel];
        saveModels(newModels);

        // Ayar panelini aç
        setSelectedModelForConfig(customModel);

        showToast(`${fileName} eklendi (${sizeStr})`, 'success');
      }
    } catch (error) {
      console.error('Dosya seçme hatası:', error);
      showToast('Dosya seçme hatası: ' + error, 'error');
    }
  };

  const addModelFromSearch = (model: GGUFModel) => {
    // Modeli listeye ekle VE hemen indirmeye başla
    const modelToAdd = { ...model, isDownloaded: false, isDownloading: false };
    const newModels = [...models, modelToAdd];
    setModels(newModels);
    saveModels(newModels);

    // Arama sonuçlarından kaldır
    setHfSearchResults(prev => prev.filter(m => m.id !== model.id));

    // İndirmeyi başlat (state güncellensin diye setTimeout kullan)
    setTimeout(() => {
      downloadModel(modelToAdd);
    }, 100);
  };

  const handleModelSelect = async (model: GGUFModel) => {
    if (!model.isDownloaded) {
      alert('⚠️ Bu model henüz indirilmemiş. Önce indirin.');
      return;
    }

    // Ayar panelini aç
    setSelectedModelForConfig(model);

    // 🆕 Model Registry - Backend Recommendation
    if (model.localPath) {
      try {
        const { getBackendRecommendation } = await import('../services/modelRegistry');
        const recommendation = await getBackendRecommendation(model.localPath);
        setBackendRecommendation(recommendation);

        // Auto-set GPU layers
        setGpuLayers(recommendation.gpuLayers);

        console.log('🎯 Backend Recommendation:', recommendation);

        // Show recommendation toast
        if (recommendation.warnings.length > 0) {
          showToast(recommendation.warnings[0], 'warning');
        } else {
          showToast(
            `✅ ${recommendation.backend.toUpperCase()} öneriliyor - ${recommendation.expectedPerformance} performans`,
            'success'
          );
        }
      } catch (error) {
        console.error('Backend recommendation error:', error);
      }
    }
  };

  const applyModelConfig = async () => {
    if (!selectedModelForConfig) return;

    setIsLoadingToGPU(true);
    setLoadingProgress(0);

    try {
      // 🔥 Context Length (INPUT) - Model'in alabileceği maksimum prompt uzunluğu
      // Max Tokens (OUTPUT) - AI'nın üretebileceği maksimum cevap uzunluğu
      const modelContextLength = contextLength; // UI'daki slider (32K default)
      const maxOutputTokens =
        outputMode === 'brief' ? 2048 :
          outputMode === 'detailed' ? 16384 : 8192;

      // Output mode'u localStorage'a kaydet (ai.ts kullanacak)
      localStorage.setItem('ai-output-mode', outputMode);

      console.log('📏 Context Length (INPUT):', modelContextLength);
      console.log('📤 Max Tokens (OUTPUT):', maxOutputTokens, `(${outputMode})`);

      // GGUF model config'ini localStorage'a kaydet
      const ggufConfig = {
        modelPath: selectedModelForConfig.localPath,
        contextLength: modelContextLength, // INPUT context length
        gpuLayers: gpuLayers,
        modelName: selectedModelForConfig.displayName
      };

      localStorage.setItem('gguf-active-model', JSON.stringify(ggufConfig));
      console.log('💾 GGUF model config kaydedildi:', ggufConfig);

      // Context ve GPU layers ayarlarını modele uygula
      const updatedModel = {
        ...selectedModelForConfig,
        contextLength: modelContextLength // INPUT context length
      };

      setLoadingProgress(5);

      // 🆕 Simüle edilmiş progress bar (model yükleme sırasında)
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev < 90) {
            // Yavaş yavaş artır (model yükleme uzun sürebilir)
            return prev + Math.random() * 3;
          }
          return prev;
        });
      }, 500);

      // 🆕 Modeli GPU'ya yükle
      console.log('🔄 Model GPU\'ya yükleniyor...');
      console.log('🔄 Context Length (INPUT):', modelContextLength);
      console.log('🔄 Max Tokens (OUTPUT):', maxOutputTokens);
      console.log('🔬 Sampling Params:', { temperature, topP, topK, repeatPenalty, minP });
      const { loadGgufModel } = await import('../services/ggufProvider');

      // Model yükleme işlemi
      await loadGgufModel({
        modelPath: ggufConfig.modelPath!,
        contextLength: modelContextLength, // INPUT - 32K olmalı
        gpuLayers: ggufConfig.gpuLayers,
        temperature: temperature,
        topP: topP,
        topK: topK,
        repeatPenalty: repeatPenalty,
        minP: minP,
        maxTokens: maxOutputTokens // OUTPUT - 4096 sabit
      });

      // Progress interval'i durdur
      clearInterval(progressInterval);
      setLoadingProgress(92);

      console.log('✅ Model GPU\'ya yüklendi!');

      // 🆕 Aktif GPU modelini güncelle
      setActiveGpuModel(ggufConfig.modelPath!);
      setLoadingProgress(94);

      // 🆕 Model yüklendikten sonra metadata'yı otomatik oku
      try {
        const metadata = await invoke<any>('read_gguf_metadata', { path: ggufConfig.modelPath });
        setModelMetadata(metadata);
        console.log('📊 Metadata otomatik okundu:', Object.keys(metadata).length, 'alan');
      } catch (error) {
        console.warn('⚠️ Metadata okunamadı:', error);
        // Hata olsa bile devam et
      }

      // 🆕 GGUF modelini AI Settings'e ekle
      const savedProvidersForUpdate = localStorage.getItem('corex-ai-providers');
      if (savedProvidersForUpdate) {
        try {
          const providers = JSON.parse(savedProvidersForUpdate);
          const ggufProvider = providers.find((p: any) => p.id === 'gguf-direct');

          setLoadingProgress(96);

          if (ggufProvider) {
            // Modeli GGUF provider'a ekle (eğer yoksa)
            const modelExists = ggufProvider.models.some((m: any) => m.id === selectedModelForConfig.id);

            // ÖNCE tüm GGUF modellerini deaktif et (Tek model kuralı)
            ggufProvider.models = ggufProvider.models.map((m: any) => ({ ...m, isActive: false }));

            if (!modelExists) {
              // Yeni model ekle ve aktif et
              ggufProvider.models.push({
                id: selectedModelForConfig.id,
                name: selectedModelForConfig.name,
                displayName: selectedModelForConfig.displayName,
                description: selectedModelForConfig.description,
                specialty: 'GGUF Model',
                maxTokens: maxOutputTokens,
                contextLength: modelContextLength,
                temperature: 0.7,
                isActive: true
              });
              console.log('✅ Yeni model eklendi ve aktif edildi:', selectedModelForConfig.displayName);
            } else {
              // Mevcut modeli güncelle ve aktif et
              ggufProvider.models = ggufProvider.models.map((m: any) =>
                m.id === selectedModelForConfig.id
                  ? { ...m, isActive: true, maxTokens: maxOutputTokens, contextLength: modelContextLength }
                  : m
              );
              console.log('✅ Mevcut model aktif edildi:', selectedModelForConfig.displayName);
            }

            setLoadingProgress(98);
            ggufProvider.isActive = true;

            // Diğer provider'ların modellerini pasif yap
            providers.forEach((p: any) => {
              if (p.id !== 'gguf-direct') {
                p.models = p.models.map((m: any) => ({ ...m, isActive: false }));
                p.isActive = false;
              }
            });

            localStorage.setItem('corex-ai-providers', JSON.stringify(providers));
            window.dispatchEvent(new CustomEvent('ai-providers-updated', { detail: providers }));
          } else {
            // GGUF provider yoksa oluştur
            const newGgufProvider = {
              id: 'gguf-direct',
              name: 'GGUF Direct',
              displayName: 'GGUF Models (GPU)',
              description: 'Yerel GGUF modelleri doğrudan GPU\'da çalıştırır',
              baseUrl: 'internal://gguf',
              apiKey: '',
              isActive: true,
              models: [{
                id: selectedModelForConfig.id,
                name: selectedModelForConfig.name,
                displayName: selectedModelForConfig.displayName,
                description: selectedModelForConfig.description,
                specialty: 'GGUF Model',
                maxTokens: maxOutputTokens,
                contextLength: modelContextLength,
                temperature: 0.7,
                isActive: true
              }]
            };

            providers.forEach((p: any) => {
              p.isActive = false;
              p.models = p.models.map((m: any) => ({ ...m, isActive: false }));
            });

            providers.push(newGgufProvider);
            localStorage.setItem('corex-ai-providers', JSON.stringify(providers));
            window.dispatchEvent(new CustomEvent('ai-providers-updated', { detail: providers }));
          }
        } catch (error) {
          console.error('❌ AI Settings güncelleme hatası:', error);
        }
      }

      setLoadingProgress(100);

      // 🆕 Kullanım istatistiklerini güncelle
      updateModelUsage(selectedModelForConfig.id);

      onModelSelect(updatedModel);
      setSelectedModelForConfig(null);

      setTimeout(() => {
        setIsLoadingToGPU(false);
        setLoadingProgress(0);
        showToast(`${selectedModelForConfig.displayName} GPU'ya yüklendi! Context: ${(modelContextLength / 1000).toFixed(0)}K, Output: ${maxOutputTokens}`, 'success');
      }, 500);

    } catch (error) {
      console.error('❌ Model yükleme hatası:', error);
      setIsLoadingToGPU(false);
      setLoadingProgress(0);
      showToast(`Model yükleme hatası: ${error}`, 'error');
    }
  };

  const deleteModel = (modelId: string) => {
    if (confirm('Bu modeli listeden kaldırmak istediğinize emin misiniz?')) {
      const newModels = models.filter(m => m.id !== modelId);
      saveModels(newModels);
    }
  };

  // 🆕 Favori toggle
  const toggleFavorite = (modelId: string) => {
    const newModels = models.map(m =>
      m.id === modelId ? { ...m, isFavorite: !m.isFavorite } : m
    );
    saveModels(newModels);

    const model = newModels.find(m => m.id === modelId);
    if (model) {
      showToast(
        model.isFavorite ? `⭐ ${model.displayName} favorilere eklendi` : `${model.displayName} favorilerden çıkarıldı`,
        'success'
      );
    }
  };

  // 🆕 Benchmark çalıştır
  const runBenchmark = async (model: GGUFModel) => {
    if (!model.localPath) {
      showToast('Model indirilmemiş!', 'error');
      return;
    }

    if (!confirm(`${model.displayName} için benchmark çalıştırılsın mı?\n\nBu işlem ~2 dakika sürebilir.`)) {
      return;
    }

    setIsBenchmarking(true);
    showToast('Benchmark başlatılıyor...', 'info');

    try {
      const { runBenchmark: runBench } = await import('../services/benchmarkService');
      const result = await runBench(model.localPath, contextLength, gpuLayers);

      // 🆕 Performans logunu kaydet
      savePerformanceLog(model.id, model.displayName, result.averageTokensPerSecond);

      showToast(
        `Benchmark tamamlandı! Hız: ${result.averageTokensPerSecond.toFixed(1)} token/s`,
        'success'
      );

      console.log('📊 Benchmark sonucu:', result);
    } catch (error) {
      console.error('❌ Benchmark hatası:', error);
      showToast(`Benchmark hatası: ${error}`, 'error');
    } finally {
      setIsBenchmarking(false);
    }
  };

  // 🆕 GGUF Metadata Okuyucu - Model Registry ile
  const readModelMetadata = async (modelPath: string) => {
    try {
      showToast('Metadata okunuyor...', 'info');

      // Model Registry kullan
      const { readModelMetadata: readMeta } = await import('../services/modelRegistry');
      const metadata = await readMeta(modelPath);

      setModelMetadata(metadata);

      // Show detailed info
      const info = `
📊 Model Bilgileri:
• Parametre: ${metadata.parameters}B
• Quantization: ${metadata.quantization}
• Context: ${(metadata.contextLength / 1000).toFixed(0)}K tokens
• Boyut: ${metadata.fileSizeGB.toFixed(1)} GB

🎮 VRAM Gereksinimleri:
• Minimum: ${metadata.estimatedVRAM.min} GB
• Önerilen: ${metadata.estimatedVRAM.recommended} GB
• Full Context: ${metadata.estimatedVRAM.withContext} GB

⚡ Backend Önerisi:
• ${metadata.recommendedBackend.toUpperCase()}
• GPU Layers: ${metadata.recommendedGPULayers}/33
      `.trim();

      console.log(info);
      showToast('Metadata başarıyla okundu!', 'success');
    } catch (error) {
      console.error('Metadata okuma hatası:', error);
      showToast(`Metadata okuma hatası: ${error}`, 'error');
    }
  };

  // 🆕 Performans logu kaydet
  const savePerformanceLog = (modelId: string, modelName: string, tokensPerSecond: number) => {
    const newLog = {
      timestamp: Date.now(),
      modelId,
      modelName,
      tokensPerSecond,
      contextLength,
      gpuLayers,
      temperature
    };

    const updatedLogs = [newLog, ...performanceLogs].slice(0, 50); // Son 50 log
    setPerformanceLogs(updatedLogs);
    localStorage.setItem('gguf-performance-logs', JSON.stringify(updatedLogs));
  };

  // 🆕 İndirme kuyruğuna ekle
  const addToDownloadQueue = (model: GGUFModel) => {
    if (downloadQueue.some(m => m.id === model.id)) {
      showToast('Model zaten kuyrukta!', 'warning');
      return;
    }

    setDownloadQueue([...downloadQueue, model]);
    showToast(`${model.displayName} kuyruğa eklendi`, 'success');
  };

  // 🆕 Kuyruktan indir
  const processDownloadQueue = async () => {
    if (downloadQueue.length === 0) {
      showToast('Kuyruk boş!', 'warning');
      return;
    }

    for (const model of downloadQueue) {
      await downloadModel(model);
      setDownloadQueue(prev => prev.filter(m => m.id !== model.id));
    }

    showToast('Tüm indirmeler tamamlandı!', 'success');
  };

  // 🆕 Otomatik model önerileri
  const getModelSuggestions = () => {
    const suggestions: Array<{ reason: string; model: GGUFModel }> = [];

    // En çok kullanılan model
    const mostUsed = [...models].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))[0];
    if (mostUsed && mostUsed.usageCount && mostUsed.usageCount > 0) {
      suggestions.push({
        reason: '⭐ En çok kullandığınız model',
        model: mostUsed
      });
    }

    // En son kullanılan model
    const recentlyUsed = [...models].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))[0];
    if (recentlyUsed && recentlyUsed.lastUsed) {
      suggestions.push({
        reason: '🕐 En son kullandığınız model',
        model: recentlyUsed
      });
    }

    // Favori modeller
    const favorites = models.filter(m => m.isFavorite);
    if (favorites.length > 0) {
      suggestions.push({
        reason: `⭐ ${favorites.length} favori modeliniz var`,
        model: favorites[0]
      });
    }

    // Performans bazlı öneri (en hızlı model)
    if (performanceLogs.length > 0) {
      const fastestLog = [...performanceLogs].sort((a, b) => b.tokensPerSecond - a.tokensPerSecond)[0];
      const fastestModel = models.find(m => m.id === fastestLog.modelId);
      if (fastestModel) {
        suggestions.push({
          reason: `⚡ En hızlı model (${fastestLog.tokensPerSecond.toFixed(1)} token/s)`,
          model: fastestModel
        });
      }
    }

    return suggestions;
  };

  // 🧹 Temizlik fonksiyonları
  const getUnusedModels = (days: number) => {
    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    return models.filter(m => {
      // Favoriler hariç
      if (m.isFavorite) return false;
      // Hiç kullanılmamış veya X gün önce kullanılmış
      return !m.lastUsed || m.lastUsed < cutoffDate;
    });
  };

  const getNeverUsedModels = () => {
    return models.filter(m => !m.isFavorite && !m.lastUsed && m.isDownloaded);
  };

  const getTotalDiskUsage = () => {
    return models
      .filter(m => m.isDownloaded)
      .reduce((total, m) => total + m.sizeBytes, 0);
  };

  const getCleanupSuggestions = () => {
    const suggestions = [];

    // Hiç kullanılmayanlar
    const neverUsed = getNeverUsedModels();
    if (neverUsed.length > 0) {
      const totalSize = neverUsed.reduce((sum, m) => sum + m.sizeBytes, 0);
      suggestions.push({
        priority: 'high',
        title: 'Hiç Kullanılmayan Modeller',
        models: neverUsed,
        savings: totalSize,
        reason: 'Bu modeller hiç kullanılmadı'
      });
    }

    // 60+ gün kullanılmayanlar
    const unused60 = getUnusedModels(60);
    if (unused60.length > 0) {
      const totalSize = unused60.reduce((sum, m) => sum + m.sizeBytes, 0);
      suggestions.push({
        priority: 'medium',
        title: '60+ Gün Kullanılmayan',
        models: unused60,
        savings: totalSize,
        reason: '60 günden fazla kullanılmadı'
      });
    }

    // 30+ gün kullanılmayanlar
    const unused30 = getUnusedModels(30);
    if (unused30.length > 0) {
      const totalSize = unused30.reduce((sum, m) => sum + m.sizeBytes, 0);
      suggestions.push({
        priority: 'low',
        title: '30+ Gün Kullanılmayan',
        models: unused30,
        savings: totalSize,
        reason: '30 günden fazla kullanılmadı'
      });
    }

    return suggestions;
  };

  const cleanupSelectedModels = () => {
    if (selectedForCleanup.length === 0) {
      showToast('Silinecek model seçilmedi', 'warning');
      return;
    }

    const confirmMsg = `${selectedForCleanup.length} model silinecek. Emin misiniz?\n\nBu işlem geri alınamaz!`;
    if (!confirm(confirmMsg)) return;

    const newModels = models.filter(m => !selectedForCleanup.includes(m.id));
    saveModels(newModels);
    setSelectedForCleanup([]);
    setShowCleanupModal(false);

    showToast(`${selectedForCleanup.length} model temizlendi!`, 'success');
  };

  // 🆕 GPU'dan model kaldır
  const unloadFromGPU = async (modelPath?: string) => {
    if (!confirm(modelPath ? `Bu modeli GPU'dan kaldırmak istediğinize emin misiniz?` : 'TÜM modelleri GPU\'dan kaldırmak istediğinize emin misiniz?')) {
      return;
    }

    try {
      console.log('🔄 Model(ler) GPU\'dan kaldırılıyor...');

      const { unloadGgufModel } = await import('../services/ggufProvider');
      await unloadGgufModel(); // TODO: Backend'de spesifik model unload eklenebilir, şimdilik hepsi

      // localStorage'dan aktif model config'ini temizle
      if (!modelPath) {
        localStorage.removeItem('gguf-active-model');
        setActiveGpuModel(null);
      }

      // AI Settings'de GGUF modellerini güncelle
      const savedProviders = localStorage.getItem('corex-ai-providers');
      if (savedProviders) {
        try {
          const providers = JSON.parse(savedProviders);
          const ggufProvider = providers.find((p: any) => p.id === 'gguf-direct');

          if (ggufProvider) {
            if (modelPath) {
              // Sadece spesifik modeli pasif yap
              ggufProvider.models = ggufProvider.models.map((m: any) =>
                m.localPath === modelPath ? { ...m, isActive: false } : m
              );
            } else {
              // Tüm GGUF modellerini pasif yap
              ggufProvider.models = ggufProvider.models.map((m: any) => ({ ...m, isActive: false }));
              ggufProvider.isActive = false;
            }

            localStorage.setItem('corex-ai-providers', JSON.stringify(providers));

            // Provider güncelleme eventi gönder
            window.dispatchEvent(new CustomEvent('ai-providers-updated', {
              detail: providers
            }));
          }
        } catch (error) {
          console.error('❌ AI Settings güncelleme hatası:', error);
        }
      }

      console.log('✅ Model(ler) GPU\'dan kaldırıldı');
      showToast('Model(ler) GPU\'dan başarıyla kaldırıldı!', 'success');

    } catch (error) {
      console.error('❌ GPU unload hatası:', error);
      showToast(`Model kaldırma hatası: ${error}`, 'error');
    }
  };

  const filteredModels = models
    .filter(model => {
      // Arama filtresi - TÜM modeller gösterilir
      const matchesSearch = model.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description.toLowerCase().includes(searchQuery.toLowerCase());

      // Kategori filtresi
      if (filterBy === 'favorites' && !model.isFavorite) return false;
      if (filterBy === 'downloaded' && !model.isDownloaded) return false;

      // ⚠️ BOYUT/PARAMETER KIŞITLAMALARI KALDIRILDI
      // Kullanıcı istediği herhangi bir GGUF dosyasını indirip kullanabilir
      // Sistem çalışıp çalışmadığını runtime'da belirler

      return matchesSearch;
    })
    .sort((a, b) => {
      // Sıralama
      switch (sortBy) {
        case 'name':
          return a.displayName.localeCompare(b.displayName);
        case 'size':
          return b.sizeBytes - a.sizeBytes;
        case 'recent':
          return (b.lastUsed || 0) - (a.lastUsed || 0);
        case 'usage':
          return (b.usageCount || 0) - (a.usageCount || 0);
        default:
          return 0;
      }
    });

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
          <>
            <div className="mb-2 flex gap-2 items-start">
              {/* Sol: Filtre Butonları */}
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => setFilterBy('all')}
                  className={`px-2 py-1 rounded text-xs ${filterBy === 'all'
                    ? 'bg-blue-600 text-[var(--color-text)]'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                  📋 Tümü ({models.length})
                </button>
                <button
                  onClick={() => setFilterBy('favorites')}
                  className={`px-2 py-1 rounded text-xs ${filterBy === 'favorites'
                    ? 'bg-yellow-600 text-[var(--color-text)]'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                  ⭐ Favoriler ({models.filter(m => m.isFavorite).length})
                </button>
                <button
                  onClick={() => setFilterBy('downloaded')}
                  className={`px-2 py-1 rounded text-xs ${filterBy === 'downloaded'
                    ? 'bg-green-600 text-[var(--color-text)]'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                  ✓ İndirilmiş ({models.filter(m => m.isDownloaded).length})
                </button>

                {/* Gelişmiş Filtre Butonu */}
                <button
                  onClick={() => setShowFilterModal(true)}
                  className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs whitespace-nowrap"
                  title="Gelişmiş filtreler ve arama"
                >
                  🔍 Filtreler
                </button>
              </div>

              {/* Sağ: Kompakt Bilgi Kutuları */}
              <div className="flex gap-2 flex-1 overflow-x-auto">
                {/* Otomatik Öneriler */}
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
                                <button
                                  onClick={() => handleModelSelect(suggestion.model)}
                                  className="px-1 py-0.5 bg-cyan-600 hover:bg-cyan-700 rounded text-xs ml-1"
                                >
                                  ⚙️
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* İndirme Kuyruğu */}
                {downloadQueue.length > 0 && (
                  <div className="flex-shrink-0 w-48 p-1.5 bg-orange-900/20 border border-orange-500/30 rounded">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-orange-400">📥 Kuyruk ({downloadQueue.length})</span>
                      <button
                        onClick={processDownloadQueue}
                        className="px-1 py-0.5 bg-orange-600 hover:bg-orange-700 rounded text-xs"
                      >
                        ▶️
                      </button>
                    </div>
                    <div className="space-y-0.5 max-h-16 overflow-y-auto">
                      {downloadQueue.slice(0, 2).map((model, index) => (
                        <div key={model.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-300 truncate">#{index + 1} {model.displayName}</span>
                          <button
                            onClick={() => setDownloadQueue(prev => prev.filter(m => m.id !== model.id))}
                            className="text-red-400 hover:text-red-300 ml-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Model listesi */}
        {models.length > 0 && (
          <div className="mb-2">
            <span className="text-xs text-gray-400">
              {filteredModels.length} model gösteriliyor
            </span>
          </div>
        )}

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredModels.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              <p className="mb-2">📦 Henüz model eklenmemiş</p>
              <p className="text-xs">Yukarıdaki "📄 Dosya Ekle" butonuna tıklayarak GGUF model ekleyin</p>
              <p className="text-xs mt-1">veya 🤗 Hugging Face'den model arayın</p>
            </div>
          )}

          {filteredModels.map(model => {
            const requirements = calculateRequirements(model, contextLength);
            const quantInfo = QUANT_INFO[model.quantization];

            return (
              <div key={model.id} className={`p-2 rounded border text-xs ${model.isDownloaded ? 'border-green-500 bg-green-900/10' : 'border-gray-600 bg-gray-800/50'} hover:border-blue-500 transition-colors`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      {/* 🆕 Favori Yıldızı */}
                      <button
                        onClick={() => toggleFavorite(model.id)}
                        className={`text-sm ${model.isFavorite ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'} transition-colors`}
                        title={model.isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                      >
                        {model.isFavorite ? '⭐' : '☆'}
                      </button>
                      <h4 className="font-semibold text-white truncate">{model.displayName}</h4>
                      {model.isDownloaded && <span className="text-green-400 text-xs">✓</span>}
                      {activeGpuModel === model.localPath && <span className="text-blue-400 text-xs animate-pulse" title="GPU'da aktif">🎮</span>}
                      {/* 🆕 Kullanım Sayısı */}
                      {model.usageCount && model.usageCount > 0 && (
                        <span className="text-xs text-gray-500" title={`${model.usageCount} kez kullanıldı`}>
                          ({model.usageCount}×)
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs mb-1 truncate">{model.description}</p>
                    <div className="flex flex-wrap gap-1 text-xs">
                      {model.size !== 'Bilinmiyor' && <span className="px-1.5 py-0.5 bg-gray-700 rounded">{model.size}</span>}
                      <span className="px-1.5 py-0.5 bg-blue-700 rounded">{model.quantization}</span>
                      {model.parameters && <span className="px-1.5 py-0.5 bg-purple-700 rounded">{model.parameters}</span>}
                      {/* 🆕 Son Kullanım */}
                      {model.lastUsed && (
                        <span className="px-1.5 py-0.5 bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-textSecondary)]" title="Son kullanım">
                          🕐 {new Date(model.lastUsed).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>

                    {/* İndirme Progress Bar */}
                    {model.isDownloading && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-blue-400">⬇️ İndiriliyor...</span>
                          <span className="text-white font-semibold">
                            {model.downloadProgress?.toFixed(1) || 0}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-500 h-full transition-all duration-300 ease-out"
                            style={{ width: `${model.downloadProgress || 0}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>
                            {((model.downloadedBytes || 0) / (1024 ** 3)).toFixed(2)} GB / {model.size}
                          </span>
                          <span>
                            {(() => {
                              if (!model.downloadProgress || model.downloadProgress === 0) {
                                return 'Başlatılıyor...';
                              }
                              if (model.downloadProgress >= 100) {
                                return 'Tamamlandı!';
                              }

                              // Gerçek indirme hızını hesapla
                              const elapsedSeconds = (Date.now() - (model.downloadStartTime || Date.now())) / 1000;
                              const downloadedBytes = model.downloadedBytes || 0;
                              const totalBytes = model.sizeBytes;
                              const remainingBytes = totalBytes - downloadedBytes;

                              if (elapsedSeconds < 2) {
                                return 'Hesaplanıyor...';
                              }

                              const bytesPerSecond = downloadedBytes / elapsedSeconds;
                              const speedMBps = (bytesPerSecond / (1024 * 1024)).toFixed(1);
                              const remainingSeconds = Math.ceil(remainingBytes / bytesPerSecond);

                              let timeStr = '';
                              if (remainingSeconds < 60) {
                                timeStr = `${remainingSeconds} sn`;
                              } else if (remainingSeconds < 3600) {
                                timeStr = `${Math.ceil(remainingSeconds / 60)} dk`;
                              } else {
                                timeStr = `${(remainingSeconds / 3600).toFixed(1)} saat`;
                              }

                              return `${speedMBps} MB/s • ~${timeStr}`;
                            })()}
                          </span>
                        </div>
                      </div>
                    )}

                    {showRequirements === model.id && model.sizeBytes > 0 && (
                      <div className="mt-2 p-2 bg-gray-900 rounded text-xs space-y-1">
                        <div className="flex justify-between"><span>💾 Min RAM:</span><span className="font-semibold">{requirements.minRAM} GB</span></div>
                        <div className="flex justify-between"><span>🎮 Min VRAM:</span><span className="font-semibold">{requirements.minVRAM} GB</span></div>
                        <div className="flex justify-between"><span>💾 Önerilen RAM:</span><span className="font-semibold text-green-400">{requirements.recommendedRAM} GB</span></div>
                        <div className="flex justify-between"><span>🎮 Önerilen VRAM:</span><span className="font-semibold text-green-400">{requirements.recommendedVRAM} GB</span></div>
                        {quantInfo && <div className="pt-1 border-t border-gray-700"><span className="text-gray-400">{quantInfo.quality}</span></div>}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    {model.sizeBytes > 0 && (
                      <button onClick={() => setShowRequirements(showRequirements === model.id ? null : model.id)} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs whitespace-nowrap" title="Sistem gereksinimleri">ℹ️</button>
                    )}
                    {model.isDownloaded && (
                      <>
                        <button onClick={() => handleModelSelect(model)} className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs whitespace-nowrap" title="Ayarla ve Kullan">⚙️</button>
                        <button
                          onClick={() => runBenchmark(model)}
                          disabled={isBenchmarking}
                          className={`px-2 py-1 rounded text-xs whitespace-nowrap ${isBenchmarking
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-yellow-600 hover:bg-yellow-700 text-[var(--color-text)]'
                            }`}
                          title="Hız testi yap"
                        >
                          {isBenchmarking ? '⏳' : '⚡'}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedModelForConfig(model);
                            readModelMetadata(model.localPath!);
                          }}
                          className="px-2 py-1 bg-cyan-600 hover:bg-cyan-700 rounded text-xs whitespace-nowrap"
                          title="Metadata oku"
                        >
                          📊
                        </button>
                      </>
                    )}
                    {!model.isDownloaded && !model.isDownloading && (
                      <button
                        onClick={() => addToDownloadQueue(model)}
                        className="px-2 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs whitespace-nowrap"
                        title="Kuyruğa ekle"
                      >
                        📥
                      </button>
                    )}
                    <button onClick={() => deleteModel(model.id)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs whitespace-nowrap" title="Listeden Kaldır">🗑️</button>
                    {model.huggingFaceUrl && <a href={model.huggingFaceUrl} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded text-xs text-center" title="Hugging Face'de aç">🤗</a>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sağ Panel - Model Ayarları */}
      {selectedModelForConfig && (
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

          {/* 🆕 Sekme Sistemi - Sadece Temel, Gelişmiş, Loglar, Geçmiş */}
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

              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${gpuMemory.usage_percent > 90 ? 'bg-red-500' :
                    gpuMemory.usage_percent > 75 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                  style={{ width: `${Math.min(gpuMemory.usage_percent, 100)}%` }}
                />
              </div>

              {/* Detaylar */}
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
            <div className="space-y-2">
              {/* Context Length - Preset Butonlar */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--color-text)]">
                  📝 Bağlam Uzunluğu
                </label>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-400">Seçili:</span>
                  <span className="text-xs font-semibold text-[var(--color-text)]">{contextLength.toLocaleString()}</span>
                </div>

                {/* Preset Butonlar */}
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

              {/* 🆕 Output Mode - Cevap Uzunluğu */}
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
                      className={`px-2 py-2 rounded text-xs font-medium transition-all ${outputMode === mode.value
                        ? `bg-${mode.color}-600 text-[var(--color-text)] border-2 border-${mode.color}-400`
                        : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                        }`}
                    >
                      <div className="font-bold">{mode.label}</div>
                      <div className="text-xs opacity-75">{mode.tokens}</div>
                      <div className="text-xs opacity-75 leading-tight">{mode.desc}</div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-tight">
                  {outputMode === 'brief' && '⚡ Kısa ve öz cevaplar (2048 token)'}
                  {outputMode === 'normal' && '✅ Normal uzunlukta cevaplar (8192 token)'}
                  {outputMode === 'detailed' && '📚 Detaylı ve kapsamlı cevaplar (16384 token)'}
                </p>
                <div className="mt-1.5 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
                  <p className="text-xs text-blue-300">
                    💡 <strong>Context (INPUT):</strong> {(contextLength / 1024).toFixed(0)}K - Modele gönderebileceğiniz maksimum prompt uzunluğu
                  </p>
                  <p className="text-xs text-blue-300 mt-0.5">
                    💡 <strong>Output:</strong> {outputMode === 'brief' ? '2K' : outputMode === 'detailed' ? '16K' : '8K'} - AI'nın üretebileceği maksimum cevap uzunluğu
                  </p>
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
                      <span className="text-[var(--color-text)] font-semibold">{backendRecommendation.gpuLayers}/33</span>
                    </div>
                    <p className="text-gray-300 mt-1.5 leading-relaxed">{backendRecommendation.reason}</p>

                    {backendRecommendation.warnings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {backendRecommendation.warnings.map((warning, index) => (
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

              {/* GPU Layers */}
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[var(--color-text)]">
                  🎮 GPU Offload
                </label>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">Layers</span>
                  <span className="text-xs font-semibold text-[var(--color-text)]">{gpuLayers}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={gpuLayers}
                  onChange={(e) => setGpuLayers(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                  <span>CPU</span>
                  <span>Hibrit</span>
                  <span>GPU</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-tight">
                  {gpuLayers === 0 && '🖥️ Sadece CPU'}
                  {gpuLayers > 0 && gpuLayers < 20 && '⚡ CPU + GPU'}
                  {gpuLayers >= 20 && '🚀 Çoğunlukla GPU'}
                </p>
              </div>

              {/* Sistem Gereksinimleri */}
              {selectedModelForConfig.sizeBytes > 0 && (
                <div className="p-2 bg-gray-900 rounded text-xs space-y-0.5">
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

              {/* Uygula Butonu */}
              <button
                onClick={applyModelConfig}
                disabled={isLoadingToGPU}
                className={`w-full px-3 py-2 ${isLoadingToGPU ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-[var(--color-text)] rounded font-medium text-xs`}
              >
                {isLoadingToGPU ? '⏳ Yükleniyor...' : '✓ Ayarları Uygula ve Kullan'}
              </button>

              {/* 🆕 GPU'dan Kaldır Butonu */}
              {activeGpuModel && (
                <button
                  onClick={() => unloadFromGPU()}
                  className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-[var(--color-text)] rounded font-medium text-xs"
                >
                  🎮 GPU'dan Kaldır
                </button>
              )}
            </div>
          )}

          {/* 🔬 Gelişmiş Ayarlar Sekmesi */}
          {activeTab === 'advanced' && (
            <div className="space-y-2">
              {/* Temperature */}
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
                  {temperature < 0.3 && '❄️ Çok düşük'}
                  {temperature >= 0.3 && temperature < 0.7 && '🎯 Düşük'}
                  {temperature >= 0.7 && temperature < 1.2 && '⚖️ Dengeli'}
                  {temperature >= 1.2 && temperature < 1.6 && '🎨 Yüksek'}
                  {temperature >= 1.6 && '🔥 Çok yüksek'}
                </p>
              </div>

              {/* Top-P */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-xs font-medium text-[var(--color-text)]">🎲 Top-P</label>
                  <span className="text-xs font-semibold text-[var(--color-text)]">{topP.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={topP}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  className="w-full h-1"
                />
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                  {topP < 0.5 && '🎯 Çok dar'}
                  {topP >= 0.5 && topP < 0.8 && '📊 Dar'}
                  {topP >= 0.8 && topP < 0.95 && '⚖️ Dengeli'}
                  {topP >= 0.95 && '🌈 Geniş'}
                </p>
              </div>

              {/* Top-K */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-xs font-medium text-[var(--color-text)]">🔢 Top-K</label>
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
                  {topK <= 10 && '🎯 Çok dar'}
                  {topK > 10 && topK <= 40 && '⚖️ Dengeli'}
                  {topK > 40 && topK <= 70 && '🌈 Geniş'}
                  {topK > 70 && '🔥 Çok geniş'}
                </p>
              </div>

              {/* Repeat Penalty */}
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

              {/* Min-P */}
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

              {/* Preset Butonları */}
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

              {/* Bilgi Kutusu - Daha Kompakt */}
              <div className="p-1.5 bg-blue-900/20 border border-blue-500/30 rounded">
                <p className="text-xs text-blue-300 leading-tight">
                  💡 Kod: 0.1-0.3, Yaratıcı: 0.8-1.2
                </p>
              </div>

              {/* Uygula Butonu */}
              <button
                onClick={applyModelConfig}
                disabled={isLoadingToGPU}
                className={`w-full px-3 py-1.5 ${isLoadingToGPU ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-[var(--color-text)] rounded font-medium text-xs`}
              >
                {isLoadingToGPU ? '⏳ Yükleniyor...' : '✓ Gelişmiş Ayarları Uygula'}
              </button>

              {/* GPU'dan Kaldır Butonu */}
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
      )}

      {/* 🆕 Model Karşılaştırma Popup */}
      {showComparison && (
        <ModelComparison
          onClose={() => setShowComparison(false)}
        />
      )}

      {/* 🆕 Hugging Face Arama Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSearchModal(false)}>
          <div className="bg-gray-800 rounded-lg p-4 max-w-3xl w-full max-h-[80vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">🤗 Hugging Face Model Ara</h3>
              <button onClick={() => setShowSearchModal(false)} className="text-gray-400 hover:text-[var(--color-text)] text-xl">✕</button>
            </div>

            <div className="mb-3">
              <input
                type="text"
                placeholder="Model ara... (örn: tinyllama, qwen, phi, llama)"
                value={hfSearchQuery}
                onChange={(e) => setHfSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-[var(--color-text)] placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                autoFocus
              />
              {isSearching && <div className="mt-2 text-sm text-gray-400">🔄 Aranıyor...</div>}
            </div>

            {hfSearchResults.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[var(--color-text)]">📋 {hfSearchResults.length} sonuç bulundu</span>
                  <button onClick={() => setHfSearchResults([])} className="text-xs text-gray-400 hover:text-[var(--color-text)]">Temizle</button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {hfSearchResults.map(model => (
                    <div key={model.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-xl shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h5 className="font-semibold text-[var(--color-text)] text-sm mb-1">{model.displayName}</h5>
                          <p className="text-gray-400 text-xs mb-2">{model.description}</p>
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">{model.size}</span>
                            <span className="px-2 py-0.5 bg-blue-700 rounded text-xs">{model.quantization}</span>
                            {model.parameters && <span className="px-2 py-0.5 bg-purple-700 rounded text-xs">{model.parameters}</span>}
                            {model.downloads && <span className="px-2 py-0.5 bg-green-700 rounded text-xs">⬇️ {(model.downloads / 1000).toFixed(0)}K</span>}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => {
                              addModelFromSearch(model);
                              setShowSearchModal(false);
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs whitespace-nowrap"
                          >
                            + Ekle ve İndir
                          </button>
                          <button
                            onClick={() => addToDownloadQueue(model)}
                            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded text-xs whitespace-nowrap"
                          >
                            📥 Kuyruğa Ekle
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const { openUrl } = await import('@tauri-apps/plugin-opener');
                                await openUrl(model.huggingFaceUrl);
                              } catch (error) {
                                console.error('URL açma hatası:', error);
                                alert('Tarayıcı açılamadı: ' + error);
                              }
                            }}
                            className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 rounded text-xs whitespace-nowrap cursor-pointer"
                          >
                            🤗 Sayfasını Aç
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : hfSearchQuery.length > 0 && !isSearching ? (
              <div className="text-center py-8 text-gray-400">
                <p className="mb-2">🔍 Sonuç bulunamadı</p>
                <p className="text-xs">Farklı anahtar kelimeler deneyin</p>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p className="mb-2">🤗 Hugging Face'de model arayın</p>
                <p className="text-xs">Popüler modeller: tinyllama, qwen, phi, llama, mistral</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🆕 Gelişmiş Filtre Modal */}
      {showFilterModal && (
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
                <label className="block text-xs font-medium text-gray-400 mb-1.5">� Sıralama</label>
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

              {/* KALDIRILDI: Boyut Filtresi - Tüm modeleler gösterilir */}

              {/* KALDIRILDI: Quantization Filtresi - Tüm quantization desteklenir */}

              {/* KALDIRILDI: Parametre Filtresi - Tüm parametre boyutları desteklenir */}
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
      )}

      {/* 🧹 Temizlik Modal */}
      {showCleanupModal && (
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
      )}
    </div>
  );
}
