/**
 * EditorModelManager — VS Code TextFileEditorModel mimarisinden ilhamlı
 * 
 * Çözdüğü Sorunlar:
 * 1. Çift model yaratma hatası: aynı URI için iki model yaratılmasını önler
 * 2. Model dispose güvenliği: disposed model üzerinde işlem yapılmasını engeller
 * 3. URI bazlı takip: her dosya için tek bir model instance garantisi
 * 
 * VS Code Referans: textFileEditorModel.ts (44KB), editorGroupsService.ts
 */

import * as monaco from "monaco-editor";

export interface ModelInfo {
    uri: string;
    language: string;
    model: monaco.editor.ITextModel;
    createdAt: number;
    isDirty: boolean;
    savedVersionId: number;
}

export class EditorModelManager {
    private static instance: EditorModelManager;
    private _models = new Map<string, ModelInfo>();
    private _onModelCreated: Array<(info: ModelInfo) => void> = [];
    private _onModelDisposed: Array<(uri: string) => void> = [];

    private constructor() { }

    public static getInstance(): EditorModelManager {
        if (!EditorModelManager.instance) {
            EditorModelManager.instance = new EditorModelManager();
        }
        return EditorModelManager.instance;
    }

    /**
     * Bir URI için model getir veya yarat.
     * VS Code'un "getOrCreate" pattern'ı — çift model yaratma YASAK!
     */
    getOrCreateModel(
        uri: string,
        language: string,
        content: string
    ): monaco.editor.ITextModel {
        const monacoUri = monaco.Uri.parse(uri);

        // 1. Önce kendi cache'imizde ara
        const cached = this._models.get(uri);
        if (cached && !cached.model.isDisposed()) {
            return cached.model;
        }

        // 2. Monaco'nun global kayıtlarında ara (başka bir yerden yaratılmış olabilir)
        const existing = monaco.editor.getModel(monacoUri);
        if (existing && !existing.isDisposed()) {
            const info: ModelInfo = {
                uri,
                language,
                model: existing,
                createdAt: Date.now(),
                isDirty: false,
                savedVersionId: existing.getAlternativeVersionId(),
            };
            this._models.set(uri, info);
            return existing;
        }

        // 3. Yeni model oluştur
        const model = monaco.editor.createModel(content, language, monacoUri);
        const info: ModelInfo = {
            uri,
            language,
            model,
            createdAt: Date.now(),
            isDirty: false,
            savedVersionId: model.getAlternativeVersionId(),
        };

        this._models.set(uri, info);

        // Model değişikliklerini izle → isDirty güncelle
        model.onDidChangeContent(() => {
            const cached = this._models.get(uri);
            if (cached) {
                cached.isDirty = model.getAlternativeVersionId() !== cached.savedVersionId;
            }
        });

        // Model dispose edilirse cache'den kaldır
        model.onWillDispose(() => {
            this._models.delete(uri);
            this._onModelDisposed.forEach((cb) => cb(uri));
        });

        this._onModelCreated.forEach((cb) => cb(info));
        return model;
    }

    /**
     * Dosya kaydedildiğinde çağır — isDirty sıfırlanır
     */
    markSaved(uri: string): void {
        const info = this._models.get(uri);
        if (info && !info.model.isDisposed()) {
            info.savedVersionId = info.model.getAlternativeVersionId();
            info.isDirty = false;
        }
    }

    /**
     * İçeriği güncelle — VS Code tarzı (setValue YASAK!)
     * Undo history korunur.
     */
    updateContent(uri: string, newContent: string, source = "external"): void {
        const info = this._models.get(uri);
        if (!info || info.model.isDisposed()) return;

        const model = info.model;
        const currentContent = model.getValue();

        if (currentContent === newContent) return; // Değişiklik yok

        // executeEdits ile güncelle → undo geçmişi korunur
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

        void source; // source parametresi internal debug için saklandı
    }

    /**
     * Modeli güvenli dispose et
     */
    disposeModel(uri: string): void {
        const info = this._models.get(uri);
        if (!info) return;

        if (!info.model.isDisposed()) {
            info.model.dispose();
        }
        this._models.delete(uri);
    }

    /**
     * Tüm modelleri dispose et (uygulama kapanışında)
     */
    disposeAll(): void {
        for (const [_uri, info] of this._models) {
            if (!info.model.isDisposed()) {
                info.model.dispose();
            }
        }
        this._models.clear();
    }

    /**
     * Model bilgisini getir
     */
    getModelInfo(uri: string): ModelInfo | undefined {
        return this._models.get(uri);
    }

    /**
     * Açık tüm modeller
     */
    getAllModels(): ModelInfo[] {
        return Array.from(this._models.values()).filter(
            (info) => !info.model.isDisposed()
        );
    }

    /**
     * Kaydedilmemiş değişikliği olan modeller
     */
    getDirtyModels(): ModelInfo[] {
        return this.getAllModels().filter((info) => info.isDirty);
    }

    /**
     * Event listeners
     */
    onModelCreated(cb: (info: ModelInfo) => void): () => void {
        this._onModelCreated.push(cb);
        return () => {
            this._onModelCreated = this._onModelCreated.filter((c) => c !== cb);
        };
    }

    onModelDisposed(cb: (uri: string) => void): () => void {
        this._onModelDisposed.push(cb);
        return () => {
            this._onModelDisposed = this._onModelDisposed.filter((c) => c !== cb);
        };
    }

    /**
     * İstatistikler
     */
    getStats() {
        const models = this.getAllModels();
        return {
            total: models.length,
            dirty: models.filter((m) => m.isDirty).length,
            clean: models.filter((m) => !m.isDirty).length,
            languages: [...new Set(models.map((m) => m.language))],
        };
    }
}

export const editorModelManager = EditorModelManager.getInstance();
