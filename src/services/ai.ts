import { storage } from './storage';
import { selectPromptMode, type AutonomyMeta } from '../prompts/corex_system_prompt';
// import { invoke } from '@tauri-apps/api/core'; // ✅ FIXED: Use Rust backend (ŞU ANDA KULLANILMIYOR)
// import { shouldIndexFile } from './embedding'; // Import from embedding service (ŞU ANDA KULLANILMIYOR)
// import { cacheManager, generateAICacheKey } from './cache'; // Cache sistemi (gelecekte kullanılacak)

// ✅ Local type definitions (in case ../types doesn't have them)
export interface CodeAction {
  id: string;
  type: "create" | "modify" | "delete";
  filePath: string;
  content: string;
  lineNumber?: number;
  oldContent?: string;
  description?: string;
}

export interface AIResponse {
  explanation: string;
  actions?: CodeAction[];
  hasCode: boolean;
}

// Enhanced conversation context
interface ConversationContext {
  history: Array<{ role: string; content: string; timestamp: number; tokens?: number }>;
  currentTopic: string | null;
  recentFiles: string[];
  userPreferences: {
    codeStyle: string;
    preferredLanguage: string;
    verbosity: 'concise' | 'detailed' | 'balanced';
  };
  ongoingTask: string | null;
  projectContext: {
    name: string;
    type: string;
    mainLanguages: string[];
  };
  maxContextTokens: number; // Maksimum context token sayısı
  maxOutputTokens: number; // Maksimum output token sayısı
  summary: string | null; // 🆕 Konuşma özeti
  messagesSinceLastSummary: number; // 🆕 Son özetten sonraki mesaj sayısı
}

let conversationContext: ConversationContext = {
  history: [],
  currentTopic: null,
  recentFiles: [],
  userPreferences: {
    codeStyle: 'clean',
    preferredLanguage: 'turkish',
    verbosity: 'balanced'
  },
  ongoingTask: null,
  projectContext: {
    name: '',
    type: 'unknown',
    mainLanguages: []
  },
  maxContextTokens: 32768, // 32K default (GGUF model'den alınacak)
  maxOutputTokens: 8192, // 8K default (kullanıcı değiştirebilir)
  summary: null, // 🆕 Başlangıçta özet yok
  messagesSinceLastSummary: 0 // 🆕 Mesaj sayacı
};

// 🆕 Token tahmini fonksiyonu (basit ama etkili)
function estimateTokens(text: string): number {
  // Ortalama: 1 token ≈ 4 karakter (İngilizce/Türkçe karışık)
  // Daha doğru: kelime sayısı * 1.3
  const words = text.split(/\s+/).length;
  return Math.ceil(words * 1.3);
}

// 🆕 Konuşma özetini oluştur
async function generateSummary(messages: Array<{ role: string; content: string }>): Promise<string> {
  try {
    console.log('📝 Konuşma özeti oluşturuluyor...');

    // Son 10 mesajı al (system prompt hariç)
    const recentMessages = messages.slice(-10).filter(m => m.role !== 'system');

    if (recentMessages.length === 0) {
      return '';
    }

    // Özet prompt'u oluştur
    const summaryPrompt = `Aşağıdaki konuşmayı kısa ve öz bir şekilde özetle. Sadece önemli noktaları ve yapılan işlemleri belirt. Maksimum 5 cümle kullan.

Konuşma:
${recentMessages.map(m => `${m.role === 'user' ? 'Kullanıcı' : 'AI'}: ${m.content.substring(0, 500)}`).join('\n\n')}

Özet (Türkçe, maksimum 5 cümle):`;

    // AI'dan özet iste
    const { callAI } = await import('./aiProvider');
    const modelId = getModelIdForRole();

    const summary = await callAI(summaryPrompt, modelId, [
      { role: 'user', content: summaryPrompt }
    ]);

    console.log('✅ Özet oluşturuldu:', summary.substring(0, 100) + '...');
    return summary.trim();

  } catch (error) {
    console.error('❌ Özet oluşturma hatası:', error);
    return ''; // Hata durumunda boş özet döndür
  }
}

// 🆕 History'yi token bazlı temizle
function pruneHistory(maxTokens: number): void {
  if (conversationContext.history.length <= 1) return; // System prompt'u koru

  let totalTokens = 0;
  const systemPrompt = conversationContext.history[0]; // İlk mesaj system prompt
  const prunedHistory = [systemPrompt];

  // Token sayılarını hesapla (eğer yoksa)
  conversationContext.history.forEach(msg => {
    if (!msg.tokens) {
      msg.tokens = estimateTokens(msg.content);
    }
  });

  // Sondan başa doğru git (en yeni mesajları koru)
  for (let i = conversationContext.history.length - 1; i >= 1; i--) {
    const msg = conversationContext.history[i];
    const msgTokens = msg.tokens || estimateTokens(msg.content);

    if (totalTokens + msgTokens < maxTokens) {
      prunedHistory.splice(1, 0, msg); // System prompt'tan sonra ekle
      totalTokens += msgTokens;
    } else {
      // Limit doldu, eski mesajları at
      console.log(`🗑️ ${conversationContext.history.length - prunedHistory.length} eski mesaj silindi (token limiti)`);
      break;
    }
  }

  conversationContext.history = prunedHistory;
  console.log(`📊 History: ${prunedHistory.length} mesaj, ~${totalTokens} token`);
}

// ✅ System prompt artık corex_system_prompt.ts modülünden geliyor
// getSystemPromptForRole → selectPromptMode olarak yenilendi


// ✅ YENİ FONKSİYON - Rust backend kullanarak dosya tarama (ŞU ANDA KULLANILMIYOR)
/* async function getAllProjectFiles(dirPath: string): Promise<string[]> {
  try {
    // Rust backend'den tüm dosyaları al
    const allFiles = await invoke<string[]>('get_all_files', { path: dirPath });
    
    // shouldIndexFile ile filtrele
    const filteredFiles = allFiles.filter(file => shouldIndexFile(file));
    
    console.log(`📁 Toplam ${ filteredFiles.length } dosya bulundu`);
    return filteredFiles;
  } catch (error) {
    console.error('❌ Dosya tarama hatası:', error);
    return [];
  }
}
*/

// ✅ YENİ getProjectContext - Tamamen yeniden yazıldı (ŞU ANDA KULLANILMIYOR)
/* async function getProjectContext(
  projectPath: string,
  currentFile?: string
  // query parametresi kaldırıldı - kullanılmıyordu
): Promise<string> {
  
  console.log('🔍 Proje analiz ediliyor:', projectPath);
  
  // 1️⃣ TÜM dosyaları recursive tara
  const allFiles = await getAllProjectFiles(projectPath);
  
  // 2️⃣ Dosyaları kategorize et
  const filesByType: Record<string, string[]> = {
    typescript: [],
    javascript: [],
    rust: [],
    config: [],
    markdown: [],
    styles: [],
    other: []
  };
  
  allFiles.forEach(file => {
    const ext = file.split('.').pop()?.toLowerCase() || '';
    if (['ts', 'tsx'].includes(ext)) filesByType.typescript.push(file);
    else if (['js', 'jsx'].includes(ext)) filesByType.javascript.push(file);
    else if (ext === 'rs') filesByType.rust.push(file);
    else if (['json', 'toml'].includes(ext) || file.includes('config')) filesByType.config.push(file);
    else if (ext === 'md') filesByType.markdown.push(file);
    else if (['css', 'scss', 'sass'].includes(ext)) filesByType.styles.push(file);
    else filesByType.other.push(file);
  });
  
  // 3️⃣ Context oluştur
  let contextText = `# 📦 PROJE YAPISI\n\n`;
  contextText += `** Proje Yolu:** ${ projectPath } \n`;
  contextText += `** Toplam Dosya:** ${ allFiles.length } \n\n`;
  
  contextText += `## 📊 Dosya Dağılımı\n\n`;
  contextText += `- ** TypeScript:** ${ filesByType.typescript.length } dosya\n`;
  contextText += `- ** JavaScript:** ${ filesByType.javascript.length } dosya\n`;
  contextText += `- ** Rust:** ${ filesByType.rust.length } dosya\n`;
  contextText += `- ** Config:** ${ filesByType.config.length } dosya\n`;
  contextText += `- ** Markdown:** ${ filesByType.markdown.length } dosya\n`;
  contextText += `- ** Styles:** ${ filesByType.styles.length } dosya\n`;
  contextText += `- ** Diğer:** ${ filesByType.other.length } dosya\n\n`;
  
  // 4️⃣ Klasör yapısını göster
  contextText += `## 📂 Klasör Yapısı\n\n`;
  
  const folderMap = new Map<string, string[]>();
  allFiles.forEach(file => {
    const relativePath = file.replace(projectPath, '').replace(/^[\\\/]/, '');
    const parts = relativePath.split(/[\\/]/);
    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
    const fileName = parts[parts.length - 1];
    
    if (!folderMap.has(folder)) {
      folderMap.set(folder, []);
    }
    folderMap.get(folder)!.push(fileName);
  });
  
  // Alfabetik sırala
  const sortedFolders = Array.from(folderMap.keys()).sort();
  sortedFolders.forEach(folder => {
    const files = folderMap.get(folder)!;
    contextText += `\n ** ${ folder }/** (${files.length} dosya)\n`;
    files.slice(0, 15).forEach(f => contextText += `  - ${f}\n`);
    if (files.length > 15) {
      contextText += `  ... ve ${files.length - 15} dosya daha\n`;
    }
  });
  
  // 5️⃣ Önemli config dosyalarının içeriğini ekle
  const importantFiles = allFiles.filter(f => 
    /package\.json$|tsconfig\.json$|Cargo\.toml$|tauri\.conf\.json$|vite\.config/i.test(f)
  );
  
  if (importantFiles.length > 0) {
    contextText += `\n## 📋 Önemli Dosyalar\n\n`;
    
    for (const file of importantFiles.slice(0, 5)) {
      try {
        const content = await invoke<string>('read_file_content', { path: file }); // ✅ FIXED
        const fileName = file.split(/[\\/]/).pop();
        contextText += `### ${fileName}\n\`\`\`json\n${content.substring(0, 1000)}\n...\n\`\`\`\n\n`;
      } catch (e) {
        console.warn(`⚠️ Dosya okunamadı: ${file}`);
      }
    }
  }
  
  // 6️⃣ Aktif dosyayı vurgula
  if (currentFile) {
    contextText += `\n## 📍 Aktif Dosya\n\n`;
    contextText += `**${currentFile}**\n\n`;
  }
  
  console.log(`✅ Context hazırlandı: ${contextText.length} karakter, ${allFiles.length} dosya`);
  return contextText;
}
*/

export async function sendToAI(
  message: string,
  resetHistory: boolean = false,
  onToolExecution?: (toolName: string, status: 'running' | 'completed' | 'failed', result?: any, error?: string) => void,
  onToolApprovalRequest?: (toolName: string, parameters: any) => Promise<boolean>
): Promise<string> {
  // Prevent concurrent calls
  if (sendToAI.isProcessing) {
    console.warn("⚠️ AI çağrısı zaten işleniyor, yeni çağrı reddedildi");
    throw new Error("AI çağrısı zaten işleniyor. Lütfen bekleyin.");
  }

  sendToAI.isProcessing = true;

  try {
    if (resetHistory) {
      conversationContext.history = [];
    }

    // 🆕 GGUF model config'inden context ve output limitlerini al
    const config = await storage.getSettings<any>('gguf-active-model');
    if (config) {
      conversationContext.maxContextTokens = config.contextLength || 32768;
      console.log(`📏 Context limit güncellendi: ${conversationContext.maxContextTokens}`);
    }

    // 🆕 Output mode'u localStorage'dan al
    const outputMode = await storage.getSettings<string>('ai-output-mode') || 'normal';
    conversationContext.maxOutputTokens =
      outputMode === 'brief' ? 2048 :
        outputMode === 'detailed' ? 16384 : 8192;

    console.log(`📤 Output limit: ${conversationContext.maxOutputTokens} (${outputMode})`);


    // Analyze user intent and update context
    const userIntent = analyzeUserIntent(message);
    updateConversationContext(message, userIntent);

    // Get tools prompt dynamically (includes MCP tools)
    const { getToolsPrompt } = await import('./aiTools');
    const toolsPrompt = await getToolsPrompt();

    // 🧠 CorexA Ultimate System Prompt — autonomy + verbosity + proje bağlamıyla
    const { getAutonomyConfig: getAutonomyCfg } = await import('./autonomy');
    const autonomyConfig = getAutonomyCfg();
    const corexMeta: AutonomyMeta = {
      level: autonomyConfig.level as 1 | 2 | 3 | 4 | 5,
      verbosity: outputMode === 'brief' ? 'concise' : outputMode === 'detailed' ? 'detailed' : 'balanced',
      modelName: getModelIdForRole(),
      projectPath: conversationContext.projectContext?.name || undefined,
      currentFile: conversationContext.recentFiles?.[0] || undefined,
    };
    const systemPrompt = selectPromptMode(message, toolsPrompt, corexMeta);
    console.log('🧠 CorexA System Prompt seçildi (level:', corexMeta.level, '| verbosity:', corexMeta.verbosity, ')');

    // Add system prompt if this is the first message
    if (conversationContext.history.length === 0) {
      conversationContext.history.push({
        role: "system",
        content: systemPrompt,
        timestamp: Date.now(),
        tokens: estimateTokens(systemPrompt)
      });
    }

    // Add user message to history
    const userTokens = estimateTokens(message);
    conversationContext.history.push({
      role: "user",
      content: message,
      timestamp: Date.now(),
      tokens: userTokens
    });

    // 🆕 Mesaj sayacını artır
    conversationContext.messagesSinceLastSummary++;

    // 🆕 Her 10 mesajda bir özet oluştur
    if (conversationContext.messagesSinceLastSummary >= 10) {
      console.log('📝 10 mesaj geçti, özet oluşturuluyor...');

      const summary = await generateSummary(conversationContext.history);

      if (summary) {
        conversationContext.summary = summary;
        conversationContext.messagesSinceLastSummary = 0;

        console.log('✅ Özet kaydedildi:', summary.substring(0, 100) + '...');
      }
    }

    // 🆕 History'yi temizle (context'in %40'ı history için)
    const maxHistoryTokens = Math.floor(conversationContext.maxContextTokens * 0.4);
    pruneHistory(maxHistoryTokens);

    // 🆕 Dinamik AI provider kullan - conversation history ile
    const { callAI } = await import('./aiProvider');
    const modelId = getModelIdForRole();

    // 🆕 Özet varsa history'nin başına ekle (system prompt'tan sonra)
    let historyWithSummary = [...conversationContext.history];
    if (conversationContext.summary) {
      const summaryMessage = {
        role: 'system',
        content: `📝 Önceki Konuşma Özeti:\n${conversationContext.summary}\n\n---\n`,
        timestamp: Date.now(),
        tokens: estimateTokens(conversationContext.summary)
      };

      // System prompt'tan sonra, diğer mesajlardan önce ekle
      historyWithSummary.splice(1, 0, summaryMessage);
      console.log('📌 Özet history\'ye eklendi');
    }

    // 🧠 RAG (Vektörel Kod Hafızası) Entegrasyonu
    try {
      const { ragService } = await import('./ragService');
      // Kullanıcının mesajındaki niyetine göre ilk 4 semantik parçayı bul
      const vectorResults = await ragService.search(message, 4);

      if (vectorResults && vectorResults.length > 0) {
        console.log(`🔍 RAG: ${vectorResults.length} adet kod bağlamı hafızadan çekildi.`);

        let ragContextText = "🧠 PROJE HAFIZASI (Vektörel Arama Sonuçları):\n\nBu bağlam sana projenin kod tabanından getirilmiştir. Lütfen yanıt verirken aşağıdaki dosyaların varlığını ve içeriğini bilerek hareket et:\n\n";

        vectorResults.forEach(res => {
          // Token şişmemesi için her dosyanın max 1500 karakterini al
          ragContextText += `--- DOSYA: ${res.file_path} ---\n\`\`\`\n${res.content.substring(0, 1500)}\n\`\`\`\n\n`;
        });

        // Bu veriyi hafızayı şişirmemek için ASIL HISTORY dizisine DEĞİL, sadece bu anlık isteğe giden historyWithSummary kopyasına ekliyoruz.
        const ragMessage = {
          role: "system",
          content: ragContextText,
          timestamp: Date.now(),
          tokens: estimateTokens(ragContextText)
        };

        // Kullanıcı mesajından (en son mesaj) hemen önce araya yerleştir
        const userMsgIndex = historyWithSummary.length - 1;
        historyWithSummary.splice(userMsgIndex, 0, ragMessage);
      }
    } catch (ragError) {
      console.warn("⚠️ RAG araması yapılamadı (Vektör DB henüz hazır olmayabilir):", ragError);
    }

    // Prepare conversation history for AI (only role and content)
    const historyForAI = historyWithSummary.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    console.log('📤 AI\'ye gönderilen history:', historyForAI.length, 'mesaj');
    console.log('📊 Tahmini history token:', conversationContext.history.reduce((sum, msg) => sum + (msg.tokens || 0), 0));

    // Add timeout to prevent hanging (5 minutes for GGUF models)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI çağrısı zaman aşımına uğradı (300 saniye)')), 300000);
    });

    let response = await Promise.race([
      callAI(message, modelId, historyForAI), // 🔥 History ile gönder
      timeoutPromise
    ]);

    // 🔧 TOOL SYSTEM - Parse and execute tools
    const { parseToolCalls, executeTool } = await import('./aiTools');
    const { requiresApproval } = await import('./autonomy');

    let toolCalls = parseToolCalls(response);
    let toolIterations = 0;
    const maxToolIterations = 5; // Sonsuz döngü önleme

    while (toolCalls.length > 0 && toolIterations < maxToolIterations) {
      toolIterations++;
      console.log(`🔧 Çoklu Tool Çağrısı tespit edildi (${toolIterations}/${maxToolIterations}): ${toolCalls.length} adet araç bulundu. =>`, toolCalls.map(t => t.toolName).join(', '));

      const sessionResults: string[] = [];
      for (const toolCall of toolCalls) {
        // 🎚️ AUTONOMY CHECK - Onay gerekli mi? (corexMeta.level zaten yukarıda tanımlı)
        const config = autonomyConfig;
        const needsApproval = requiresApproval(toolCall.toolName, toolCall.parameters, config);

        let executionResult: any = null;
        let isApproved = true;

        if (needsApproval && onToolApprovalRequest) {
          console.log('🔐 Tool onay gerektiriyor:', toolCall.toolName);
          const approved = await onToolApprovalRequest(toolCall.toolName, toolCall.parameters);

          if (!approved) {
            console.log('❌ Tool reddedildi:', toolCall.toolName);
            isApproved = false;
            executionResult = { success: false, error: 'User rejected the tool execution.' };
          } else {
            console.log('✅ Tool onaylandı:', toolCall.toolName);
          }
        } else {
          console.log('🚀 Tool otomatik çalıştırılıyor:', toolCall.toolName);
        }

        if (isApproved) {
          if (onToolExecution) onToolExecution(toolCall.toolName, 'running');

          executionResult = await executeTool(toolCall.toolName, toolCall.parameters);
          console.log(`🔧 Tool sonucu (${toolCall.toolName}):`, executionResult);

          if (onToolExecution) {
            if (executionResult.success) {
              onToolExecution(toolCall.toolName, 'completed', executionResult);
            } else {
              onToolExecution(toolCall.toolName, 'failed', executionResult, executionResult.error);
            }
          }
        }

        sessionResults.push(`🔧 Tool Result (${toolCall.toolName}):\n${JSON.stringify(executionResult, null, 2)}`);
      }

      // Tüm tool sonuçlarını tek mesaj olarak history'ye ekle
      const combinedToolResultMessage = sessionResults.join('\n\n');
      conversationContext.history.push({
        role: "user",
        content: combinedToolResultMessage,
        timestamp: Date.now(),
        tokens: estimateTokens(combinedToolResultMessage)
      });

      conversationContext.messagesSinceLastSummary++;

      // AI'ya tüm tool sonuçlarını gönder ve devam et
      const continuePrompt = "Araçlar(Tools) çalıştırıldı. Sonuçları yukarıda görebilirsin. Duruma göre adım adım ilerlemeye devam et.";
      const historyForAI2 = conversationContext.history.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      response = await Promise.race([
        callAI(continuePrompt, modelId, historyForAI2),
        timeoutPromise
      ]);

      // Yeni response'da başka tool var mı kontrol et
      toolCalls = parseToolCalls(response);
    }

    if (toolIterations >= maxToolIterations) {
      console.warn('⚠️ Maksimum tool iterasyonu aşıldı');
      response += '\n\n⚠️ (Maksimum tool çağrısı limitine ulaşıldı)';
    }

    // Add AI response to history
    const responseTokens = estimateTokens(response);
    conversationContext.history.push({
      role: "assistant",
      content: response,
      timestamp: Date.now(),
      tokens: responseTokens
    });

    // 🆕 AI cevabı da sayılır
    conversationContext.messagesSinceLastSummary++;

    // 🆕 Response çok uzunsa uyar
    if (responseTokens > conversationContext.maxOutputTokens * 0.9) {
      console.warn(`⚠️ Cevap çok uzun: ${responseTokens} token (limit: ${conversationContext.maxOutputTokens})`);
    }

    return response;
  } catch (error) {
    console.error('❌ AI hatası:', error);

    // Aktif model bulunamadıysa kullanıcıya bildir
    if (error instanceof Error && error.message.includes('Model bulunamadı')) {
      throw new Error('❌ Aktif AI modeli bulunamadı. Lütfen AI ayarlarından bir model aktif edin.');
    }

    // Bağlantı hatası varsa kullanıcıya bildir
    if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('network'))) {
      throw new Error('❌ AI sunucusuna bağlanılamadı. LM Studio veya AI sağlayıcınızın çalıştığından emin olun.');
    }

    // Timeout hatası
    if (error instanceof Error && error.message.includes('zaman aşımı')) {
      throw new Error('❌ AI yanıt verme süresi aşıldı. Lütfen tekrar deneyin.');
    }

    // Diğer hatalar için genel mesaj
    throw new Error(`❌ AI hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
  } finally {
    sendToAI.isProcessing = false;
  }
}

// ⚖️ MODEL KARŞILAŞTIRMA MODU
export async function compareModels(
  message: string,
  modelId1: string,
  modelId2: string,
  onToken1?: (token: string, metrics?: { speed: number }) => void,
  onToken2?: (token: string, metrics?: { speed: number }) => void
): Promise<{ response1: string; response2: string; metrics1: any; metrics2: any }> {
  console.log(`⚖️ Karşılaştırma başlatılıyor: ${modelId1} vs ${modelId2}`);

  const { callAI } = await import('./aiProvider');

  // Ortak history hazırla
  const historyForAI = conversationContext.history.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  const start1 = Date.now();
  let tokens1 = 0;
  const promise1 = callAI(message, modelId1, historyForAI, (token) => {
    tokens1++;
    const elapsed = (Date.now() - start1) / 1000;
    const speed = elapsed > 0 ? tokens1 / elapsed : 0;
    if (onToken1) onToken1(token, { speed });
  });

  const start2 = Date.now();
  let tokens2 = 0;
  const promise2 = callAI(message, modelId2, historyForAI, (token) => {
    tokens2++;
    const elapsed = (Date.now() - start2) / 1000;
    const speed = elapsed > 0 ? tokens2 / elapsed : 0;
    if (onToken2) onToken2(token, { speed });
  });

  const [res1, res2] = await Promise.all([promise1, promise2]);

  const end1 = Date.now();
  const end2 = Date.now();

  const metrics1 = {
    duration: (end1 - start1) / 1000,
    tokens: tokens1,
    speed: tokens1 / ((end1 - start1) / 1000)
  };

  const metrics2 = {
    duration: (end2 - start2) / 1000,
    tokens: tokens2,
    speed: tokens2 / ((end2 - start2) / 1000)
  };

  return {
    response1: res1,
    response2: res2,
    metrics1,
    metrics2
  };
}


// Add static property to track processing state
sendToAI.isProcessing = false;

// Map roles to specific AI models (legacy - not used anymore)
// function getModelTypeForRole(role: string): string {
//   switch (role) {
//     case "planner":
//       return "main"; // 7B model for planning
//     case "coder":
//       return "main"; // 7B model for coding
//     case "tester":
//       return "chat"; // 3B model for testing (faster)
//     case "reviewer":
//       return "main"; // 7B model for review
//     case "chat":
//       return "chat"; // 3B model for quick chat
//     case "llama":
//       return "llama"; // Llama 3.1 8B model for chat
//     default: // qwen - Ana model
//       return "main"; // 7B model as default
//   }
// }

// 🆕 Role'den Model ID'ye çevir (dinamik sistem için)
export function getModelIdForRole(): string {
  // Aktif provider'lardan uygun modeli bul
  const savedProviders = localStorage.getItem('corex-ai-providers');
  if (!savedProviders) {
    console.warn('⚠️ Provider bulunamadı');
    return "default"; // Fallback instead of crash
  }

  try {
    const providers = JSON.parse(savedProviders);
    console.log('🔍 Provider sayısı:', providers.length);

    // 🔥 ÖNCE GGUF provider'ı kontrol et - isActive durumuna bakmadan
    const ggufProvider = providers.find((p: any) => p.id === 'gguf-direct');
    if (ggufProvider && ggufProvider.models && ggufProvider.models.length > 0) {
      console.log('🎮 GGUF provider bulundu, model kontrolü yapılıyor...');

      // GGUF provider'da aktif model ara
      for (const model of ggufProvider.models) {
        console.log(`  🔍 GGUF Model: ${model.displayName}, isActive: ${model.isActive}`);
        if (model.isActive) {
          console.log(`🎯 GGUF aktif model bulundu: ${model.displayName} (${model.id})`);

          // 🔥 GGUF provider'ı aktif yap ve kaydet
          if (!ggufProvider.isActive) {
            console.log('⚠️ GGUF provider pasifti, aktif ediliyor...');
            ggufProvider.isActive = true;
            localStorage.setItem('corex-ai-providers', JSON.stringify(providers));
          }

          return model.id;
        }
      }
    }

    // GGUF'ta aktif model yoksa, diğer provider'ları kontrol et
    console.log('🔍 Diger providerlar kontrol ediliyor...');
    for (const provider of providers) {
      console.log(`🔍 Provider kontrol: ${provider.id}, isActive: ${provider.isActive}, models: ${provider.models?.length || 0}`);

      if (!provider.isActive) {
        console.log(`⏭️ Provider pasif, atlanıyor: ${provider.id}`);
        continue;
      }

      if (!provider.models || provider.models.length === 0) {
        console.log(`⏭️ Provider'da model yok: ${provider.id}`);
        continue;
      }

      for (const model of provider.models) {
        console.log(`  🔍 Model kontrol: ${model.displayName}, isActive: ${model.isActive}`);
        if (model.isActive) {
          console.log(`🎯 Aktif model bulundu: ${model.displayName} (${model.id})`);
          return model.id;
        }
      }
    }

    // Hiç aktif model bulunamadıysa, detaylı bilgi ver
    console.error('❌ Hiç aktif model bulunamadı!');
    console.error('📊 Provider durumları:', providers.map((p: any) => ({
      id: p.id,
      isActive: p.isActive,
      modelCount: p.models?.length || 0,
      activeModels: p.models?.filter((m: any) => m.isActive).length || 0
    })));

  } catch (error) {
    console.error('❌ Model ID çevirme hatası:', error);
  }

  console.warn('⚠️ Hiç aktif model bulunamadı');
  throw new Error('Aktif AI modeli bulunamadı. Lütfen AI ayarlarından bir model aktif edin.');
}

export function resetConversation() {
  conversationContext.history = [];
  conversationContext.currentTopic = null;
  conversationContext.ongoingTask = null;
  conversationContext.summary = null; // 🆕 Özeti temizle
  conversationContext.messagesSinceLastSummary = 0; // 🆕 Sayacı sıfırla
  console.log('🔄 Konuşma sıfırlandı (özet dahil)');
}

export function parseAIResponse(response: string): AIResponse {
  const actions: CodeAction[] = [];
  let cleanText = response;

  console.log("🔍 AI Response parse ediliyor:", response.substring(0, 200) + "...");

  // Match code blocks with optional file path: ```language:path or just ```language
  const codeBlockRegex = /```(\w+)(?::([^\n]+))?\n([\s\S]+?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(response)) !== null) {
    const language = match[1] || 'text';
    const explicitPath = match[2]?.trim(); // File path from ```typescript:src/test.ts
    const code = match[3].trim();

    // Skip single-line code blocks
    const lineCount = code.split('\n').length;
    if (lineCount === 1) {
      console.log(`⏭️ Tek satırlık kod bloğu atlandı: ${code.substring(0, 50)}...`);
      continue;
    }

    // Use explicit path if provided, otherwise try to extract from context
    let filePath = explicitPath;

    if (!filePath) {
      // Attempt to extract file path from context before the code block
      const beforeBlock = response.substring(0, match.index);
      const pathMatch = beforeBlock.match(/(?:dosya:|file:|path:|create|oluştur|update|düzenle|edit)[\s:]*([\w\/\-_.]+\.\w+)/i);
      filePath = pathMatch ? pathMatch[1] : generateDefaultPath(language);
    }

    // Determine action type from context
    const actionContext = response.substring(Math.max(0, match.index - 200), match.index).toLowerCase();
    let actionType: 'create' | 'modify' | 'delete' = 'create';

    if (actionContext.includes('oluştur') || actionContext.includes('create') || actionContext.includes('yeni')) {
      actionType = 'create';
    } else if (actionContext.includes('düzenle') || actionContext.includes('update') || actionContext.includes('değiştir') || actionContext.includes('edit') || actionContext.includes('modify')) {
      actionType = 'modify';
    } else if (actionContext.includes('sil') || actionContext.includes('delete') || actionContext.includes('kaldır')) {
      actionType = 'delete';
    }

    actions.push({
      id: `action-${Date.now()}-${actions.length}`,
      type: actionType,
      filePath,
      content: code,
      lineNumber: match.index
    });

    // Remove the code block from text to get clean explanation
    cleanText = cleanText.replace(match[0], `[Kod bloğu: ${filePath}]`);
  }

  console.log(`✅ ${actions.length} adet kod bloğu bulundu`);

  return {
    explanation: cleanText.trim(),
    actions,
    hasCode: actions.length > 0
  };
}

function generateDefaultPath(language: string): string {
  const timestamp = Date.now();
  const extensions: { [key: string]: string } = {
    typescript: 'ts',
    javascript: 'js',
    python: 'py',
    rust: 'rs',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    go: 'go',
    html: 'html',
    css: 'css',
    json: 'json'
  };

  const ext = extensions[language] || 'txt';
  return `generated_${timestamp}.${ext}`;
}

// Analyze user intent from message
function analyzeUserIntent(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('oluştur') || lowerMessage.includes('yarat') || lowerMessage.includes('yap') ||
    lowerMessage.includes('create') || lowerMessage.includes('generate')) {
    return 'create';
  } else if (lowerMessage.includes('düzenle') || lowerMessage.includes('değiştir') || lowerMessage.includes('güncelle') ||
    lowerMessage.includes('edit') || lowerMessage.includes('modify') || lowerMessage.includes('update')) {
    return 'edit';
  } else if (lowerMessage.includes('açıkla') || lowerMessage.includes('anlat') || lowerMessage.includes('nedir') ||
    lowerMessage.includes('explain') || lowerMessage.includes('what is') || lowerMessage.includes('how') ||
    lowerMessage.includes('yardım') || lowerMessage.includes('nasıl') || lowerMessage.includes('göster') ||
    lowerMessage.includes('fikir') || lowerMessage.includes('öneri')) {
    return 'explain';
  } else if (lowerMessage.includes('bul') || lowerMessage.includes('ara') || lowerMessage.includes('search') ||
    lowerMessage.includes('find')) {
    return 'search';
  } else if (lowerMessage.includes('hata') || lowerMessage.includes('bug') || lowerMessage.includes('düzelt') ||
    lowerMessage.includes('fix') || lowerMessage.includes('problem')) {
    return 'debug';
  } else if (lowerMessage.includes('optimize') || lowerMessage.includes('iyileştir') || lowerMessage.includes('geliştir') ||
    lowerMessage.includes('improve') || lowerMessage.includes('enhance')) {
    return 'optimize';
  } else if (lowerMessage.includes('test') || lowerMessage.includes('kontrol') || lowerMessage.includes('check')) {
    return 'test';
  }

  return 'chat';
}

// Update conversation context based on user message and intent
function updateConversationContext(message: string, intent: string) {
  // Extract file mentions
  const filePattern = /[\w\-_]+\.(ts|tsx|js|jsx|py|rs|java|cpp|c|go|html|css|json|md)/gi;
  const fileMentions = message.match(filePattern) || [];

  if (fileMentions.length > 0) {
    conversationContext.recentFiles = [
      ...new Set([...fileMentions, ...conversationContext.recentFiles])
    ].slice(0, 5); // Keep only last 5 unique files
  }

  // Detect ongoing task
  if (intent === 'create' || intent === 'edit') {
    conversationContext.ongoingTask = intent;
  } else if (intent === 'chat' && conversationContext.ongoingTask) {
    // Continue task if in middle of something
  } else {
    conversationContext.ongoingTask = null;
  }

  // Update current topic
  if (intent !== 'chat') {
    conversationContext.currentTopic = intent;
  }
}

// Build a contextual conversation by including relevant history (ŞU ANDA KULLANILMIYOR)
/* function buildContextualConversation(): Array<{ role: string; content: string }> {
  const contextWindow = 10; // Include last 10 messages for context
  const recentHistory = conversationContext.history.slice(-contextWindow);
  
  // Add context about recent files if relevant
  let contextPrefix = '';
  if (conversationContext.recentFiles.length > 0) {
    contextPrefix += `\n[Yakın zamanda bahsedilen dosyalar: ${conversationContext.recentFiles.join(', ')}]`;
  }
  
  if (conversationContext.ongoingTask) {
    contextPrefix += `\n[Devam eden görev: ${conversationContext.ongoingTask}]`;
  }
  
  // Add prefix to first user message in window if context exists
  if (contextPrefix && recentHistory.length > 0) {
    const firstUserMsgIndex = recentHistory.findIndex(m => m.role === 'user');
    if (firstUserMsgIndex !== -1) {
      recentHistory[firstUserMsgIndex] = {
        ...recentHistory[firstUserMsgIndex],
        content: contextPrefix + '\n\n' + recentHistory[firstUserMsgIndex].content
      };
    }
  }
  
  return recentHistory.map(({ role, content }) => ({ role, content }));
}
*/

// ===== EXPORTED CONTEXT FUNCTIONS =====

// Build context for AI with relevant files
export async function buildContext(
  userMessage: string,
  relevantFiles: Array<{ path: string; content: string; score: number }>,
  currentFile?: { path: string; content: string },
  totalIndexedFiles?: number,
  allFiles?: Array<{ path: string; content: string; embedding: number[]; lastModified?: number }>
): Promise<string> {
  // Detect casual conversation
  const isCasualChat = /^(selam|merhaba|hey|hi|hello|nasılsın|nasıl gidiyor|naber|ne yapıyorsun|teşekkür|sağol|thanks|thank you)$/i.test(userMessage.trim()) ||
    /^(günaydın|iyi akşamlar|iyi geceler|hoşça kal|görüşürüz|bye|good morning|good night)$/i.test(userMessage.trim());

  // Detect request type
  const isTranslationRequest = /türkçe (yap|çevir|söyle)|translate to turkish/i.test(userMessage);
  const isCodeRequest = /ekle|yaz|oluştur|değiştir|düzelt|implement|create|add|modify|fix|refactor|update/i.test(userMessage);
  const isProjectExplanation = /proje|açıkla|anlat|mimari|yapı|structure|explain|describe|what is|nedir/i.test(userMessage);

  let context = "";

  // Handle casual conversation
  if (isCasualChat) {
    context += `Sen Corex AI'sın - arkadaş canlısı kod asistanı.

SOHBET MODU:
- Kendini tanıt: "Merhaba! Ben Corex 👋"
- Samimi ol, emoji kullan 😊
- Yardım teklif et

KULLANICI: "${userMessage}"

Doğal ve samimi karşılık ver!
`;
    return context;
  }

  // If this is just a translation request, don't add file context
  if (isTranslationRequest) {
    context += "=== KULLANICI İSTEĞİ ===\n\n";
    context += userMessage;
    context += "\n\nNOT: Kullanıcı önceki cevabını Türkçeye çevirmeni istiyor. Sadece önceki cevabını Türkçe olarak tekrar yaz, yeni analiz yapma.\n";
    return context;
  }

  // Enhanced personality introduction - KISA (Token tasarrufu)
  context += `Sen Corex AI'sın - kod asistanı.

PROJE: ${conversationContext.projectContext.name || 'Bilinmiyor'}
TÜR: ${conversationContext.projectContext.type !== 'unknown' ? conversationContext.projectContext.type : 'Bilinmiyor'}
DOSYA: ${totalIndexedFiles || 0}

`;

  // 🆕 Proje açıklama isteğinde - Detay seviyesi sor
  if (isProjectExplanation && !isCodeRequest && allFiles) {
    // Kullanıcı detay seviyesi belirtmiş mi kontrol et
    const detailLevel = userMessage.toLowerCase().includes('detaylı') || userMessage.toLowerCase().includes('derin') || userMessage.toLowerCase().includes('detailed') ? 'detailed' :
      userMessage.toLowerCase().includes('kısa') || userMessage.toLowerCase().includes('öz') || userMessage.toLowerCase().includes('brief') ? 'brief' :
        'ask'; // Belirtmemişse sor

    // Eğer detay seviyesi belirtilmemişse, kullanıcıya sor
    if (detailLevel === 'ask') {
      context += `Sen Corex AI'sın - kod asistanı.

KULLANICI SORUSU: "${userMessage}"

Bu proje hakkında bilgi vermek istiyorum. Nasıl anlatmamı istersin?

📋 **SEÇENEKLER:**

1️⃣ **KISA VE ÖZ** (3-5 cümle)
   - Proje ne yapar?
   - Hangi teknolojiler kullanılmış?
   - Ana özellikler neler?

2️⃣ **DETAYLI VE DERİN** (Kapsamlı analiz)
   - Tüm dosya yapısı
   - Her modülün açıklaması
   - Kod örnekleri
   - Mimari detayları
   - Bağımlılıklar ve ilişkiler

Lütfen seçim yap: "kısa anlat" veya "detaylı anlat" 😊`;
      return context;
    }

    // Import fonksiyonları
    const { getImportantFiles, getProjectStructureFiles, getFileExtension: getExt } = await import('./contextProvider');

    context += "=== PROJE ANALİZİ ===\n\n";

    if (detailLevel === 'brief') {
      // KISA VE ÖZ - Sadece özet bilgi
      const importantFiles = getImportantFiles(allFiles);

      context += "📋 Önemli Dosyalar:\n";
      importantFiles.slice(0, 5).forEach((file: any) => {
        const fileName = file.path.split(/[\\/]/).pop() || file.path;
        context += `• ${fileName}\n`;
      });
      context += "\n";

      const folders = new Set<string>();
      allFiles.forEach((file: any) => {
        const pathParts = file.path.split(/[\\/]/);
        if (pathParts.length > 1) folders.add(pathParts[0]);
      });

      context += "📂 Ana Klasörler:\n";
      Array.from(folders).slice(0, 8).forEach(folder => {
        const fileCount = allFiles.filter((f: any) => f.path.startsWith(folder)).length;
        context += `• ${folder}/ (${fileCount} dosya)\n`;
      });

      context += `\n📊 Toplam ${totalIndexedFiles} dosya\n\n`;
      context += "=== GÖREV ===\n\n";
      context += "Projeyi KISA ve ÖZ açıkla (3-5 cümle):\n";
      context += "- Ne yapar?\n";
      context += "- Hangi teknolojiler?\n";
      context += "- Ana özellikler?\n";

    } else {
      // DETAYLI - Tüm bilgileri ver
      const importantFiles = getImportantFiles(allFiles);

      context += "📋 Önemli Dosyalar (İçerikli):\n\n";
      importantFiles.forEach((file: any) => {
        const fileName = file.path.split(/[\\/]/).pop() || file.path;
        context += `✅ ${fileName}\n`;

        if (file.content && file.content.length > 0) {
          context += "```" + getExt(file.path) + "\n";
          context += file.content.substring(0, 2000); // 2000 karakter
          if (file.content.length > 2000) {
            context += "\n... (devamı var)";
          }
          context += "\n```\n\n";
        }
      });

      const structureFiles = getProjectStructureFiles(allFiles);
      context += "📁 Ana Yapı Dosyaları:\n";
      structureFiles.slice(0, 20).forEach((file: any) => {
        const fileName = file.path.split(/[\\/]/).pop() || file.path;
        const pathParts = file.path.split(/[\\/]/);
        const folder = pathParts.length > 1 ? pathParts[pathParts.length - 2] : '';
        context += `• ${folder}/${fileName}\n`;
      });
      context += "\n";

      const folders = new Map<string, number>();
      allFiles.forEach((file: any) => {
        const pathParts = file.path.split(/[\\/]/);
        if (pathParts.length > 1) {
          const folder = pathParts[0];
          folders.set(folder, (folders.get(folder) || 0) + 1);
        }
      });

      context += "📂 Klasör Yapısı:\n";
      Array.from(folders.entries()).forEach(([folder, count]) => {
        context += `• ${folder}/ (${count} dosya)\n`;
      });

      context += `\n📊 Toplam ${totalIndexedFiles} dosya\n\n`;
      context += "=== GÖREV ===\n\n";
      context += "Projeyi DETAYLI açıkla:\n";
      context += "1. Proje amacı ve ne yaptığı\n";
      context += "2. Kullanılan teknolojiler ve framework'ler\n";
      context += "3. Klasör yapısı ve organizasyon\n";
      context += "4. Ana modüller ve görevleri\n";
      context += "5. Önemli dosyaların açıklaması\n";
      context += "6. Mimari yapı ve tasarım desenleri\n";
      context += "7. Bağımlılıklar ve entegrasyonlar\n";
    }

    return context;
  }

  // Add relevant files with content
  if (relevantFiles.length > 0) {
    context += "=== İLGİLİ DOSYALAR ===\n\n";

    relevantFiles.slice(0, 3).forEach(file => { // Maksimum 3 dosya
      const fileName = file.path.split(/[\\/]/).pop() || file.path;
      const fullPath = file.path;
      context += `📄 ${fileName} (${fullPath})\n`;
      context += `Similarity: ${(file.score * 100).toFixed(1)}%\n`;

      if (isCodeRequest) {
        context += "```" + getFileExtension(file.path) + "\n";
        // 4000 → 1500 karakter (çok daha az!)
        context += file.content.substring(0, 1500);
        if (file.content.length > 1500) {
          context += "\n... (devamı var)";
        }
        context += "\n```\n\n";
      }
    });
  }

  // Add current file if open
  if (currentFile && isCodeRequest) {
    const fileName = currentFile.path.split(/[\\/]/).pop() || currentFile.path;
    context += "=== AÇIK DOSYA ===\n\n";
    context += `📄 ${fileName} (${currentFile.path})\n`;
    context += "```" + getFileExtension(currentFile.path) + "\n";
    // 5000 → 2000 karakter (daha az!)
    context += currentFile.content.substring(0, 2000);
    if (currentFile.content.length > 2000) {
      context += "\n... (devamı var)";
    }
    context += "\n```\n\n";
  }

  context += "=== MESAJ ===\n\n";
  context += userMessage;
  context += "\n\n";

  // 🔧 KISA talimat
  context += "💡 Kısa ve öz cevap ver. TÜRKÇE.\n";

  return context;
}

// Get conversation context
export function getConversationContext(): ConversationContext {
  return conversationContext;
}

// Set user preferences
export function setUserPreferences(preferences: Partial<ConversationContext['userPreferences']>) {
  conversationContext.userPreferences = {
    ...conversationContext.userPreferences,
    ...preferences
  };
}

// Project context management
export function updateProjectContext(projectPath: string, fileIndex: any[]) {
  const projectName = projectPath.split(/[\\/]/).pop() || 'Unknown';

  // Detect project type
  const hasPackageJson = fileIndex.some(f => f.path.includes('package.json'));
  const hasCargoToml = fileIndex.some(f => f.path.includes('Cargo.toml'));
  const hasPyProject = fileIndex.some(f => f.path.includes('pyproject.toml'));

  let projectType = 'unknown';
  if (hasPackageJson) projectType = 'javascript/typescript';
  else if (hasCargoToml) projectType = 'rust';
  else if (hasPyProject) projectType = 'python';

  // Detect main languages
  const languages = new Set<string>();
  fileIndex.forEach(file => {
    const ext = file.path.split('.').pop()?.toLowerCase();
    if (ext) {
      const langMap: Record<string, string> = {
        'ts': 'TypeScript',
        'tsx': 'TypeScript React',
        'js': 'JavaScript',
        'jsx': 'JavaScript React',
        'rs': 'Rust',
        'py': 'Python',
        'css': 'CSS',
        'html': 'HTML'
      };
      if (langMap[ext]) languages.add(langMap[ext]);
    }
  });

  conversationContext.projectContext = {
    name: projectName,
    type: projectType,
    mainLanguages: Array.from(languages)
  };
}

// Enhanced Smart Code Generator
export async function generateSmartCode(
  description: string,
  context: {
    projectType?: string;
    recentFiles?: string[];
    dependencies?: string[];
  }
): Promise<{ code: string; explanation: string; filePath: string }> {
  const enhancedPrompt = `Görev: Akıllı Kod Üretimi

AÇIKLAMA: ${description}

PROJE BAĞLAMI:
- Proje Tipi: ${context.projectType || 'Bilinmiyor'}
- Son Dosyalar: ${context.recentFiles?.join(', ') || 'Yok'}
- Bağımlılıklar: ${context.dependencies?.join(', ') || 'Yok'}

GÖREV:
1. Verilen açıklamaya göre EKSIKSIZ, ÇALIŞAN kod üret
2. Best practice'lere uygun ol
3. TypeScript kullan (tip güvenliği için)
4. Gerekli import'ları ekle
5. Açıklayıcı yorumlar yaz
6. Hata kontrolü ekle

ÇIKTI FORMATI:
DOSYA: [dosya_yolu]
\`\`\`typescript
[TAM KOD BURAYA]
\`\`\`

AÇIKLAMA:
[Kodun ne yaptığını açıkla, 2-3 cümle]`;

  try {
    const response = await sendToAI(enhancedPrompt, false);
    const parsed = parseAIResponse(response);

    if (parsed.actions && parsed.actions.length > 0) { // ✅ FIXED: Added null check
      const action = parsed.actions[0];
      return {
        code: action.content,
        explanation: parsed.explanation, // ✅ FIXED: Changed from 'message'
        filePath: action.filePath
      };
    }

    return {
      code: '',
      explanation: response,
      filePath: 'generated.ts'
    };
  } catch (error) {
    console.error('Smart code generation error:', error);
    throw error;
  }
}

// File-specific AI functions
export async function explainCode(filePath: string, code: string): Promise<string> {
  const prompt = `Sen bir kod eğitmenisin. Aşağıdaki kodu DETAYLI ama ANLAŞILIR bir şekilde açıkla:

DOSYA: ${filePath}
\`\`\`${getFileExtension(filePath)}
${code}
\`\`\`

GÖREV: Bu kodu şöyle açıkla:
1. Ne yapıyor? (Ana işlev)
2. Nasıl yapıyor? (Adım adım)
3. Neden bu şekilde? (Mantık)
4. Dikkat edilmesi gerekenler

Açıklaman SAMİMİ ve ÖĞRETİCİ olsun!`;

  try {
    return await sendToAI(prompt, false);
  } catch (error) {
    console.error('Code explanation error:', error);
    return 'Kod açıklaması oluşturulamadı.';
  }
}

export async function suggestImprovements(filePath: string, code: string): Promise<{
  suggestions: Array<{
    line: number;
    type: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  summary: string;
}> {
  const improvementPrompt = `Sen bir kod review uzmanısın. Aşağıdaki kodu analiz et ve iyileştirme önerileri sun:

DOSYA: ${filePath}
\`\`\`${getFileExtension(filePath)}
${code}
\`\`\`

GÖREV: Bu kodu şu açılardan değerlendir:
1. Performans iyileştirmeleri
2. Kod kalitesi (clean code)
3. Best practices
4. Güvenlik
5. Okunabilirlik
6. Maintainability

ÇIKTI FORMATI:
ÖNERI 1:
- Satır: [satır numarası]
- Tür: [performance/quality/security/readability]
- Öncelik: [high/medium/low]
- Öneri: [detaylı açıklama]

[Diğer öneriler...]

ÖZET:
[Genel değerlendirme ve ana öneriler]`;

  try {
    const response = await sendToAI(improvementPrompt, false);

    // Parse response
    const suggestions: any[] = [];
    const suggestionPattern = /ÖNERI \d+:\s*-\s*Satır:\s*(\d+)\s*-\s*Tür:\s*(\w+)\s*-\s*Öncelik:\s*(\w+)\s*-\s*Öneri:\s*(.+?)(?=ÖNERI \d+:|ÖZET:|$)/gs;

    let match;
    while ((match = suggestionPattern.exec(response)) !== null) {
      suggestions.push({
        line: parseInt(match[1]),
        type: match[2],
        priority: match[3].toLowerCase() as any,
        suggestion: match[4].trim()
      });
    }

    const summaryMatch = response.match(/ÖZET:\s*(.+?)$/s);
    const summary = summaryMatch ? summaryMatch[1].trim() : "Kod analizi tamamlandı.";

    return { suggestions, summary };
  } catch (error) {
    console.error('Code improvement suggestion error:', error);
    return {
      suggestions: [],
      summary: 'İyileştirme önerileri oluşturulamadı.'
    };
  }
}

export async function generateTests(filePath: string, code: string): Promise<{
  testCode: string;
  coverage: string[];
}> {
  const testPrompt = `Sen bir test uzmanısın. Aşağıdaki kod için KAPSAMLI testler yaz:

DOSYA: ${filePath}
\`\`\`${getFileExtension(filePath)}
${code}
\`\`\`

GÖREV: Bu kod için testler oluştur:
1. Unit testler (her fonksiyon için)
2. Edge case'ler
3. Error handling testleri
4. Integration testleri (gerekirse)

Test framework: Jest/Vitest kullan
ÇIKTI: Tam çalışan test kodu

KAPSAM LİSTESİ:
- [Test edilen özellik 1]
- [Test edilen özellik 2]
- ...`;

  try {
    const response = await sendToAI(testPrompt, false);
    const parsed = parseAIResponse(response);

    const testCode = (parsed.actions && parsed.actions.length > 0) ? parsed.actions[0].content : ''; // ✅ FIXED

    // Extract coverage list
    const coveragePattern = /-\s*(.+)/g;
    const coverage: string[] = [];
    let match;
    while ((match = coveragePattern.exec(response)) !== null) {
      coverage.push(match[1].trim());
    }

    return { testCode, coverage };
  } catch (error) {
    console.error('Test generation error:', error);
    return {
      testCode: '',
      coverage: []
    };
  }
}

export async function fixBugs(filePath: string, code: string, bugDescription?: string): Promise<{
  fixedCode: string;
  explanation: string;
  changesDescription: string[];
}> {
  const bugPrompt = `Sen bir debugging uzmanısın. Aşağıdaki koddaki hatayı bul ve düzelt:

DOSYA: ${filePath}
\`\`\`${getFileExtension(filePath)}
${code}
\`\`\`

${bugDescription ? `HATA AÇIKLAMASI: ${bugDescription}` : 'Kodda olası hataları tespit et ve düzelt.'}

GÖREV:
1. Hatayı bul ve analiz et
2. Düzeltilmiş kodu yaz (TAM KOD)
3. Neyi nasıl düzelttiğini açıkla

ÇIKTI FORMATI:
DÜZELTİLMİŞ KOD:
\`\`\`${getFileExtension(filePath)}
[Düzeltilmiş tam kod]
\`\`\`

AÇIKLAMA:
[Hatanın ne olduğu ve nasıl düzeltildiği]

DEĞİŞİKLİKLER:
- [Değişiklik 1]
- [Değişiklik 2]`;

  try {
    const response = await sendToAI(bugPrompt, false);
    const parsed = parseAIResponse(response);

    const fixedCode = (parsed.actions && parsed.actions.length > 0) ? parsed.actions[0].content : ''; // ✅ FIXED

    // Extract changes
    const changesPattern = /-\s*(.+)/g;
    const changesDescription: string[] = [];
    let match;
    while ((match = changesPattern.exec(response)) !== null) {
      changesDescription.push(match[1].trim());
    }

    return {
      fixedCode,
      explanation: parsed.explanation, // ✅ FIXED: Changed from 'message'
      changesDescription
    };
  } catch (error) {
    console.error('Bug fix error:', error);
    return {
      fixedCode: '',
      explanation: 'Hata düzeltmesi oluşturulamadı.',
      changesDescription: []
    };
  }
}

// Get file extension from path
function getFileExtension(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'rs': 'rust',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'go': 'go',
    'html': 'html',
    'css': 'css',
    'json': 'json'
  };
  return langMap[ext || ''] || ext || 'text';
}

// Documentation Generator
export async function generateDocumentation(filePath: string, code: string): Promise<{
  documentation: string;
  apiReference?: string;
}> {
  const docPrompt = `Sen bir teknik yazım uzmanısın. Aşağıdaki kod için DETAYLI dokümantasyon oluştur:

DOSYA: ${filePath}
\`\`\`${getFileExtension(filePath)}
${code}
\`\`\`

GÖREV: Bu kod için kapsamlı dokümantasyon yaz:
1. Genel bakış (ne yapar?)
2. Kullanım örnekleri
3. API referansı (fonksiyonlar, parametreler, dönüş değerleri)
4. Önemli notlar
5. İlgili dosyalar/modüller

Markdown formatında yaz.`;

  try {
    const response = await sendToAI(docPrompt, false);

    return {
      documentation: response,
      apiReference: extractAPIReference(response)
    };
  } catch (error) {
    console.error('Documentation generation error:', error);
    return {
      documentation: 'Dokümantasyon oluşturulamadı.',
      apiReference: ''
    };
  }
}

function extractAPIReference(doc: string): string {
  const apiSection = doc.match(/## API.*?(?=##|$)/s);
  return apiSection ? apiSection[0] : '';
}

// Code Review AI
export async function performCodeReview(filePath: string, content: string): Promise<{
  score: number;
  issues: Array<{
    line: number;
    type: 'error' | 'warning' | 'suggestion';
    message: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  suggestions: string[];
  summary: string;
}> {
  const reviewPrompt = `Sen bir kod inceleme uzmanısın. Aşağıdaki kodu analiz et:

DOSYA: ${filePath}
\`\`\`${getFileExtension(filePath)}
${content}
\`\`\`

GÖREV: Bu kodu şu kriterlere göre incele:
1. Kod kalitesi ve okunabilirlik
2. Güvenlik açıkları
3. Performance sorunları
4. Best practice uyumu
5. Hata yakalama
6. Type safety (TypeScript için)

ÇIKTI FORMATI:
SKOR: [0-100 arası puan]

SORUNLAR:
- Satır X: [Sorun türü] - [Açıklama]

ÖNERİLER:
- [Genel iyileştirme önerisi]

ÖZET:
[Genel değerlendirme]`;

  try {
    const response = await sendToAI(reviewPrompt, false);

    // Parse response
    const scoreMatch = response.match(/SKOR:\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 75;

    const issues: any[] = [];
    const issueMatches = response.matchAll(/Satır\s+(\d+):\s*\[([^\]]+)\]\s*-\s*(.+)/gi);
    for (const match of issueMatches) {
      issues.push({
        line: parseInt(match[1]),
        type: match[2].toLowerCase().includes('error') ? 'error' :
          match[2].toLowerCase().includes('warning') ? 'warning' : 'suggestion',
        message: match[3].trim(),
        severity: match[2].toLowerCase().includes('critical') ? 'high' :
          match[2].toLowerCase().includes('major') ? 'high' :
            match[2].toLowerCase().includes('minor') ? 'low' : 'medium'
      });
    }

    // Parse suggestions
    const suggestions: string[] = [];
    const suggestionSection = response.split(/ÖNERİLER:/i)[1]?.split(/ÖZET:/i)[0];
    if (suggestionSection) {
      const suggestionMatches = suggestionSection.match(/^-\s*(.+)$/gm);
      if (suggestionMatches) {
        suggestions.push(...suggestionMatches.map(s => s.replace(/^-\s*/, '').trim()));
      }
    }

    const summaryMatch = response.split(/ÖZET:/i)[1];
    const summary = summaryMatch ? summaryMatch.trim() : "Kod incelemesi tamamlandı.";

    return { score, issues, suggestions, summary };
  } catch (error) {
    console.error('Code review error:', error);
    return {
      score: 50,
      issues: [],
      suggestions: ['Kod incelemesi sırasında hata oluştu.'],
      summary: 'İnceleme tamamlanamadı.'
    };
  }
}

// Refactoring Suggestions
export async function suggestRefactoring(filePath: string, code: string): Promise<{
  suggestions: Array<{
    type: string;
    description: string;
    before: string;
    after: string;
    benefit: string;
  }>;
  summary: string;
}> {
  const refactorPrompt = `Sen bir refactoring uzmanısın. Aşağıdaki kodu analiz et ve refactoring önerileri sun:

DOSYA: ${filePath}
\`\`\`${getFileExtension(filePath)}
${code}
\`\`\`

GÖREV: Bu kodu şu açılardan değerlendir:
1. Code smell'ler
2. Design pattern kullanımı
3. SOLID prensipleri
4. DRY prensibi
5. Naming conventions
6. Function/method boyutları

Her öneri için:
- Tür (extraction, simplification, pattern application, etc.)
- Açıklama
- Önce/Sonra kod örnekleri
- Faydası

ÇIKTI FORMATI:
ÖNERİ 1:
TÜR: [refactoring türü]
AÇIKLAMA: [ne yapılmalı]
ÖNCE:
\`\`\`typescript
[mevcut kod]
\`\`\`
SONRA:
\`\`\`typescript
[refactor edilmiş kod]
\`\`\`
FAYDA: [bu refactoring'in faydası]

ÖZET:
[Genel refactoring değerlendirmesi]`;

  try {
    const response = await sendToAI(refactorPrompt, false);

    const suggestions: any[] = [];
    const suggestionPattern = /ÖNERİ \d+:\s*TÜR:\s*(.+?)\s*AÇIKLAMA:\s*(.+?)\s*ÖNCE:\s*```[\w]*\s*(.+?)\s*```\s*SONRA:\s*```[\w]*\s*(.+?)\s*```\s*FAYDA:\s*(.+?)(?=ÖNERİ \d+:|ÖZET:|$)/gs;

    let match;
    while ((match = suggestionPattern.exec(response)) !== null) {
      suggestions.push({
        type: match[1].trim(),
        description: match[2].trim(),
        before: match[3].trim(),
        after: match[4].trim(),
        benefit: match[5].trim()
      });
    }

    const summaryMatch = response.match(/ÖZET:\s*(.+?)$/s);
    const summary = summaryMatch ? summaryMatch[1].trim() : "Refactoring analizi tamamlandı.";

    return { suggestions, summary };
  } catch (error) {
    console.error('Refactoring suggestion error:', error);
    return {
      suggestions: [],
      summary: 'Refactoring önerileri oluşturulamadı.'
    };
  }
}

// Security Scanner
export async function scanSecurity(filePath: string, content: string): Promise<{
  vulnerabilities: Array<{
    line: number;
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    solution: string;
  }>;
  score: number;
  summary: string;
}> {
  const securityPrompt = `Sen bir güvenlik uzmanısın. Aşağıdaki kodu güvenlik açıkları için analiz et:

DOSYA: ${filePath}
\`\`\`${getFileExtension(filePath)}
${content}
\`\`\`

GÖREV: Bu kodu şu güvenlik açıkları için kontrol et:
1. SQL Injection
2. XSS (Cross-Site Scripting)
3. CSRF (Cross-Site Request Forgery)
4. Authentication/Authorization sorunları
5. Input validation eksiklikleri
6. Sensitive data exposure
7. Insecure dependencies

ÇIKTI FORMATI:
GÜVENLIK SKORU: [0-100 arası puan]

AÇIKLAR:
- Satır X: [Açık türü] - SEVERITY: [critical/high/medium/low] - [Açıklama] - ÇÖZÜM: [Çözüm önerisi]

ÖZET:
[Genel güvenlik değerlendirmesi]`;

  try {
    const response = await sendToAI(securityPrompt, false);

    const scoreMatch = response.match(/GÜVENLIK SKORU:\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 80;

    const vulnerabilities: any[] = [];
    const vulnMatches = response.matchAll(/Satır\s+(\d+):\s*([^-]+)\s*-\s*SEVERITY:\s*([^-]+)\s*-\s*([^-]+)\s*-\s*ÇÖZÜM:\s*(.+)/gi);

    for (const match of vulnMatches) {
      vulnerabilities.push({
        line: parseInt(match[1]),
        type: match[2].trim(),
        severity: match[3].trim().toLowerCase() as any,
        description: match[4].trim(),
        solution: match[5].trim()
      });
    }

    const summaryMatch = response.split(/ÖZET:/i)[1];
    const summary = summaryMatch ? summaryMatch.trim() : "Güvenlik taraması tamamlandı.";

    return { vulnerabilities, score, summary };
  } catch (error) {
    console.error('Security scan error:', error);
    return {
      vulnerabilities: [],
      score: 50,
      summary: 'Güvenlik taraması tamamlanamadı.'
    };
  }
}

// Package Manager AI
export async function analyzePackages(packageJsonContent: string): Promise<{
  outdated: Array<{
    name: string;
    current: string;
    latest: string;
    type: 'major' | 'minor' | 'patch';
  }>;
  security: Array<{
    name: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  }>;
  suggestions: string[];
  summary: string;
}> {
  const packagePrompt = `Sen bir paket yönetimi uzmanısın. Aşağıdaki package.json dosyasını analiz et:

\`\`\`json
${packageJsonContent}
\`\`\`

GÖREV: Bu paketleri analiz et:
1. Güncel olmayan paketleri tespit et
2. Güvenlik açığı olan paketleri bul
3. Gereksiz paketleri belirle
4. Alternatif paket önerileri sun

ÇIKTI FORMATI:
=== ESKİ PAKETLER ===
- [paket-adı]: [mevcut-versiyon] → [yeni-versiyon] ([major/minor/patch])

=== GÜVENLİK ===
- [paket-adı]: [critical/high/medium/low] - [açıklama]

=== ÖNERİLER ===
- [Genel öneriler]

=== ÖZET ===
[Genel değerlendirme]`;

  try {
    const response = await sendToAI(packagePrompt, false);

    // Parse outdated packages
    const outdated: any[] = [];
    const outdatedSection = response.split(/=== ESKİ PAKETLER ===/i)[1]?.split(/=== GÜVENLİK ===/i)[0];
    if (outdatedSection) {
      const outdatedMatches = outdatedSection.matchAll(/^-\s*([^:]+):\s*([^\s]+)\s*→\s*([^\s]+)\s*\(([^)]+)\)/gm);
      for (const match of outdatedMatches) {
        outdated.push({
          name: match[1].trim(),
          current: match[2].trim(),
          latest: match[3].trim(),
          type: match[4].trim() as any
        });
      }
    }

    // Parse security issues
    const security: any[] = [];
    const securitySection = response.split(/=== GÜVENLİK ===/i)[1]?.split(/=== ÖNERİLER ===/i)[0];
    if (securitySection) {
      const securityMatches = securitySection.matchAll(/^-\s*([^:]+):\s*([^\s]+)\s*-\s*(.+)/gm);
      for (const match of securityMatches) {
        security.push({
          name: match[1].trim(),
          severity: match[2].trim().toLowerCase() as any,
          description: match[3].trim()
        });
      }
    }

    // Parse suggestions
    const suggestions: string[] = [];
    const suggestionSection = response.split(/=== ÖNERİLER ===/i)[1]?.split(/=== ÖZET ===/i)[0];
    if (suggestionSection) {
      const suggestionMatches = suggestionSection.match(/^-\s*(.+)$/gm);
      if (suggestionMatches) {
        suggestions.push(...suggestionMatches.map(s => s.replace(/^-\s*/, '').trim()));
      }
    }

    const summaryMatch = response.split(/=== ÖZET ===/i)[1];
    const summary = summaryMatch ? summaryMatch.trim() : "Paket analizi tamamlandı.";

    return { outdated, security, suggestions, summary };
  } catch (error) {
    console.error('Package analysis error:', error);
    return {
      outdated: [],
      security: [],
      suggestions: ['Paket analizi sırasında hata oluştu.'],
      summary: 'Analiz tamamlanamadı.'
    };
  }
}

// Environment Manager AI
export async function analyzeEnvironment(envContent: string): Promise<{
  missing: string[];
  insecure: Array<{
    key: string;
    issue: string;
    suggestion: string;
  }>;
  suggestions: string[];
  template: string;
}> {
  const envPrompt = `Sen bir environment yönetimi uzmanısın. Aşağıdaki .env dosyasını analiz et:

\`\`\`
${envContent}
\`\`\`

GÖREV: Bu environment dosyasını analiz et:
1. Eksik olabilecek yaygın değişkenleri tespit et
2. Güvenlik sorunlarını bul
3. İyileştirme önerileri sun
4. .env.example şablonu oluştur

ÇIKTI FORMATI:
=== EKSİK DEĞİŞKENLER ===
- [değişken-adı]

=== GÜVENLİK SORUNLARI ===
- [değişken-adı]: [sorun] - ÖNERİ: [çözüm]

=== ÖNERİLER ===
- [Genel öneriler]

=== ŞABLON ===
[.env.example içeriği]`;

  try {
    const response = await sendToAI(envPrompt, false);

    // Parse missing variables
    const missing: string[] = [];
    const missingSection = response.split(/=== EKSİK DEĞİŞKENLER ===/i)[1]?.split(/=== GÜVENLİK SORUNLARI ===/i)[0];
    if (missingSection) {
      const missingMatches = missingSection.match(/^-\s*(.+)$/gm);
      if (missingMatches) {
        missing.push(...missingMatches.map(s => s.replace(/^-\s*/, '').trim()));
      }
    }

    // Parse security issues
    const insecure: any[] = [];
    const securitySection = response.split(/=== GÜVENLİK SORUNLARI ===/i)[1]?.split(/=== ÖNERİLER ===/i)[0];
    if (securitySection) {
      const securityMatches = securitySection.matchAll(/^-\s*([^:]+):\s*([^-]+)\s*-\s*ÖNERİ:\s*(.+)/gm);
      for (const match of securityMatches) {
        insecure.push({
          key: match[1].trim(),
          issue: match[2].trim(),
          suggestion: match[3].trim()
        });
      }
    }

    // Parse suggestions
    const suggestions: string[] = [];
    const suggestionSection = response.split(/=== ÖNERİLER ===/i)[1]?.split(/=== ŞABLON ===/i)[0];
    if (suggestionSection) {
      const suggestionMatches = suggestionSection.match(/^-\s*(.+)$/gm);
      if (suggestionMatches) {
        suggestions.push(...suggestionMatches.map(s => s.replace(/^-\s*/, '').trim()));
      }
    }

    const templateMatch = response.split(/=== ŞABLON ===/i)[1];
    const template = templateMatch ? templateMatch.trim() : '';

    return { missing, insecure, suggestions, template };
  } catch (error) {
    console.error('Environment analysis error:', error);
    return {
      missing: [],
      insecure: [],
      suggestions: ['Environment analizi sırasında hata oluştu.'],
      template: ''
    };
  }
}

// ============================================================
// PANEL ADAPTER FUNCTIONS — EnhancedAIPanel için doğru format
// ============================================================

/**
 * EnhancedAIPanel → Documentation sekmesi adapter.
 * AI'dan readme, apiDocs, comments formatında döner.
 */
export async function generateDocumentationForPanel(
  filePath: string,
  code: string
): Promise<{ readme: string; apiDocs: string; comments: string }> {
  const ext = getFileExtension(filePath);
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  const prompt = `Sen bir teknik yazar ve kıdemli yazılım mühendisisin.
Aşağıdaki kodu üç bölümde belgele. TÜRKÇE yaz.

DOSYA: ${fileName}
\`\`\`${ext}
${code.substring(0, 6000)}
\`\`\`

=== README BÖLÜMÜ ===
Bu dosya/modül için README yaz (ne yapar, nasıl kullanılır, örnek).

=== API REFERANS BÖLÜMÜ ===
Her export edilen fonksiyon/class/interface için:
- İmza, parametreler, dönüş değeri, kısa açıklama.

=== KOD YORUMU BÖLÜMÜ ===
Önemli satırlar için JSDoc/yorum önerileri. Format:
// Satır X: [yorum önerisi]`;

  try {
    const response = await sendToAI(prompt, false);
    const readmeMatch = response.split(/=== README BÖLÜMÜ ===/i)[1]?.split(/=== API REFERANS BÖLÜMÜ ===/i)[0];
    const apiMatch = response.split(/=== API REFERANS BÖLÜMÜ ===/i)[1]?.split(/=== KOD YORUMU BÖLÜMÜ ===/i)[0];
    const commentsMatch = response.split(/=== KOD YORUMU BÖLÜMÜ ===/i)[1];
    return {
      readme: readmeMatch?.trim() || response.substring(0, 1000),
      apiDocs: apiMatch?.trim() || 'API referansı üretilemedi.',
      comments: commentsMatch?.trim() || 'Yorumlar üretilemedi.'
    };
  } catch (error) {
    console.error('Panel documentation error:', error);
    return { readme: 'Dokümantasyon oluşturulamadı: ' + String(error), apiDocs: '', comments: '' };
  }
}

/**
 * EnhancedAIPanel → Test Generator sekmesi adapter.
 * AI'dan unitTests, integrationTests, testPlan formatında döner.
 */
export async function generateTestsForPanel(
  filePath: string,
  code: string
): Promise<{ unitTests: string; integrationTests: string; testPlan: string }> {
  const ext = getFileExtension(filePath);
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  const prompt = `Sen bir test mühendisisin. Aşağıdaki kod için kapsamlı testler yaz.
Framework: Jest/Vitest. TÜRKÇE açıklama, kod İngilizce.

DOSYA: ${fileName}
\`\`\`${ext}
${code.substring(0, 5000)}
\`\`\`

=== UNIT TEST KODU ===
Her fonksiyon için ayrı test. Tam çalışan kod:

\`\`\`typescript
// unit testler buraya
\`\`\`

=== INTEGRATION TEST KODU ===
Modüller arası etkileşim testleri:

\`\`\`typescript
// integration testler buraya
\`\`\`

=== TEST PLANI ===
- Kapsanan senaryolar
- Edge case'ler
- Mock'lanması gereken bağımlılıklar`;

  try {
    const response = await sendToAI(prompt, false);

    const extractCode = (section: string | undefined): string => {
      if (!section) return '';
      const m = section.match(/```(?:typescript|javascript|ts|js)?\n([\s\S]+?)```/);
      return m ? m[1].trim() : section.replace(/```[\w]*/g, '').trim().substring(0, 1200);
    };

    const unitSection = response.split(/=== UNIT TEST KODU ===/i)[1]?.split(/=== INTEGRATION TEST KODU ===/i)[0];
    const integSection = response.split(/=== INTEGRATION TEST KODU ===/i)[1]?.split(/=== TEST PLANI ===/i)[0];
    const planSection = response.split(/=== TEST PLANI ===/i)[1];

    return {
      unitTests: extractCode(unitSection) || 'Unit test üretilemedi.',
      integrationTests: extractCode(integSection) || 'Integration test üretilemedi.',
      testPlan: planSection?.trim() || '- AI tarafından test planı oluşturuldu.'
    };
  } catch (error) {
    console.error('Panel test generation error:', error);
    return { unitTests: 'Test oluşturulamadı: ' + String(error), integrationTests: '', testPlan: '' };
  }
}

/**
 * EnhancedAIPanel → Refactoring sekmesi adapter.
 * AI'dan impact/type/description/before/after formatında döner.
 */
export async function suggestRefactoringForPanel(
  filePath: string,
  code: string
): Promise<{
  suggestions: Array<{ impact: 'high' | 'medium' | 'low'; type: string; description: string; before: string; after: string }>;
  summary: string;
}> {
  const ext = getFileExtension(filePath);
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  const prompt = `Sen bir refactoring uzmanısın. Kodu incele ve somut öneriler sun. TÜRKÇE.

DOSYA: ${fileName}
\`\`\`${ext}
${code.substring(0, 5000)}
\`\`\`

Her öneri için:

=== ÖNERİ ===
ETKİ: high|medium|low
TÜR: [Extract Function / Remove Duplication / Apply Pattern / vb.]
AÇIKLAMA: [ne yapılmalı ve neden]
ÖNCE:
\`\`\`${ext}
[mevcut problematik kod parçası]
\`\`\`
SONRA:
\`\`\`${ext}
[düzeltilmiş kod]
\`\`\`

=== ÖZET ===
[Genel değerlendirme]`;

  try {
    const response = await sendToAI(prompt, false);
    const suggestions: Array<{ impact: 'high' | 'medium' | 'low'; type: string; description: string; before: string; after: string }> = [];

    const blocks = response.split(/=== ÖNERİ ===/i).slice(1);
    for (const block of blocks) {
      const impactMatch = block.match(/ETKİ:\s*(high|medium|low)/i);
      const typeMatch = block.match(/TÜR:\s*(.+)/i);
      const descMatch = block.match(/AÇIKLAMA:\s*(.+)/i);
      const codeBlocks: string[] = [];
      const cbRegex = /```(?:\w+)?\n([\s\S]+?)```/g;
      let cbMatch;
      while ((cbMatch = cbRegex.exec(block)) !== null) codeBlocks.push(cbMatch[1].trim());

      if (typeMatch) {
        suggestions.push({
          impact: (impactMatch?.[1]?.toLowerCase() as 'high' | 'medium' | 'low') || 'medium',
          type: typeMatch[1].trim(),
          description: descMatch?.[1]?.trim() || 'Refactoring önerisi',
          before: codeBlocks[0] || '',
          after: codeBlocks[1] || ''
        });
      }
    }

    if (suggestions.length === 0) {
      suggestions.push({ impact: 'medium', type: 'Genel İyileştirme', description: response.substring(0, 500), before: '', after: '' });
    }

    const summaryMatch = response.split(/=== ÖZET ===/i)[1];
    return { suggestions, summary: summaryMatch?.trim() || 'Refactoring analizi tamamlandı.' };
  } catch (error) {
    console.error('Panel refactoring error:', error);
    return { suggestions: [], summary: 'Refactoring analizi tamamlanamadı: ' + String(error) };
  }
}
