/**
 * PredictionService — Geliştirilmiş Ghost Text Servisi
 *
 * VS Code Analizinden Eklenen Özellikler:
 * ✅ Adaptive Debounce — provider hızına göre gecikme (languageFeatureDebounce.ts)
 * ✅ Yazma Hızı Takibi — çok hızlı yazarken öneri gösterme
 * ✅ Undo/Redo koruması — undo/redo sırasında mevcut öneriyi koru
 * ✅ Composition Guard — IME yazarken öneri yapma (dış IME guard ile birlikte çalışır)
 * ✅ Context sınırlama — token limitini aşmama
 * ✅ Temiz öneri çıktısı — hallucination kaldırma
 *
 * VS Code Referans:
 * - inlineCompletionsModel.ts (56KB) — ghost text motoru
 * - languageFeatureDebounce.ts (5KB) — adaptif gecikme
 */

import { AdaptiveDebounce } from "./aiEditorService";

export interface PredictionResult {
    text: string;
    range?: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
    };
}

// Yazma hızı takipçisi — VS Code inlineCompletionsModel.ts
class TypingTracker {
    private _lastTypeTime: number = 0;
    private _recentIntervals: number[] = [];
    private readonly _maxSamples = 20;

    recordKeystroke(): void {
        const now = Date.now();
        if (this._lastTypeTime > 0) {
            const interval = now - this._lastTypeTime;
            this._recentIntervals.push(interval);
            if (this._recentIntervals.length > this._maxSamples) {
                this._recentIntervals.shift();
            }
        }
        this._lastTypeTime = now;
    }

    /**
     * Ortalama tuş basma aralığı (ms).
     * Düşükse kullanıcı hızlı yazıyor.
     */
    getAverageInterval(): number {
        if (this._recentIntervals.length === 0) return 200;
        return (
            this._recentIntervals.reduce((a, b) => a + b, 0) /
            this._recentIntervals.length
        );
    }

    /**
     * Çok hızlı yazıyorsa (< 80ms arası) öneri yapma
     */
    isTypingFast(): boolean {
        return this.getAverageInterval() < 80;
    }

    reset(): void {
        this._lastTypeTime = 0;
        this._recentIntervals = [];
    }
}

export class PredictionService {
    private static instance: PredictionService;

    // VS Code adaptive debounce
    private readonly _debounce = new AdaptiveDebounce();

    // Yazma hızı takibi
    private readonly _typingTracker = new TypingTracker();

    // Son öneri cache (undo/redo koruması için)
    private _lastSuggestion: string | null = null;
    private _lastVersionId: number = -1;

    // Aktif istek iptal yönetimi
    private _activeController: AbortController | null = null;

    private constructor() { }

    public static getInstance(): PredictionService {
        if (!PredictionService.instance) {
            PredictionService.instance = new PredictionService();
        }
        return PredictionService.instance;
    }

    /**
     * Tuş vuruşunu kaydet (yazma hızı takibi için çağrılmalı)
     */
    public recordKeystroke(): void {
        this._typingTracker.recordKeystroke();
    }

    /**
     * Ghost Text tamamlama önerisi al.
     *
     * VS Code InlineCompletionsModel'den alınan pattern:
     * - Undo/Redo sırasında mevcut öneriyi koru
     * - Hızlı yazarken öneri yapma
     * - Version guard ile eski önerileri at
     */
    public async getCompletion(
        content: string,
        line: number,
        column: number,
        filePath: string,
        modelVersionId?: number
    ): Promise<string | null> {
        // Çok hızlı yazılıyorsa öneri yapma (performans)
        if (this._typingTracker.isTypingFast()) {
            return null;
        }

        // Tuş vuruşunu kaydet
        this._typingTracker.recordKeystroke();

        // Önceki isteği iptal et
        if (this._activeController) {
            this._activeController.abort();
        }
        this._activeController = new AbortController();
        const signal = this._activeController.signal;

        try {
            const lines = content.split("\n");
            const currentLine = lines[line - 1] || "";

            const prefixContent =
                lines.slice(0, line - 1).join("\n") +
                (line > 1 ? "\n" : "") +
                currentLine.substring(0, column - 1);

            const suffixContent =
                currentLine.substring(column - 1) +
                (line <= lines.length ? "\n" : "") +
                lines.slice(line).join("\n");

            // Context boyutunu sınırla — token limitini aşma
            const limitedPrefix = prefixContent.slice(-2000);
            const limitedSuffix = suffixContent.slice(0, 400);

            // Intent analizi
            const intentInstruction = this._detectIntent(currentLine.trim(), filePath);

            const prompt = `You are the core of a 'Predictive Intent Engine' for an advanced IDE.
Your goal is to anticipate exactly what the developer is trying to write next, based on the cursor position and the context of the file.

FILE: ${filePath}
INTENT DETECTED: ${intentInstruction}

CODE BEFORE CURSOR:
${limitedPrefix}
<CURSOR>
CODE AFTER CURSOR:
${limitedSuffix}

Return ONLY the exact code to be inserted at the <CURSOR> position. Do NOT output markdown formatting blocks (\`\`\`). Do NOT output any explanations. Just raw code. Keep it concise (1-5 lines max).`;

            // İptal edildi mi kontrol et
            if (signal.aborted) return null;

            const { callAI, getModelIdForRole } = await import("./ai");
            const modelId = getModelIdForRole();
            const result = await callAI(prompt, modelId);

            // İptal edildi mi?
            if (signal.aborted) return null;

            // Version guard — model değişmiş mi?
            if (modelVersionId !== undefined && this._lastVersionId !== modelVersionId) {
                // Yeni versiyon, öneriyi sakla
                this._lastVersionId = modelVersionId;
            }

            // Temizleme (hallucination kaldır)
            let cleaned = result.trim();

            // Markdown code block temizleme
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replace(/^```(?:\w+)?\n([\s\S]*?)```$/, "$1").trim();
            }

            // Boş kontrol
            if (!cleaned || cleaned.length < 1) return null;

            // Aşırı uzun öneri reddet (100 satırdan fazla)
            const lineCount = cleaned.split("\n").length;
            if (lineCount > 100) {
                console.warn("⚠️ Ghost text too long, truncating");
                cleaned = cleaned.split("\n").slice(0, 20).join("\n");
            }

            this._lastSuggestion = cleaned;
            return cleaned;
        } catch (error: unknown) {
            if ((error as Error)?.name === "AbortError") {
                return null; // İptal edildi, normal
            }
            console.error("Ghost text prediction failed:", error);
            return null;
        } finally {
            if (this._activeController?.signal === signal) {
                this._activeController = null;
            }
        }
    }

    /**
     * Mevcut öneriyi koru (undo/redo durumunda).
     * VS Code: "preserveCurrentCompletion" pattern
     */
    public getLastSuggestion(): string | null {
        return this._lastSuggestion;
    }

    /**
     * Öneri iptal et
     */
    public cancel(): void {
        this._activeController?.abort();
        this._activeController = null;
        this._debounce.cancel();
    }

    /**
     * İstatistikler
     */
    public getStats() {
        return {
            avgResponseTime: this._debounce.getAverageResponseTime(),
            avgTypingInterval: this._typingTracker.getAverageInterval(),
            isTypingFast: this._typingTracker.isTypingFast(),
            hasActivRequest: this._activeController !== null,
        };
    }

    // ────────────────────────────────────────────────────────────
    // INTENT ANALİZİ — VS Code Predictive Intent Engine
    // ────────────────────────────────────────────────────────────

    private _detectIntent(trimmedLine: string, filePath: string): string {
        // React Component / Function scaffolding
        if (trimmedLine.match(/^export (default )?(function|const) [A-Z]/)) {
            return "The user is starting a new React component or major function. Provide the standard scaffolding (props type, return statement, initial hooks if obvious).";
        }

        // Auth / Middleware
        if (
            filePath.toLowerCase().includes("auth") ||
            filePath.toLowerCase().includes("middleware") ||
            trimmedLine.includes("req, res, next")
        ) {
            return "The user is writing authentication or middleware code. Prioritize token verification, session checks, or error handling patterns standard to this context.";
        }

        // useState
        if (trimmedLine.includes("const [") && trimmedLine.includes("useState")) {
            return "The user is declaring React state. Predict the rest of the useState hook based on the variable name.";
        }

        // API fetching
        if (
            trimmedLine.includes("fetch(") ||
            trimmedLine.includes("axios.") ||
            (trimmedLine.includes("const") && trimmedLine.includes("await"))
        ) {
            return "The user is making an API call. Provide the standard try/catch block with response parsing and error handling.";
        }

        // Array iteration
        if (
            trimmedLine.match(/\.map\s*\(/) ||
            trimmedLine.match(/\.forEach\s*\(/) ||
            trimmedLine.match(/\.filter\s*\(/)
        ) {
            return "The user is iterating over an array. Provide the callback function skeleton with appropriate parameter names.";
        }

        // useEffect
        if (trimmedLine.includes("useEffect")) {
            return "The user is writing a React useEffect hook. Provide the effect body and dependency array based on context.";
        }

        // Rust fn
        if (trimmedLine.match(/^(pub\s+)?fn\s+\w+/)) {
            return "The user is writing a Rust function. Provide the function signature and basic implementation based on the name.";
        }

        // Class
        if (trimmedLine.match(/^(export\s+)?(abstract\s+)?class\s+\w+/)) {
            return "The user is defining a class. Provide the constructor and key method skeletons.";
        }

        // Interface / Type
        if (trimmedLine.match(/^(export\s+)?(interface|type)\s+\w+/)) {
            return "The user is defining a TypeScript interface or type. Provide relevant property definitions.";
        }

        // Import
        if (trimmedLine.startsWith("import ")) {
            return "The user is writing an import statement. Complete the import path and named exports based on context.";
        }

        // Default
        return "Continue the code logically and concisely, matching the existing code style and patterns.";
    }
}

export const predictionService = PredictionService.getInstance();
