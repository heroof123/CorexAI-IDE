// AI Provider Management Service
import { invoke } from "@tauri-apps/api/core";

export interface AIProvider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'local' | 'custom';
  baseUrl: string;
  host?: string;
  port?: number;
  apiKey?: string;
  models: AIModel[];
  isActive: boolean;
  icon: string;
  description: string;
}

export interface AIModel {
  id: string;
  name: string;
  displayName: string;
  description: string;
  specialty: string;
  roles?: ('coder' | 'tester' | 'planner' | 'chat' | 'reviewer' | 'analyzer')[]; // 🆕 Çoklu roller
  maxTokens?: number;
  temperature?: number;
  isActive: boolean;
}

import { storage } from "./storage";

// AI Provider'ları yükle
export async function loadAIProviders(): Promise<AIProvider[]> {
  const saved = await storage.getSettings<AIProvider[]>('corex-ai-providers');
  if (saved) {
    return saved;
  }

  // Default providers
  const defaultProviders: AIProvider[] = [
    {
      id: "lm-studio",
      name: "LM Studio",
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
          specialty: "Coder", // Rollere göre güncellendi
          roles: ["coder"], // 🆕 Çoklu roller
          maxTokens: 4096,
          temperature: 0.5,
          isActive: true
        },
        {
          id: "chat",
          name: "qwen2.5-3b-instruct",
          displayName: "Qwen2.5 3B",
          description: "Hızlı sohbet ve basit görevler",
          specialty: "Chat", // Rollere göre güncellendi
          roles: ["chat"], // 🆕 Çoklu roller
          maxTokens: 8192, // 🔥 2048'den 8192'ye çıkarıldı - kod yazarken yeterli olsun
          temperature: 0.7,
          isActive: true
        }
      ],
      isActive: true,
      icon: "🖥️",
      description: "Yerel LM Studio sunucusu"
    }
  ];

  await storage.setSettings('corex-ai-providers', defaultProviders);
  return defaultProviders;
}

// AI Provider'ları kaydet
export async function saveAIProviders(providers: AIProvider[]): Promise<void> {
  await storage.setSettings('corex-ai-providers', providers);
}

// Aktif modeli bul
export async function findActiveModel(modelId: string): Promise<{ provider: AIProvider; model: AIModel } | null> {
  const providers = await loadAIProviders();

  // 1. Önce ID ile tam eşleşen ve aktif olan modeli ara
  for (const provider of providers) {
    // Provider pasif olsa bile, eğer model ID tam eşleşiyorsa ve model aktifse kabul et (Fallback)
    // Bu, GGUF provider'ın bazen pasif kalmasına rağmen modellerinin aktif olması durumunu kurtarır.
    const model = provider.models.find(m => m.id === modelId && m.isActive);
    if (model) {
      // Eğer provider pasifse ama model aktifse, provider'ı geçici olarak aktif kabul et
      return { provider: { ...provider, isActive: true }, model };
    }
  }

  // 2. Eğer ID ile bulunamadıysa (veya ID 'default' ise), ilk aktif modelden devam et
  if (!modelId || modelId === 'default' || modelId === 'main' || modelId === 'chat') {
    for (const provider of providers) {
      if (!provider.isActive) continue;
      const model = provider.models.find(m => m.isActive);
      if (model) return { provider, model };
    }
  }

  return null;
}

// Dinamik AI çağrısı - provider ayarlarını kullanarak
// 🆕 Mesajdan resimleri parse et
function parseImagesFromMessage(message: string): { cleanMessage: string; images: string[] } {
  const imageRegex = /\[IMAGES:(\d+)\]\n((?:\[IMAGE_\d+\]:data:image\/[^;]+;base64,[^\n]+\n)+)/;
  const match = message.match(imageRegex);

  if (!match) {
    return { cleanMessage: message, images: [] };
  }

  const imageCount = parseInt(match[1]);
  const imagesBlock = match[2];
  const images: string[] = [];

  // Her bir resmi parse et
  const imageLines = imagesBlock.split('\n').filter(line => line.startsWith('[IMAGE_'));
  for (const line of imageLines) {
    const imageMatch = line.match(/\[IMAGE_\d+\]:(data:image\/[^;]+;base64,.+)/);
    if (imageMatch) {
      images.push(imageMatch[1]);
    }
  }

  // Mesajdan resim bloğunu çıkar
  const cleanMessage = message.replace(imageRegex, '').trim();

  console.log('📷 Parse edildi:', { imageCount, foundImages: images.length, cleanMessageLength: cleanMessage.length });

  return { cleanMessage, images };
}

/**
 * 🧹 GGUF yanıtlarını sanitize et (Halisünasyonları ve stop token kaçaklarını engelle)
 */
function sanitizeGgufResponse(text: string): string {
  if (!text) return "";

  // Yaygın stop belirteçleri ve halisünasyon kalıpları
  const stopSequences = [
    "User:",
    "### User:",
    "Assistant:",
    "### Assistant:",
    "<|im_start|>",
    "<|im_end|>",
    "### Instruction:",
    "### Response:",
    "Q:",
    "A:",
    "\n\n\n", // Aşırı boşluk varsa kes (bazen loop'a girer)
  ];

  let cleaned = text;

  for (const seq of stopSequences) {
    const index = cleaned.indexOf(seq);
    if (index !== -1) {
      cleaned = cleaned.substring(0, index);
    }
  }

  return cleaned.trim();
}

/**
 * 🔍 Metin içinden JSON bloğunu ayıkla ve parse et (FIX-34)
 */
export function extractJsonFromText<T>(text: string): T | null {
  if (!text) return null;

  try {
    // 1. Direkt parse etmeyi dene
    return JSON.parse(text);
  } catch {
    try {
      // 2. Markdown kod bloklarını ara (```json ... ```)
      const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
      const match = text.match(jsonBlockRegex);
      if (match && match[1]) {
        return JSON.parse(match[1].trim());
      }

      // 3. İlk { ve son } arasını dene
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const potentialJson = text.substring(firstBrace, lastBrace + 1);
        // Temizlik: Kontrol karakterlerini ve geçersiz kaçışları temizle
        const cleanedJson = potentialJson
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
          .trim();
        return JSON.parse(cleanedJson);
      }
    } catch (e) {
      console.warn("⚠️ JSON extraction failed:", e);
    }
  }
  return null;
}

const getAgenticInstruction = (isTurkish: boolean): string => {
  return isTurkish
    ? 'Sen CorexAI asistanısın. Eğer sana sadece selam veriliyorsa veya kodla ilgisiz bir sohbet ediliyorsa, doğal bir dille sadece sohbet et, asla kod bloğu üretme! ANCAK eğer bir kod yazman veya değiştirmen isteniyorsa:\n1. **DÜŞÜNME AŞAMASI (THINKING STAGE):** Kod yazmadan önce sana sunulan "Project Map", "Project Rules" ve "User Focus" (Cursor/Selection) verilerini analiz et. Stratejini 1-2 cümleyle açıkla.\n2. **KOD İNCELEME MODU (REVIEW MODE):** Eğer kullanıcı bir "Ghost Review" veya refactor önerisiyle gelmişse, koda bir kıdemli yazılımcı (senior dev) gözüyle bak. Sadece hatayı değil, temiz kod (clean code) prensiplerini ve performansı da gözet.\n3. **HATA DÜZELTME MODU (FIXING MODE):** Eğer kullanıcı bir terminal hatası (Terminal context) paylaşmışsa, önceliğin bu hatayı çözmek olsun. Hatayı analiz et ve doğrudan çözüme odaklanan <<<SEARCH === >>>REPLACE güncellemeleri yap.\n4. **PROJE KURALLARI:** Eğer bir ".corexrules" veya "COREX.md" dosyası sunulmuşsa, oradaki teknik kurallara KESİNLİKLE uy.\n5. **TAM FONKSİYONEL KOD:** Ürettiğin kodlar her zaman İNTERAKTİF olmalı.\n6. **UI/UX:** Modern ve premium UI/UX prensiplerini uygula.\n7. **DOSYA GÜNCELLEME:** Sadece değiştirmek istediğin yeri <<<SEARCH === >>>REPLACE formatında ver. Sadece zorunluysa tüm dosyayı yaz.\n8. **YENİ DOSYA OLUŞTURMA (DİKKAT!):** Kod bloğunun başına MUTLAKA dosya adını yazmalısın. Örnek format: ```html:index.html VEYA ```javascript:app.js. DOSYA ADI YAZMAK ZORUNLUDUR!'
    : 'You are CorexAI assistant. If the user is just chatting or saying hello, respond normally in natural language. BUT if you are generating or modifying code:\n1. **THINKING STAGE:** Before writing any code, analyze the "Project Map", "Project Rules", and "User Focus" (Cursor/Selection) provided. Explain your strategy in 1-2 sentences.\n2. **REVIEW MODE:** If a "Ghost Review" or refactor suggestion is provided, analyze the code as a senior developer. Focus on clean code principles, performance, and maintainability.\n3. **FIXING MODE:** If terminal error context is provided, prioritize fixing this specific error. Analyze the error and provide direct <<<SEARCH === >>>REPLACE updates to resolve it.\n4. **PROJECT RULES:** If a ".corexrules" or "COREX.md" file is provided, STRICTLY follow the technical rules and naming standards defined there.\n5. **FULLY FUNCTIONAL CODE:** Generated code must be INTERACTIVE.\n6. **UI/UX:** Apply modern and premium UI/UX principles.\n7. **FILE UPDATE:** Provide ONLY the exact part to change using <<<SEARCH === >>>REPLACE format. Only rewrite the full file if absolutely necessary.\n8. **NEW FILE (WARNING!):** Always provide the filename in the code block like ```html:index.html or ```javascript:app.js. FILENAME IS MANDATORY!';
};

// 🆕 Conversation history desteği eklendi
export async function callAI(
  message: string,
  modelId: string,
  conversationHistory?: Array<{ role: string; content: string }>,
  onStreamToken?: (text: string) => void // 🆕 Streaming callback
): Promise<string> {
  const isTurkish = navigator.language ? navigator.language.startsWith('tr') : true;

  // Resimleri parse et (temiz mesajı al)
  const { cleanMessage, images } = parseImagesFromMessage(message);

  // History hazırla
  const messages = [...(conversationHistory || [])];

  // Eğer history boşsa veya başında system prompt yoksa, agentic instruction ekle
  const hasSystemPrompt = messages.some(m => m.role === 'system');
  if (!hasSystemPrompt) {
    messages.unshift({
      role: 'system',
      content: getAgenticInstruction(isTurkish)
    });
  }


  if (images.length > 0) {
    console.log('📷 Vision mode aktif:', images.length, 'resim bulundu');
  }

  // 🔧 Model ID yoksa veya "default" ise, aktif bir model seç
  let actualModelId = modelId;
  if (!modelId || modelId === 'default') {
    console.log('⚠️ Model ID belirtilmemiş, aktif model aranıyor...');
    const providers = await loadAIProviders();

    // İlk aktif provider'ın ilk aktif modelini bul
    for (const provider of providers) {
      if (!provider.isActive) continue;

      const activeModel = provider.models.find(m => m.isActive);
      if (activeModel) {
        actualModelId = activeModel.id;
        console.log(`✅ Aktif model bulundu: ${activeModel.displayName} (${actualModelId})`);
        break;
      }
    }

    // Hala model bulunamadıysa hata ver
    if (!actualModelId || actualModelId === 'default') {
      throw new Error('Aktif AI modeli bulunamadı. Lütfen AI ayarlarından bir model aktif edin.');
    }
  }

  const result = await findActiveModel(actualModelId);

  if (!result) {
    throw new Error(`Model bulunamadı: ${actualModelId}`);
  }

  const { provider, model } = result;

  console.log('🤖 AI çağrısı yapılıyor:', {
    modelId,
    provider: provider.name,
    model: model.displayName,
    baseUrl: provider.baseUrl,
    historyLength: conversationHistory?.length || 0
  });

  // 🆕 GGUF provider kontrolü - baseUrl kontrolü yerine provider ID kontrolü
  console.log('🔍 Provider kontrolü:', { id: provider.id, baseUrl: provider.baseUrl, name: provider.name });

  if (provider.id === "gguf-direct" || provider.baseUrl === "internal://gguf") {
    console.log('📦 GGUF provider tespit edildi, direkt GGUF çağrısı yapılıyor...');

    // GGUF fonksiyonlarını import et
    const { getGgufModelStatus } = await import('./ggufProvider');

    // 🆕 GGUF model bilgisini gguf-models listesinden bul
    const ggufModels = await storage.getSettings<any[]>('gguf-models');
    let modelConfig = null;

    if (ggufModels) {
      // actualModelId ile eşleşen modeli bul
      modelConfig = ggufModels.find((m: any) => m.id === actualModelId);
    }

    // Eğer listede yoksa (yeni eklenmiş olabilir) gguf-active-model'e fallback yap (geriye dönük uyumluluk)
    if (!modelConfig) {
      modelConfig = await storage.getSettings<any>('gguf-active-model');
    }

    // Eğer config bulunamadıysa, backend'de zaten yüklü olan modeli kullan
    if (!modelConfig || !modelConfig.localPath) {
      console.warn('⚠️ Config bulunamadı, backend\'deki aktif model kontrol ediliyor...');
      const currentStatus = await getGgufModelStatus();
      if (currentStatus.loaded && currentStatus.loaded_models.length > 0) {
        const loadedPath = currentStatus.loaded_models[0];
        console.log('✅ Backend\'de yüklü model kullanılıyor:', loadedPath);
        modelConfig = {
          localPath: loadedPath,
          modelName: loadedPath.split(/[\\/]/).pop()?.replace('.gguf', '') || 'gguf-model',
          contextLength: 4096
        };
      } else {
        throw new Error(`❌ GGUF model yapılandırması veya yerel dosya yolu bulunamadı: ${actualModelId}`);
      }
    }

    const config = modelConfig;
    const modelPath = config.localPath; // Backend için asıl gerekli olan yol
    console.log('📋 GGUF Model Path:', modelPath);

    // Model durumunu kontrol et
    const status = await getGgufModelStatus();
    console.log('📊 GGUF Loaded Models:', status.loaded_models);

    // Model yüklü değilse yüklemeyi dene (Otomatik yükleme)
    if (!status.loaded_models.includes(modelPath)) {
      console.warn('⚠️ GGUF model henüz yüklü değil, otomatik yükleniyor...');
      const { loadGgufModel } = await import('./ggufProvider');
      await loadGgufModel({
        modelPath: modelPath,
        contextLength: config.contextLength || 4096,
        gpuLayers: 28, // Varsayılan GPU layer
        temperature: 0.7,
        maxTokens: 4096
      });
    }

    console.log('✅ Model hazır, chat yapılıyor...');

    // Model adından chat template'i belirle
    const modelName = config.modelName?.toLowerCase() || '';
    console.log('🔍 Model adı:', modelName);

    // 🔥 Context length'i GGUF config'den al (Model Browser'dan ayarlanan değer)
    let contextLength = config.contextLength || model.maxTokens || 2048;

    // 🔥 CRITICAL FIX: Context length çok küçükse otomatik artır
    // Kod yazarken minimum 4096 context gerekli
    if (contextLength < 4096) {
      console.warn(`⚠️ Context length çok küçük (${contextLength}), 4096'ya yükseltiliyor...`);
      contextLength = 4096;
    }

    console.log('📏 Context length (GGUF config):', contextLength);
    console.log('🔍 Config details:', {
      configContextLength: config.contextLength,
      modelMaxTokens: model.maxTokens,
      finalContextLength: contextLength
    });

    let fullPrompt = '';

    // Conversation history'yi hazırla (son 4 mesaj)
    const filteredHistory = conversationHistory
      ? conversationHistory.filter(msg => msg.role !== 'system').slice(-4)
      : [];

    // Model tipine göre chat template seç
    if (modelName.includes('qwen')) {
      // Qwen2.5 ChatML format: <|im_start|>role\ncontent<|im_end|>
      console.log('📝 Qwen chat template kullanılıyor');

      // System prompt - Sistem diline göre
      const systemLanguage = navigator.language || 'en';
      const isTurkish = systemLanguage.startsWith('tr');
      const systemMessage = isTurkish
        ? 'Sen Corex AI, Türkçe yanıt veren bir kodlama asistanısın. Kısa ve öz yanıt ver. Selamlaşmalarda 1-2 cümle yeterli.'
        : 'You are Corex AI, a concise coding assistant. Keep answers SHORT and direct. For greetings, 1-2 sentences max.';

      fullPrompt += `<|im_start|>system\n${systemMessage}<|im_end|>\n`;

      // History
      for (const msg of filteredHistory) {
        const role = msg.role === 'user' ? 'user' : 'assistant';
        fullPrompt += `<|im_start|>${role}\n${msg.content}<|im_end|>\n`;
      }

      // Current message
      fullPrompt += `<|im_start|>user\n${cleanMessage}<|im_end|>\n<|im_start|>assistant\n`;

    } else if (modelName.includes('llama') && modelName.includes('3')) {
      // Llama 3 format
      console.log('📝 Llama 3 chat template kullanılıyor');

      fullPrompt += '<|begin_of_text|>';

      // System prompt - Sistem diline göre
      const systemLanguage = navigator.language || 'en';
      const isTurkish = systemLanguage.startsWith('tr');
      const systemMessage = isTurkish
        ? 'Sen Corex AI, Türkçe yanıt veren bir kodlama asistanısın. Kısa ve öz yanıt ver. Selamlaşmalarda 1-2 cümle yeterli.'
        : 'You are Corex AI, a concise coding assistant. Keep answers SHORT and direct. For greetings, 1-2 sentences max.';

      fullPrompt += `<|start_header_id|>system<|end_header_id|>\n\n${systemMessage}<|eot_id|>`;

      // History
      for (const msg of filteredHistory) {
        const role = msg.role === 'user' ? 'user' : 'assistant';
        fullPrompt += `<|start_header_id|>${role}<|end_header_id|>\n\n${msg.content}<|eot_id|>`;
      }

      // Current message
      fullPrompt += `<|start_header_id|>user<|end_header_id|>\n\n${cleanMessage}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`;

    } else if (modelName.includes('mistral') || modelName.includes('mixtral')) {
      // Mistral format: [INST] ... [/INST]
      console.log('📝 Mistral chat template kullanılıyor');

      // Mistral doesn't use system prompt in the same way
      let conversationText = '';

      // History
      for (const msg of filteredHistory) {
        if (msg.role === 'user') {
          conversationText += `[INST] ${msg.content} [/INST] `;
        } else {
          conversationText += `${msg.content} `;
        }
      }

      // Current message
      conversationText += `[INST] ${cleanMessage} [/INST]`;

      fullPrompt = conversationText;

    } else if (modelName.includes('gemma')) {
      // Gemma format
      console.log('📝 Gemma chat template kullanılıyor');

      fullPrompt += '<start_of_turn>user\n';

      // History
      for (const msg of filteredHistory) {
        const role = msg.role === 'user' ? 'user' : 'model';
        fullPrompt += `<start_of_turn>${role}\n${msg.content}<end_of_turn>\n`;
      }

      // Current message
      fullPrompt += `<start_of_turn>user\n${cleanMessage}<end_of_turn>\n<start_of_turn>model\n`;

    } else if (modelName.includes('phi')) {
      // Phi format
      console.log('📝 Phi chat template kullanılıyor');

      // System prompt - Sistem diline göre
      const systemLanguage = navigator.language || 'en';
      const isTurkish = systemLanguage.startsWith('tr');
      const systemMessage = isTurkish
        ? 'Sen Corex AI, Türkçe yanıt veren bir kodlama asistanısın. Kısa ve öz yanıt ver. Selamlaşmalarda 1-2 cümle yeterli.'
        : 'You are Corex AI, a concise coding assistant. Keep answers SHORT and direct. For greetings, 1-2 sentences max.';

      fullPrompt += `<|system|>\n${systemMessage}<|end|>\n`;

      // History
      for (const msg of filteredHistory) {
        const role = msg.role === 'user' ? 'user' : 'assistant';
        fullPrompt += `<|${role}|>\n${msg.content}<|end|>\n`;
      }

      // Current message
      fullPrompt += `<|user|>\n${cleanMessage}<|end|>\n<|assistant|>\n`;

    } else {
      // Generic/Unknown model - simple format
      console.log('📝 Generic chat template kullanılıyor (bilinmeyen model)');

      // System prompt - Sistem diline göre
      const systemLanguage = navigator.language || 'en';
      const isTurkish = systemLanguage.startsWith('tr');
      const systemMessage = isTurkish
        ? 'Sen Corex AI, Türkçe yanıt veren bir kodlama asistanısın. Kısa ve öz yanıt ver. Selamlaşmalarda 1-2 cümle yeterli.'
        : 'You are Corex AI, a concise coding assistant. Keep answers SHORT and direct. For greetings, 1-2 sentences max.';

      fullPrompt += `${systemMessage}\n\n`;

      // History
      for (const msg of filteredHistory) {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        fullPrompt += `${role}: ${msg.content}\n\n`;
      }

      // Current message
      fullPrompt += `User: ${cleanMessage}\n\nAssistant:`;
    }

    console.log('🔵 GGUF chat başlatılıyor, prompt uzunluğu:', fullPrompt.length);
    console.log('📝 Prompt preview:', fullPrompt.substring(0, 300));

    // 🆕 GGUF calls with timeout (FIX-25)
    const ggufTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('GGUF yanıt vermiyor (300 saniye)')), 300000);
    });

    // Chat yap - maxTokens generation için (üretilecek token sayısı)
    // Context length zaten model yüklenirken ayarlandı
    // 🔥 FIXED: Minimum 2048 token garanti et, kod yazarken yeterli olsun
    const generationMaxTokens = Math.max(Math.min(contextLength / 2, 8192), 2048); // Min 2048, max 8192
    console.log('🎯 Generation max tokens:', generationMaxTokens, '(context:', contextLength, ')');

    // 🆕 Streaming desteği
    if (onStreamToken) {
      const { chatWithChunkedStreaming } = await import('./streamingProvider');
      const streamPromise = chatWithChunkedStreaming(
        modelPath,
        fullPrompt,
        generationMaxTokens,
        model.temperature || 0.7,
        {
          onToken: (delta) => {
            onStreamToken(delta);
          },
          onComplete: (text: string) => console.log('✅ Streaming tamamlandı:', text.length, 'karakter')
        }
      );
      const response = await Promise.race([streamPromise, ggufTimeoutPromise]);
      return sanitizeGgufResponse(response);
    }

    // Normal (non-streaming) mode
    const chatPromise = (async () => {
      const { chatWithGgufModel } = await import('./ggufProvider');
      return await chatWithGgufModel(
        modelPath,
        fullPrompt,
        generationMaxTokens,
        model.temperature || 0.7
      );
    })();

    const response = await Promise.race([chatPromise, ggufTimeoutPromise]);
    const sanitized = sanitizeGgufResponse(response);
    console.log('✅ GGUF response alındı ve sanitize edildi, uzunluk:', sanitized.length);
    return sanitized;
  }

  // Normal provider (LM Studio, Ollama, vb.)
  // Timeout ile AI çağrısı (60 saniye - daha uzun cevaplar için)
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('AI isteği zaman aşımına uğradı (60 saniye)')), 60000);
  });

  // Temperature'ı biraz artır (daha yaratıcı ve eksiksiz cevaplar için)
  const adjustedTemperature = model.temperature ? Math.min(model.temperature + 0.1, 0.9) : 0.7;

  // Max tokens'ı artır (daha uzun cevaplar için)
  const adjustedMaxTokens = model.maxTokens ? Math.max(model.maxTokens, 8192) : 8192;

  const aiPromise = invoke<string>("chat_with_dynamic_ai", {
    message: cleanMessage,
    conversationHistory: messages, // 🔥 Güncellenmiş history kullan
    providerConfig: {
      base_url: provider.baseUrl,
      host: provider.host || null,
      port: provider.port || null,
      api_key: provider.apiKey || null,
      model_name: model.name,
      temperature: adjustedTemperature,
      max_tokens: adjustedMaxTokens
    }
  });

  return await Promise.race([aiPromise, timeoutPromise]);
}

// Provider bağlantısını test et
export async function testProviderConnection(provider: AIProvider): Promise<boolean> {
  try {
    // 🆕 GGUF provider için özel test
    if (provider.id === "gguf-direct" || provider.baseUrl === "internal://gguf") {
      console.log('🧪 GGUF provider test ediliyor...');

      // GGUF model status kontrolü
      const { getGgufModelStatus } = await import('./ggufProvider');
      const status = await getGgufModelStatus();

      console.log('📊 GGUF Status:', status);

      // Model yüklüyse başarılı
      if (status.loaded) {
        console.log('✅ GGUF Test Sonucu: Model yüklü - BAŞARILI');
        return true;
      }

      // Model yüklü değilse ama config varsa uyarı ver
      const hasConfig = (await storage.getSettings('gguf-active-model')) !== null;
      if (hasConfig) {
        console.log('⚠️ GGUF Test Sonucu: Config var ama model yüklü değil');
        return false;
      }

      console.log('❌ GGUF Test Sonucu: Model yapılandırılmamış');
      return false;
    }

    // Normal provider test (HTTP)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    // Timeout ile fetch (5 saniye)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${provider.baseUrl}/models`, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    return response.ok;
  } catch (error) {
    console.error('Provider bağlantı testi hatası:', error);
    return false;
  }
}

// Mevcut modelleri listele (API'den)
export async function fetchAvailableModels(provider: AIProvider): Promise<string[]> {
  try {
    // 🆕 GGUF provider için özel liste
    if (provider.baseUrl === "internal://gguf") {
      console.log('📦 GGUF provider için model listesi alınıyor...');

      // storage'dan aktif GGUF modelini al
      const config = await storage.getSettings<any>('gguf-active-model');
      if (config) {
        console.log('✅ GGUF Model bulundu:', config.modelName);
        return [config.modelName || 'GGUF Model'];
      }

      console.log('⚠️ GGUF model yapılandırılmamış');
      return [];
    }

    // Normal provider (HTTP)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    console.log('🔍 Model listesi alınıyor:', provider.baseUrl);

    // Timeout ile fetch (10 saniye)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${provider.baseUrl}/models`, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API hatası:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('📥 API Response:', data);

    // OpenAI format
    if (data.data && Array.isArray(data.data)) {
      const models = data.data.map((model: any) => model.id || model.name).filter(Boolean);
      console.log('✅ Bulunan modeller:', models);
      return models;
    }

    // LM Studio format (bazen direkt array döner)
    if (Array.isArray(data)) {
      const models = data.map((model: any) => model.id || model.name || model).filter(Boolean);
      console.log('✅ Bulunan modeller (array):', models);
      return models;
    }

    // Ollama format
    if (data.models && Array.isArray(data.models)) {
      const models = data.models.map((model: any) => model.name || model.id).filter(Boolean);
      console.log('✅ Bulunan modeller (ollama):', models);
      return models;
    }

    console.warn('⚠️ Beklenmeyen API response formatı:', data);
    return [];
  } catch (error) {
    console.error('❌ Model listesi alınamadı:', error);
    throw error; // Hatayı yukarı fırlat ki kullanıcı görebilsin
  }
}