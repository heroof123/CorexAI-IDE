import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { showToast } from "./ToastContainer";
import GGUFModelBrowser from "./GGUFModelBrowser";
import {
  getAutonomyConfig,
  saveAutonomyConfig,
  getAutonomyLevelDescription,
  type AutonomyLevel
} from "../services/autonomy";
import { storage } from "../services/storage";

interface AIProvider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'local' | 'custom';
  baseUrl: string;
  host?: string; // 🆕 IP adresi
  port?: number; // 🆕 Port numarası
  apiKey?: string;
  models: AIModel[];
  isActive: boolean;
  icon: string;
  description: string;
}

interface AIModel {
  id: string;
  name: string;
  displayName: string;
  description: string;
  specialty: string;
  maxTokens?: number;
  temperature?: number;
  isActive: boolean;
}

interface AISettingsProps {
  isVisible: boolean;
  onClose: () => void;
  onProviderChange?: (providers: AIProvider[]) => void;
}

const defaultProviders: AIProvider[] = [
  {
    id: "lm-studio",
    name: "LM Studio (Local)",
    type: "local",
    baseUrl: "http://127.0.0.1:1234/v1",
    host: "127.0.0.1",
    port: 1234,
    models: [
      {
        id: "main",
        name: "qwen2.5-coder-7b-instruct",
        displayName: "Qwen2.5 Coder 7B",
        description: "Ana model - Planlama ve kodlama",
        specialty: "Planner + Coder",
        maxTokens: 4096,
        temperature: 0.5,
        isActive: false
      },
      {
        id: "chat",
        name: "qwen2.5-3b-instruct",
        displayName: "Qwen2.5 3B",
        description: "Hızlı sohbet ve basit görevler",
        specialty: "Hızlı Chat",
        maxTokens: 2048,
        temperature: 0.7,
        isActive: false
      }
    ],
    isActive: false,
    icon: "🖥️",
    description: "Yerel LM Studio sunucusu"
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    type: "local",
    baseUrl: "http://127.0.0.1:11434/v1",
    host: "127.0.0.1",
    port: 11434,
    models: [
      {
        id: "llama",
        name: "llama3.1:8b",
        displayName: "Llama 3.1 8B",
        description: "Meta'nın güçlü dil modeli",
        specialty: "Genel Amaçlı",
        maxTokens: 4096,
        temperature: 0.7,
        isActive: false
      }
    ],
    isActive: false,
    icon: "🦙",
    description: "Ollama yerel AI sunucusu"
  },
  {
    id: "gguf-direct",
    name: "GGUF (Direkt)",
    type: "local",
    baseUrl: "internal://gguf",
    models: [],
    isActive: false,
    icon: "📦",
    description: "GGUF dosyasını direkt çalıştır (LM Studio/Ollama gerekmez)"
  }
];

export default function AISettings({ isVisible, onClose, onProviderChange }: AISettingsProps) {
  const [providers, setProviders] = useState<AIProvider[]>(defaultProviders);
  const [activeTab, setActiveTab] = useState<'providers' | 'models' | 'autonomy' | 'add'>('providers');
  const [selectedProvider, setSelectedProvider] = useState<string>('lm-studio');
  const [connectionStatus, setConnectionStatus] = useState<Record<string, 'online' | 'offline' | 'checking' | 'connected' | 'error'>>({});
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>(3);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AIProvider>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null); // FIX-42

  // Yeni provider ekleme formu
  const [newProvider, setNewProvider] = useState<Partial<AIProvider>>({
    name: '',
    type: 'local',
    baseUrl: '',
    host: '127.0.0.1',
    port: 1234,
    apiKey: '',
    icon: '🤖',
    description: '',
    models: [],
    isActive: false
  });

  // Yeni model ekleme formu
  const [newModel, setNewModel] = useState<Partial<AIModel>>({
    name: '',
    displayName: '',
    description: '',
    specialty: '',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: true
  });

  // LocalStorage'dan ayarları yükle
  useEffect(() => {
    const loadData = async () => {
      const savedProviders = await storage.getSettings<AIProvider[]>('corex-ai-providers');
      const savedKeys = await storage.getSecure<Record<string, string>>('corex-ai-keys') || {};

      if (savedProviders) {
        // FIX-38: API Keyleri güvenli olarak birleştir
        const withKeys = savedProviders.map(p => ({
          ...p,
          apiKey: savedKeys[p.id] || p.apiKey
        }));

        // GGUF provider yoksa ekle (backward compatibility)
        const hasGguf = withKeys.some((p: AIProvider) => p.id === 'gguf-direct');
        if (!hasGguf) {
          const ggufProvider = defaultProviders.find(p => p.id === 'gguf-direct');
          if (ggufProvider) {
            const updated = [...withKeys, ggufProvider];
            setProviders(updated);
            await storage.setSettings('corex-ai-providers', updated);
          } else {
            setProviders(withKeys);
          }
        } else {
          setProviders(withKeys);
        }
      }

      // Load autonomy config
      const config = getAutonomyConfig();
      setAutonomyLevel(config.level);
    };

    loadData();
  }, []);

  // Ayarları kaydet
  const saveProviders = async (newProviders: AIProvider[]) => {
    setProviders(newProviders);

    // FIX-38: API Key'i normal ayarlardan sıyırıp ayrı yazıyoruz
    const safeProviders = newProviders.map(p => ({
      ...p,
      apiKey: undefined
    }));
    await storage.setSettings('corex-ai-providers', safeProviders);

    const keys: Record<string, string> = {};
    newProviders.forEach(p => { if (p.apiKey) keys[p.id] = p.apiKey; });
    await storage.setSecure('corex-ai-keys', keys);

    onProviderChange?.(newProviders);

    // Custom event gönder
    window.dispatchEvent(new CustomEvent('ai-providers-updated', {
      detail: newProviders
    }));
  };

  // Provider düzenleme başlat
  const startEditProvider = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      setEditingProvider(providerId);
      setEditForm({ ...provider });
    }
  };

  // Provider düzenleme kaydet
  const saveEditProvider = () => {
    // GGUF için host/port zorunlu değil
    if (!editingProvider) {
      return;
    }

    if (editForm.id !== 'gguf-direct' && (!editForm.host || !editForm.port)) {
      showToast('Host ve Port alanları zorunludur!', 'error'); // FIX-42
      return;
    }

    // URL formatını düzelt - çift http:// olmasını önle
    const cleanHost = editForm.host?.replace(/^https?:\/\//, '') || '';
    const baseUrl = `http://${cleanHost}:${editForm.port}/v1`;

    const newProviders = providers.map(p =>
      p.id === editingProvider
        ? {
          ...p,
          ...editForm,
          host: cleanHost,
          baseUrl: baseUrl
        }
        : p
    );

    saveProviders(newProviders);
    setEditingProvider(null);
    setEditForm({});

    // Otomatik bağlantı testi
    const updatedProvider = newProviders.find(p => p.id === editingProvider);
    if (updatedProvider) {
      testConnection(updatedProvider);
    }
  };

  // Provider düzenleme iptal
  const cancelEditProvider = () => {
    setEditingProvider(null);
    setEditForm({});
  };

  // Provider bağlantı testi
  const testConnection = async (provider: AIProvider) => {
    if (provider.id === 'gguf-direct') return; // GGUF test edilmez

    setConnectionStatus(prev => ({ ...prev, [provider.id]: 'checking' }));

    try {
      // FIX-41: Test securely via Rust backend (Bypasses CORS entirely)
      const isConnected = await invoke<boolean>('test_provider_connection', {
        baseUrl: provider.baseUrl,
        api_key: provider.apiKey || ''
      });

      if (isConnected) {
        setConnectionStatus(prev => ({ ...prev, [provider.id]: 'connected' }));
      } else {
        throw new Error('Bağlantı başarısız');
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, [provider.id]: 'error' }));
    }
  };

  // Provider'ı aktif/pasif yap
  const toggleProvider = (providerId: string) => {
    const newProviders = providers.map(p =>
      p.id === providerId ? { ...p, isActive: !p.isActive } : p
    );
    saveProviders(newProviders);
  };

  // Model'i aktif/pasif yap
  const toggleModel = (providerId: string, modelId: string) => {
    const newProviders = providers.map(p =>
      p.id === providerId
        ? {
          ...p,
          models: p.models.map(m =>
            m.id === modelId ? { ...m, isActive: !m.isActive } : m
          )
        }
        : p
    );
    saveProviders(newProviders);
  };

  // Yeni provider ekle
  const addProvider = () => {
    if (!newProvider.name || (!newProvider.baseUrl && (!newProvider.host || !newProvider.port))) {
      showToast('Provider adı ve (Base URL veya Host+Port) gerekli!', 'error'); // FIX-42
      return;
    }

    // Base URL'yi otomatik oluştur eğer host+port verilmişse
    let finalBaseUrl = newProvider.baseUrl;
    if (!finalBaseUrl && newProvider.host && newProvider.port) {
      const protocol = newProvider.type === 'openai' || newProvider.type === 'anthropic' ? 'https' : 'http';
      const cleanHost = newProvider.host.replace(/^https?:\/\//, ''); // Çift protokol önle
      finalBaseUrl = `${protocol}://${cleanHost}:${newProvider.port}/v1`;
    }

    const provider: AIProvider = {
      id: `custom-${Date.now()}`,
      name: newProvider.name!,
      type: newProvider.type!,
      baseUrl: finalBaseUrl!,
      host: newProvider.host?.replace(/^https?:\/\//, ''), // Temiz host
      port: newProvider.port,
      apiKey: newProvider.apiKey,
      icon: newProvider.icon!,
      description: newProvider.description!,
      models: [],
      isActive: false
    };

    saveProviders([...providers, provider]);

    // Formu temizle
    setNewProvider({
      name: '',
      type: 'local',
      baseUrl: '',
      host: '127.0.0.1',
      port: 1234,
      apiKey: '',
      icon: '🤖',
      description: '',
      models: [],
      isActive: false
    });

    setActiveTab('providers');

    // Otomatik test
    setTimeout(() => testConnection(provider), 500);
  };

  // Yeni model ekle
  const addModel = () => {
    if (!newModel.name || !newModel.displayName || !selectedProvider) {
      showToast('Model adı, görünen ad ve provider seçimi gerekli!', 'error'); // FIX-42
      return;
    }

    const model: AIModel = {
      id: `model-${Date.now()}`,
      name: newModel.name!,
      displayName: newModel.displayName!,
      description: newModel.description!,
      specialty: newModel.specialty!,
      maxTokens: newModel.maxTokens,
      temperature: newModel.temperature,
      isActive: true
    };

    const newProviders = providers.map(p =>
      p.id === selectedProvider
        ? { ...p, models: [...p.models, model] }
        : p
    );

    saveProviders(newProviders);

    // Formu temizle
    setNewModel({
      name: '',
      displayName: '',
      description: '',
      specialty: '',
      maxTokens: 4096,
      temperature: 0.7,
      isActive: true
    });
  };

  // Provider sil
  const deleteProvider = (providerId: string) => {
    const newProviders = providers.filter(p => p.id !== providerId);
    saveProviders(newProviders);
    setDeleteConfirm(null);
  };

  // Mevcut modelleri API'den getir
  const fetchModelsFromProvider = async (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) {
      alert('Provider bulunamadı!');
      return;
    }

    try {
      console.log('🔍 Modeller getiriliyor:', provider.name);

      const { fetchAvailableModels } = await import('../services/aiProvider');
      const modelNames = await fetchAvailableModels(provider);

      console.log('📥 Alınan modeller:', modelNames);

      if (modelNames.length > 0) {
        // Kullanıcıya modelleri göster ve seçim yaptır
        const selectedModels = modelNames.slice(0, 10); // İlk 10 modeli al

        const newModels = selectedModels.map((modelName, index) => {
          return {
            id: `fetched-${Date.now()}-${index}`,
            name: modelName,
            displayName: modelName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: `${provider.name} modeli`,
            specialty: "Genel Amaçlı",
            maxTokens: 4096,
            temperature: 0.7,
            isActive: true
          };
        });

        const newProviders = providers.map(p =>
          p.id === providerId
            ? { ...p, models: [...p.models, ...newModels] }
            : p
        );

        saveProviders(newProviders);

        // Başarı mesajı
        showToast(`✅ ${newModels.length} model eklendi!`, 'success');

        // Model seçiciyi güncelle
        window.dispatchEvent(new CustomEvent('ai-providers-updated', {
          detail: newProviders
        }));
      } else {
        showToast('⚠️ Bu provider\'dan model listesi boş geldi. Sunucunun çalıştığından emin olun.', 'error');
      }
    } catch (error) {
      console.error('❌ Model getirme hatası:', error);

      let errorMessage = 'Model listesi alınırken hata oluştu:\n\n';

      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorMessage += '🔌 Bağlantı hatası: AI sunucusuna erişilemiyor.\n';
          errorMessage += `• ${provider.baseUrl} adresinin doğru olduğundan emin olun\n`;
          errorMessage += '• LM Studio veya AI sunucunuzun çalıştığından emin olun\n';
          errorMessage += '• Firewall ayarlarını kontrol edin';
        } else if (error.message.includes('timeout')) {
          errorMessage += '⏱️ Zaman aşımı: Sunucu yanıt vermiyor.\n';
          errorMessage += '• AI sunucunuzun yavaş olabilir\n';
          errorMessage += '• Tekrar deneyin';
        } else if (error.message.includes('HTTP')) {
          errorMessage += `🚫 API hatası: ${error.message}\n`;
          errorMessage += '• API anahtarınızı kontrol edin\n';
          errorMessage += '• Endpoint URL\'ini kontrol edin';
        } else {
          errorMessage += `❌ ${error.message}`;
        }
      } else {
        errorMessage += '❌ Bilinmeyen hata oluştu';
      }

      alert(errorMessage);
    }
  };

  // Model sil  
  const deleteModel = (providerId: string, modelId: string) => {
    const newProviders = providers.map(p =>
      p.id === providerId
        ? { ...p, models: p.models.filter(m => m.id !== modelId) }
        : p
    );
    saveProviders(newProviders);
  };

  const getStatusColor = (status: 'online' | 'offline' | 'checking' | 'connected' | 'error' | undefined) => {
    switch (status) {
      case 'online':
      case 'connected': return 'text-green-400';
      case 'offline':
      case 'error': return 'text-red-400';
      case 'checking': return 'text-yellow-400';
      default: return 'text-neutral-400';
    }
  };

  const getStatusIcon = (status: 'online' | 'offline' | 'checking' | 'connected' | 'error' | undefined) => {
    switch (status) {
      case 'online': return '🟢';
      case 'connected': return '🟢';
      case 'offline': return '🔴';
      case 'error': return '🔴';
      case 'checking': return '🟡';
      default: return '⚪';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="w-full max-w-4xl h-[85vh] bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">AI Ayarları</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)]">
          {[
            { id: 'providers', label: 'AI Sağlayıcıları', icon: '🏢' },
            { id: 'models', label: 'Modeller', icon: '🧠' },
            { id: 'autonomy', label: 'Otomasyon', icon: '🎚️' },
            { id: 'add', label: 'Yeni Ekle', icon: '➕' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${activeTab === tab.id
                ? "text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                : "text-[var(--color-textSecondary)] hover:text-[var(--color-text)]"
                }`}
            >
              <span className="text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'providers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[var(--color-text)]">AI Sağlayıcıları</h3>
                <button
                  onClick={() => providers.forEach(testConnection)}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs transition-colors"
                >
                  Tümünü Test Et
                </button>
              </div>

              <div className="grid gap-3">
                {providers.map((provider) => (
                  <div
                    key={provider.id}
                    className={`p-3 rounded-lg border transition-colors ${provider.isActive
                      ? 'border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm'
                      }`}
                  >
                    {editingProvider === provider.id ? (
                      // Düzenleme modu
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{provider.icon}</span>
                          <h4 className="text-[var(--color-text)] font-medium text-sm">{provider.name}</h4>
                          <span className="text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded">
                            Düzenleniyor
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {/* GGUF için Host/Port gizle */}
                          {editForm.id !== 'gguf-direct' && (
                            <>
                              <div>
                                <label className="block text-xs font-medium text-neutral-300 mb-1">
                                  Host/IP Adresi
                                </label>
                                <input
                                  type="text"
                                  value={editForm.host || ''}
                                  onChange={(e) => {
                                    const cleanHost = e.target.value.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
                                    setEditForm(prev => ({ ...prev, host: cleanHost }));
                                  }}
                                  placeholder="127.0.0.1 (sadece IP, port ayrı)"
                                  className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1">
                                  Port
                                </label>
                                <input
                                  type="number"
                                  value={editForm.port || ''}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, port: parseInt(e.target.value) || undefined }))}
                                  placeholder="1234"
                                  className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm"
                                />
                              </div>
                            </>
                          )}

                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-neutral-300 mb-1">
                              Açıklama
                            </label>
                            <input
                              type="text"
                              value={editForm.description || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="AI sunucusu açıklaması"
                              className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={saveEditProvider}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
                          >
                            💾 Kaydet
                          </button>
                          <button
                            onClick={cancelEditProvider}
                            className="px-4 py-2 bg-neutral-600 hover:bg-neutral-700 text-white rounded-lg text-sm transition-colors"
                          >
                            ❌ İptal
                          </button>
                          <div className="text-xs text-neutral-500 ml-4">
                            💡 Kaydettiğinizde otomatik bağlantı testi yapılacak
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Normal görünüm
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{provider.icon}</span>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-[var(--color-text)] font-medium">{provider.name}</h4>
                              <span className={`text-sm ${getStatusColor(connectionStatus[provider.id])}`}>
                                {getStatusIcon(connectionStatus[provider.id])}
                              </span>
                              <span className="text-xs px-2 py-0.5 bg-neutral-700 text-neutral-300 rounded">
                                {provider.type}
                              </span>
                            </div>
                            <p className="text-sm text-neutral-400 mb-2">{provider.description}</p>
                            <div className="space-y-1">
                              <p className="text-xs text-neutral-500 font-mono">
                                🌐 {provider.host}:{provider.port}
                              </p>
                              <p className="text-xs text-neutral-500 font-mono">
                                🔗 {provider.baseUrl}
                              </p>
                              <p className="text-xs text-neutral-600">
                                📊 {provider.models.length} model • {provider.models.filter(m => m.isActive).length} aktif
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => testConnection(provider)}
                            className="px-2 py-1 bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] rounded text-xs transition-colors"
                            disabled={connectionStatus[provider.id] === 'checking'}
                          >
                            {connectionStatus[provider.id] === 'checking' ? '⏳' : '🔄'} Test
                          </button>
                          <button
                            onClick={() => startEditProvider(provider.id)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                          >
                            ✏️ Düzenle
                          </button>
                          <button
                            onClick={() => toggleProvider(provider.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${provider.isActive
                              ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/25'
                              : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/25'
                              }`}
                          >
                            {provider.isActive ? (
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></span>
                                AKTİF
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-red-300 rounded-full"></span>
                                PASİF
                              </span>
                            )}
                          </button>
                          {provider.type === 'custom' && (
                            deleteConfirm === provider.id ? (
                              <div className="flex gap-1" onMouseLeave={() => setDeleteConfirm(null)}>
                                <button onClick={() => deleteProvider(provider.id)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors">Evet</button>
                                <button onClick={() => setDeleteConfirm(null)}
                                  className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs transition-colors">İptal</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(provider.id)}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                              >
                                🗑️ Sil
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'models' && (
            <div className="space-y-2">

              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--color-text)]">AI Modelleri</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    className="px-3 py-1.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm"
                  >
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                  {selectedProvider !== 'gguf-direct' && (
                    <button
                      onClick={() => fetchModelsFromProvider(selectedProvider)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
                      title="API'den mevcut modelleri getir"
                    >
                      📥 Modelleri Getir
                    </button>
                  )}
                </div>
              </div>
              {/* GGUF Model Browser - Modern UI */}
              {selectedProvider === 'gguf-direct' && (
                <div className="mb-4">
                  <GGUFModelBrowser
                    onModelSelect={(model) => {
                      const newProviders = providers.map(p =>
                        p.id === 'gguf-direct'
                          ? {
                            ...p,
                            models: [
                              ...p.models.filter(m => m.id !== model.id),
                              {
                                id: model.id,
                                name: model.name,
                                displayName: model.displayName,
                                description: model.description,
                                specialty: model.quantization,
                                maxTokens: 4096,
                                temperature: 0.7,
                                isActive: true
                              }
                            ]
                          }
                          : p
                      );
                      saveProviders(newProviders);
                    }}
                  />
                </div>
              )}

              {selectedProvider !== 'gguf-direct' && (
                providers.find(p => p.id === selectedProvider)?.models.map((model) => (
                  <div
                    key={model.id}
                    className={`p-2 rounded-lg border transition-colors ${model.isActive
                      ? 'border-blue-500/30 bg-blue-500/5'
                      : 'border-neutral-700 bg-neutral-800/30'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-[var(--color-text)] font-medium">{model.displayName}</h4>
                          <span className="text-xs px-2 py-0.5 bg-[var(--color-background)] text-[var(--color-textSecondary)] border border-[var(--color-border)] rounded">
                            {model.specialty}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-400 mb-2">{model.description}</p>
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <span>Model: {model.name}</span>
                          <div className="flex items-center gap-2">
                            <span>Max Tokens:</span>
                            <input
                              type="number"
                              defaultValue={model.maxTokens || 4096}
                              onBlur={(e) => {
                                const newValue = parseInt(e.target.value) || 4096;
                                if (newValue !== model.maxTokens) {
                                  const newProviders = providers.map(p =>
                                    p.id === selectedProvider
                                      ? {
                                        ...p,
                                        models: p.models.map(m =>
                                          m.id === model.id
                                            ? { ...m, maxTokens: newValue }
                                            : m
                                        )
                                      }
                                      : p
                                  );
                                  saveProviders(newProviders);
                                }
                              }}
                              min="512"
                              max="128000"
                              step="512"
                              className="w-24 px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-xs"
                            />
                          </div>
                          <span>Temperature: {model.temperature}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleModel(selectedProvider, model.id)}
                          className={`px-3 py-1 rounded text-xs transition-colors ${model.isActive
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-neutral-600 hover:bg-neutral-700 text-white'
                            }`}
                        >
                          {model.isActive ? 'Aktif' : 'Pasif'}
                        </button>
                        <button
                          onClick={() => deleteModel(selectedProvider, model.id)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'autonomy' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">🎚️ Otomasyon Seviyesi</h3>
                <p className="text-sm text-[var(--color-textSecondary)] mb-2">
                  AI'nın tool'ları ne kadar özgürce kullanabileceğini belirleyin
                </p>
              </div>

              {/* Autonomy Level Slider */}
              <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--color-text)]">Seviye {autonomyLevel}</span>
                    <span className="text-xs text-[var(--color-textSecondary)]">{getAutonomyLevelDescription(autonomyLevel)}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={autonomyLevel}
                    onChange={(e) => {
                      const newLevel = parseInt(e.target.value) as AutonomyLevel;
                      setAutonomyLevel(newLevel);
                      saveAutonomyConfig({ level: newLevel });
                    }}
                    className="w-full h-2 bg-[var(--color-background)] rounded-lg appearance-none cursor-pointer slider border border-[var(--color-border)]"
                  />
                  <div className="flex justify-between text-xs text-neutral-500 mt-1">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                  </div>
                </div>

                {/* Level Descriptions */}
                <div className="space-y-3">
                  {[
                    { level: 1, icon: '🔒', title: 'Chat Only', desc: 'Tool yok, sadece sohbet' },
                    { level: 2, icon: '💬', title: 'Suggestions', desc: 'Tüm tool\'lar onay gerektirir' },
                    { level: 3, icon: '⚖️', title: 'Balanced (Önerilen)', desc: 'Güvenli tool\'lar otomatik, tehlikeli olanlar onay gerektirir' },
                    { level: 4, icon: '🚀', title: 'Auto Tools', desc: 'Çoğu tool otomatik çalışır' },
                    { level: 5, icon: '⚠️', title: 'Autonomous (Tehlikeli!)', desc: 'Tüm tool\'lar otomatik çalışır' }
                  ].map((item) => (
                    <div
                      key={item.level}
                      className={`p-3 rounded-lg border transition-colors ${autonomyLevel === item.level
                        ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]'
                        : 'bg-[var(--color-background)] border-[var(--color-border)]'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{item.icon}</span>
                        <span className="text-sm font-medium text-[var(--color-text)]">{item.title}</span>
                        {item.level === 3 && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Önerilen</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 ml-7">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Safe Tools */}
              <div className="bg-[var(--color-surface)] rounded-lg p-2 border border-[var(--color-border)]">
                <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">✅ Güvenli Tool'lar (Her zaman otomatik)</h4>
                <div className="flex flex-wrap gap-2">
                  {['read_file', 'list_files', 'plan_task', 'generate_code'].map((tool) => (
                    <span key={tool} className="px-3 py-1 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/30">
                      {tool}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  🤖 Multi-agent tool'lar (plan_task, generate_code) güvenlidir - sadece öneri üretir
                </p>
              </div>

              {/* Dangerous Commands */}
              <div className="bg-[var(--color-surface)] rounded-lg p-2 border border-[var(--color-border)]">
                <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">⚠️ Tehlikeli Komutlar (Her zaman onay gerektirir)</h4>
                <div className="flex flex-wrap gap-2">
                  {['rm', 'del', 'format', 'DROP TABLE', 'shutdown'].map((cmd) => (
                    <span key={cmd} className="px-3 py-1 bg-red-500/10 text-red-400 text-xs rounded-full border border-red-500/30 font-mono">
                      {cmd}
                    </span>
                  ))}
                </div>
              </div>

              {/* Warning */}
              {autonomyLevel >= 4 && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">ℹ️</span>
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--color-primary)] mb-1">Dikkat!</h4>
                      <p className="text-xs text-[var(--color-textSecondary)]">
                        Yüksek otomasyon seviyesi tehlikeli olabilir. AI terminal komutları ve dosya işlemlerini otomatik çalıştırabilir.
                        Sadece güvendiğiniz modeller için kullanın.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'add' && (
            <div className="space-y-3">
              {/* Yeni Provider Ekleme */}
              <div className="p-2 border border-neutral-700 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Yeni AI Sağlayıcısı Ekle</h3>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                      Sağlayıcı Adı
                    </label>
                    <input
                      type="text"
                      value={newProvider.name || ''}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Örn: OpenAI, Claude, Custom AI"
                      className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                      Tür
                    </label>
                    <select
                      value={newProvider.type || 'local'}
                      onChange={(e) => {
                        const type = e.target.value as any;
                        setNewProvider(prev => ({
                          ...prev,
                          type,
                          // Tür değiştiğinde varsayılan değerleri ayarla
                          host: type === 'local' ? '127.0.0.1' : '',
                          port: type === 'local' ? (type === 'ollama' ? 11434 : 1234) : undefined,
                          baseUrl: type === 'openai' ? 'https://api.openai.com/v1' :
                            type === 'anthropic' ? 'https://api.anthropic.com/v1' : ''
                        }));
                      }}
                      className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm"
                    >
                      <option value="local">Local (LM Studio/Ollama)</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  {/* Host + Port (Local için) */}
                  {(newProvider.type === 'local' || newProvider.type === 'custom') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-1">
                          Host/IP Adresi
                        </label>
                        <input
                          type="text"
                          value={newProvider.host || ''}
                          onChange={(e) => setNewProvider(prev => ({ ...prev, host: e.target.value }))}
                          placeholder="127.0.0.1 veya 192.168.1.100"
                          className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-1">
                          Port
                        </label>
                        <input
                          type="number"
                          value={newProvider.port || ''}
                          onChange={(e) => setNewProvider(prev => ({ ...prev, port: parseInt(e.target.value) || undefined }))}
                          placeholder="1234 (LM Studio) veya 11434 (Ollama)"
                          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm"
                        />
                      </div>
                    </>
                  )}

                  {/* Base URL (API servisleri için) */}
                  <div className={newProvider.type === 'local' ? 'col-span-2' : 'col-span-2'}>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                      Base URL {newProvider.type === 'local' ? '(Otomatik oluşturulur)' : ''}
                    </label>
                    <input
                      type="url"
                      value={newProvider.baseUrl || ''}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, baseUrl: e.target.value }))}
                      placeholder={
                        newProvider.type === 'openai' ? 'https://api.openai.com/v1' :
                          newProvider.type === 'anthropic' ? 'https://api.anthropic.com/v1' :
                            newProvider.type === 'local' ? 'http://127.0.0.1:1234/v1 (otomatik)' :
                              'https://your-api.com/v1'
                      }
                      disabled={newProvider.type === 'local'}
                      className={`w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm ${newProvider.type === 'local' ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                      API Key {newProvider.type === 'local' ? '(Opsiyonel)' : '(Gerekli)'}
                    </label>
                    <input
                      type="password"
                      value={newProvider.apiKey || ''}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder={
                        newProvider.type === 'openai' ? 'sk-...' :
                          newProvider.type === 'anthropic' ? 'sk-ant-...' :
                            'API anahtarı (varsa)'
                      }
                      className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                      İkon
                    </label>
                    <input
                      type="text"
                      value={newProvider.icon || ''}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, icon: e.target.value }))}
                      placeholder="🤖"
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                      Açıklama
                    </label>
                    <input
                      type="text"
                      value={newProvider.description || ''}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="AI sağlayıcısı açıklaması"
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={addProvider}
                  className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Sağlayıcı Ekle
                </button>
              </div>

              {/* Yeni Model Ekleme */}
              <div className="p-2 border border-neutral-700 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Yeni Model Ekle</h3>

                <div className="mb-2">
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Sağlayıcı Seç
                  </label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm"
                  >
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                      Model Adı
                    </label>
                    <input
                      type="text"
                      value={newModel.name || ''}
                      onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="gpt-4, claude-3, llama-3.1"
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                      Görünen Ad
                    </label>
                    <input
                      type="text"
                      value={newModel.displayName || ''}
                      onChange={(e) => setNewModel(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="GPT-4, Claude 3, Llama 3.1"
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                      Uzmanlık Alanı
                    </label>
                    <input
                      type="text"
                      value={newModel.specialty || ''}
                      onChange={(e) => setNewModel(prev => ({ ...prev, specialty: e.target.value }))}
                      placeholder="Kodlama, Chat, Analiz"
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      value={newModel.maxTokens || 4096}
                      onChange={(e) => setNewModel(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                      Açıklama
                    </label>
                    <input
                      type="text"
                      value={newModel.description || ''}
                      onChange={(e) => setNewModel(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Model açıklaması"
                      className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={addModel}
                  className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Model Ekle
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-[var(--color-border)] bg-[var(--color-background)] rounded-b-xl">
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-500">
              💡 Ayarlar otomatik kaydedilir • API anahtarları Tauri Store'da güvenli şifrelenir
            </div>
            <div className="flex items-center gap-2">
              {/* Canlı bağlantı durumu */}

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${Object.values(connectionStatus).some(status => status === 'online')
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-red-500'
                    }`}></div>
                  <span className="text-xs text-neutral-400">
                    {Object.values(connectionStatus).filter(status => status === 'online').length} aktif bağlantı
                  </span>
                </div>
                <div className="text-xs text-neutral-600">
                  • Her 5s test
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
