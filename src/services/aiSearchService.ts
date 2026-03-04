import { invoke } from '@tauri-apps/api/core';

export interface AISearchResult {
    file: string;
    relevanceScore: number;
    snippet: string;
    explanation: string; // "Bu fonksiyon veritabanına bağlanır ve x işini yapar..."
}

class AISearchService {
    private static instance: AISearchService;

    private constructor() { }

    public static getInstance(): AISearchService {
        if (!AISearchService.instance) {
            AISearchService.instance = new AISearchService();
        }
        return AISearchService.instance;
    }

    /**
     * Doğal Dil İle Anlamsal Kod Araması Yapar
     * Örn: "Veritabanına bağlanan fonksiyonlar nerede?"
     */
    public async semanticSearch(query: string, limit: number = 5): Promise<AISearchResult[]> {
        try {
            // 1. Vektör aramasını tetikle (Kullanıcının Tauri komutları üzerinden)
            // `vector_search` : return vector results
            const rawResults = await invoke<any[]>('vector_search', {
                query,
                limit: limit * 2, // Geniş arama
            });

            if (!rawResults || rawResults.length === 0) {
                return [];
            }

            // 2. Çok gelişmiş LLM'e bu snippetleri ver ve filtrelet+açıklat
            // Sadece en ilgili 5'i süz
            const llmPrompt = `
Kullanıcı şu doğal dili sordu: "${query}"
Bulunan Kod Parçacıkları:
${JSON.stringify(rawResults)}

Sadece gerçekten bu sorguyla ilgili kod parçacıklarını süz, onlara bir alaka skoru ver (0-100) ve neden faydalı olduklarını tek cümleyle açıkla.
Yanıtını sadece JSON formunda, \`[{ "file": "path", "relevanceScore": 95, "snippet": "...", "explanation": "Açıklama" }]\` formatında döndür.
      `;

            const aiResponse = await invoke<string>('chat_with_specific_ai', {
                message: llmPrompt.trim(),
                modelType: "coder"
            });

            // JSON Ayırıklama (Robust)
            const cleanJsonStr = this.extractJson(aiResponse);
            const parsed: AISearchResult[] = JSON.parse(cleanJsonStr);

            // Skora Göre Sırala
            return parsed.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);

        } catch (err) {
            console.error("AI Semantic Search failed:", err);
            return [];
        }
    }

    private extractJson(text: string): string {
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start === -1 || end === -1) {
            return '[]';
        }
        return text.substring(start, end + 1);
    }
}

export const aiSearchService = AISearchService.getInstance();
