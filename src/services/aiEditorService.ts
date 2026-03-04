/**
 * AIEditorService — VS Code InlineCompletionsModel + Edit API mimarisinden ilhamlı
 * 
 * Çözdüğü Sorunlar (VS Code Analizinden):
 * 1. setValue() YASAK → executeEdits() kullanılır (undo history korunur)
 * 2. Version Guard → AI cevap gelirken model değişmişse edit iptal edilir
 * 3. Overlapping Edit Koruması → çakışan AI editleri otomatik filtrelenir
 * 4. IME Composition Guard → Asya dili yazarken AI müdahale etmez
 * 5. Undo Grouping → ilgili AI editleri tek undo adımında gruplanır
 * 6. Adaptive Debounce → provider hızına göre gecikme ayarlanır
 * 
 * VS Code Referans:
 * - inlineCompletionsModel.ts (56KB) — ghost text motoru
 * - editStack.ts (15KB) — undo/redo sistemi
 * - languageFeatureDebounce.ts (5KB) — adaptif gecikme
 */

import * as monaco from "monaco-editor";

// ============================================================
// TİPLER
// ============================================================

export interface AIFix {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    newText: string;
    description?: string;
}

export interface AIFixRequest {
    fixes: AIFix[];
    source: string; // hangi AI servisi
    requestVersionId: number; // hangi model versiyonunda istek yapıldı
}

export interface ApplyResult {
    success: boolean;
    appliedCount: number;
    skippedCount: number;
    reason?: string;
}

// ============================================================
// ADAPTİF DEBOUNCE — VS Code languageFeatureDebounce.ts'den
// ============================================================

export class AdaptiveDebounce {
    private _lastDurations: number[] = [];
    private _timer: ReturnType<typeof setTimeout> | null = null;
    private readonly _minDelay = 50;
    private readonly _maxDelay = 500;

    /**
     * Geçmiş yanıt sürelerine göre gecikme hesapla.
     * Provider hızlıysa az bekle, yavaşsa fazla bekle.
     */
    private computeDelay(): number {
        if (this._lastDurations.length === 0) return 150;
        const avg =
            this._lastDurations.reduce((a, b) => a + b, 0) /
            this._lastDurations.length;
        return Math.min(Math.max(avg * 0.5, this._minDelay), this._maxDelay);
    }

    private recordDuration(ms: number): void {
        this._lastDurations.push(ms);
        if (this._lastDurations.length > 10) this._lastDurations.shift();
    }

    schedule(fn: () => Promise<void>): void {
        if (this._timer !== null) clearTimeout(this._timer);
        const delay = this.computeDelay();

        this._timer = setTimeout(async () => {
            const start = Date.now();
            await fn();
            this.recordDuration(Date.now() - start);
        }, delay);
    }

    cancel(): void {
        if (this._timer !== null) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    getAverageResponseTime(): number {
        if (this._lastDurations.length === 0) return 0;
        return (
            this._lastDurations.reduce((a, b) => a + b, 0) /
            this._lastDurations.length
        );
    }
}

// ============================================================
// DIAGNOSTİK DECORATION YÖNETİCİSİ — VS Code tracked decorations
// ============================================================

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

export interface Diagnostic {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
    message: string;
    severity: DiagnosticSeverity;
    code?: string;
    source?: string;
}

export class DiagnosticDecorationManager {
    private static instance: DiagnosticDecorationManager;
    // fileUri → decorationIds (Monaco'nun deltaDecorations yöntemi)
    private _decorations = new Map<string, string[]>();

    private constructor() { }

    public static getInstance(): DiagnosticDecorationManager {
        if (!DiagnosticDecorationManager.instance) {
            DiagnosticDecorationManager.instance = new DiagnosticDecorationManager();
        }
        return DiagnosticDecorationManager.instance;
    }

    /**
     * Editör için diagnostikleri ayarla.
     * Model değiştiğinde dekorasyonlar otomatik takip edilir (TrackedRange).
     */
    setDiagnostics(
        editor: monaco.editor.ICodeEditor,
        diagnostics: Diagnostic[]
    ): void {
        const model = editor.getModel();
        if (!model) return;

        const newDecorations: monaco.editor.IModelDeltaDecoration[] =
            diagnostics.map((d) => ({
                range: new monaco.Range(d.startLine, d.startCol, d.endLine, d.endCol),
                options: {
                    description: `corex-diagnostic-${d.severity}`,
                    inlineClassName: `corex-diag-${d.severity}`,
                    hoverMessage: {
                        value: `**${d.severity.toUpperCase()}** ${d.source ? `(${d.source})` : ""}: ${d.message}`,
                        isTrusted: true,
                    },
                    glyphMarginClassName: `corex-glyph-${d.severity}`,
                    // VS Code'un kritik özelliği: model değiştikçe range TAKIP EDİLİR
                    stickiness:
                        monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                    overviewRuler: {
                        color: this._getSeverityColor(d.severity),
                        position: monaco.editor.OverviewRulerLane.Right,
                    },
                },
            }));

        const uri = model.uri.toString();
        const oldIds = this._decorations.get(uri) ?? [];
        const newIds = editor.deltaDecorations(oldIds, newDecorations);
        this._decorations.set(uri, newIds);
    }

    /**
     * Belirli bir dosyanın tüm diagnostiklerini temizle
     */
    clearDiagnostics(editor: monaco.editor.ICodeEditor): void {
        const model = editor.getModel();
        if (!model) return;

        const uri = model.uri.toString();
        const oldIds = this._decorations.get(uri) ?? [];
        editor.deltaDecorations(oldIds, []);
        this._decorations.delete(uri);
    }

    private _getSeverityColor(severity: DiagnosticSeverity): string {
        const colors: Record<DiagnosticSeverity, string> = {
            error: "#f44747",
            warning: "#ffcc00",
            info: "#75beff",
            hint: "#82aaff",
        };
        return colors[severity];
    }

    /**
     * CSS inject et (uygulama başlangıcında bir kez çalıştır)
     */
    static injectStyles(): void {
        if (document.getElementById("corex-diagnostic-styles")) return;

        const style = document.createElement("style");
        style.id = "corex-diagnostic-styles";
        style.textContent = `
      /* Diagnostic inline styles */
      .corex-diag-error { 
        text-decoration: underline wavy #f44747;
        text-decoration-skip-ink: none;
      }
      .corex-diag-warning { 
        text-decoration: underline wavy #ffcc00;
        text-decoration-skip-ink: none;
      }
      .corex-diag-info { 
        text-decoration: underline dotted #75beff;
      }
      .corex-diag-hint { 
        text-decoration: underline dotted #82aaff;
        opacity: 0.7;
      }
      
      /* Glyph margin icons */
      .corex-glyph-error::before { content: '●'; color: #f44747; font-size: 12px; }
      .corex-glyph-warning::before { content: '▲'; color: #ffcc00; font-size: 10px; }
      .corex-glyph-info::before { content: 'ℹ'; color: #75beff; font-size: 12px; }
      .corex-glyph-hint::before { content: '💡'; font-size: 10px; }
    `;
        document.head.appendChild(style);
    }
}

// ============================================================
// ANA AI EDİTÖR SERVİSİ
// ============================================================

export class AIEditorService {
    private static instance: AIEditorService;

    // Bekleyen istek takibi (Version Guard için)
    private _pendingRequest: {
        versionId: number;
        controller: AbortController;
        editorId: string;
    } | null = null;

    // IME composition durumu
    private _isComposing = false;

    // Adaptif debounce (her provider için ayrı)
    private _debounce = new AdaptiveDebounce();

    // Diagnostik yönetici
    public readonly diagnostics = DiagnosticDecorationManager.getInstance();

    // IME cleanup fonksiyonları
    private _imeCleanups: Array<() => void> = [];

    private constructor() {
        DiagnosticDecorationManager.injectStyles();
    }

    public static getInstance(): AIEditorService {
        if (!AIEditorService.instance) {
            AIEditorService.instance = new AIEditorService();
        }
        return AIEditorService.instance;
    }

    // ============================================================
    // IME COMPOSITION GUARD — VS Code onCompositionStart/End
    // ============================================================

    /**
     * Editör için IME composition korumasını etkinleştir.
     * Japonca, Çince, Korece, Arapça vb. yazarken AI müdahale ETMEZ.
     */
    setupIMEGuard(editor: monaco.editor.ICodeEditor): () => void {
        const d1 = editor.onDidCompositionStart(() => {
            this._isComposing = true;
            this._debounce.cancel(); // Devam eden debounce'u iptal et
        });

        const d2 = editor.onDidCompositionEnd(() => {
            this._isComposing = false;
        });

        const cleanup = () => {
            d1.dispose();
            d2.dispose();
        };

        this._imeCleanups.push(cleanup);
        return cleanup;
    }

    get isComposing(): boolean {
        return this._isComposing;
    }

    // ============================================================
    // VERSION GUARD — VS Code inlineCompletionsModel.ts pattern
    // ============================================================

    /**
     * AI fix isteği gönder — version guard ile.
     * Yanıt geldiğinde model değişmişse edit ATILIR.
     */
    async requestAIFix(
        editor: monaco.editor.ICodeEditor,
        fetchFn: (signal: AbortSignal) => Promise<AIFix[]>
    ): Promise<AIFix[] | null> {
        const model = editor.getModel();
        if (!model) return null;

        // IME yazma sırasında AI önerisi YASAK
        if (this._isComposing) {
            return null;
        }

        const versionAtRequest = model.getVersionId();
        const editorId = editor.getId();

        // Önceki isteği iptal et
        if (this._pendingRequest) {
            this._pendingRequest.controller.abort();
        }

        const controller = new AbortController();
        this._pendingRequest = { versionId: versionAtRequest, controller, editorId };

        try {
            const fixes = await fetchFn(controller.signal);

            // AI cevap verdi — ama model değişmiş olabilir!
            if (
                model.isDisposed() ||
                model.getVersionId() !== versionAtRequest
            ) {
                return null;
            }

            return fixes;
        } catch (e: unknown) {
            if ((e as Error)?.name === "AbortError") {
                return null;
            }
            throw e;
        } finally {
            if (this._pendingRequest?.controller === controller) {
                this._pendingRequest = null;
            }
        }
    }

    // ============================================================
    // EDIT UYGULAMA — VS Code executeEdits Pattern
    // ============================================================

    /**
     * Tek bir AI fix uygula.
     * ❌ setValue() YASAK — undo history silinir
     * ✅ executeEdits() kullan — undo korunur, cursor korunur
     */
    applyAIFix(
        editor: monaco.editor.ICodeEditor,
        fix: AIFix,
        source = "corex-ai"
    ): boolean {
        const model = editor.getModel();
        if (!model || model.isDisposed()) return false;

        editor.pushUndoStop(); // Undo başlangıç noktası

        try {
            editor.executeEdits(
                source,
                [
                    {
                        range: new monaco.Range(
                            fix.startLine,
                            fix.startColumn,
                            fix.endLine,
                            fix.endColumn
                        ),
                        text: fix.newText,
                        forceMoveMarkers: true, // Marker'ları yeni konuma taşı
                    },
                ],
                (inverseEdits) => {
                    // Cursor'u düzeltilmiş kodun sonuna yerleştir
                    if (inverseEdits.length > 0) {
                        const end = inverseEdits[0].range;
                        return [
                            new monaco.Selection(
                                end.endLineNumber,
                                end.endColumn,
                                end.endLineNumber,
                                end.endColumn
                            ),
                        ];
                    }
                    return null;
                }
            );

            editor.pushUndoStop(); // Undo bitiş noktası
            return true;
        } catch (_e) {
            return false;
        }
    }

    /**
     * Birden fazla AI fix uygula — Overlapping Edit Koruması ile.
     * 
     * VS Code: "Overlapping ranges are not allowed!"
     * Çakışan editler otomatik filtrelenir.
     */
    applyMultipleAIFixes(
        editor: monaco.editor.ICodeEditor,
        fixes: AIFix[],
        source = "corex-ai-multi"
    ): ApplyResult {
        const model = editor.getModel();
        if (!model || model.isDisposed()) {
            return { success: false, appliedCount: 0, skippedCount: fixes.length, reason: "No model" };
        }

        // 1. Artan sıraya göre sırala (VS Code PieceTree requirement)
        const sorted = [...fixes].sort((a, b) => {
            const lineDiff = a.startLine - b.startLine;
            return lineDiff !== 0 ? lineDiff : a.startColumn - b.startColumn;
        });

        // 2. Çakışma kontrolü — VS Code'un overlapping range koruması
        const valid: AIFix[] = [];
        let lastEndLine = -1;
        let lastEndCol = -1;

        for (const fix of sorted) {
            const overlaps =
                fix.startLine < lastEndLine ||
                (fix.startLine === lastEndLine && fix.startColumn < lastEndCol);

            if (overlaps) {
                // Çakışan fix atlanıyor (sessizce)
            } else {
                valid.push(fix);
                lastEndLine = fix.endLine;
                lastEndCol = fix.endColumn;
            }
        }

        if (valid.length === 0) {
            return {
                success: false,
                appliedCount: 0,
                skippedCount: fixes.length,
                reason: "All fixes overlapped",
            };
        }

        editor.pushUndoStop();

        try {
            editor.executeEdits(
                source,
                valid.map((fix) => ({
                    range: new monaco.Range(
                        fix.startLine,
                        fix.startColumn,
                        fix.endLine,
                        fix.endColumn
                    ),
                    text: fix.newText,
                    forceMoveMarkers: true,
                }))
            );

            editor.pushUndoStop();

            return {
                success: true,
                appliedCount: valid.length,
                skippedCount: fixes.length - valid.length,
            };
        } catch (_e) {
            return {
                success: false,
                appliedCount: 0,
                skippedCount: fixes.length,
                reason: String(_e),
            };
        }
    }

    /**
     * Tüm dosya içeriğini değiştir — UNDO KORUNARAK.
     * 
     * VS Code Ders #1: setValue() ASLA kullanma!
     * Bu fonksiyon bütün dosyayı değiştirmek gerektiğinde güvenli alternatif.
     */
    replaceEntireContent(
        editor: monaco.editor.ICodeEditor,
        newContent: string,
        _source = "corex-replace"
    ): boolean {
        const model = editor.getModel();
        if (!model || model.isDisposed()) return false;

        const currentContent = model.getValue();
        if (currentContent === newContent) return true; // Zaten aynı, bir şey yapma

        editor.pushUndoStop();

        try {
            model.pushEditOperations(
                [],
                [
                    {
                        range: model.getFullModelRange(),
                        text: newContent,
                    },
                ],
                () => null
            );

            editor.pushUndoStop();
            return true;
        } catch (_e) {
            return false;
        }
    }

    /**
     * Debounce ile AI öneri isteği planla.
     * Kullanıcı hızlı yazarken gereksiz istek yapma.
     */
    scheduleRequest(fn: () => Promise<void>): void {
        if (this._isComposing) return;
        this._debounce.schedule(fn);
    }

    cancelPendingRequest(): void {
        this._debounce.cancel();
        if (this._pendingRequest) {
            this._pendingRequest.controller.abort();
            this._pendingRequest = null;
        }
    }

    /**
     * Performans istatistikleri
     */
    getStats() {
        return {
            averageResponseTime: this._debounce.getAverageResponseTime(),
            isComposing: this._isComposing,
            hasPendingRequest: this._pendingRequest !== null,
        };
    }

    dispose(): void {
        this.cancelPendingRequest();
        this._imeCleanups.forEach((fn) => fn());
        this._imeCleanups = [];
    }
}

export const aiEditorService = AIEditorService.getInstance();
