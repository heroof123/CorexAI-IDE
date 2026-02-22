// hooks/useAIBackgroundAnalysis.ts
// Dosya her açıldığında arka planda otomatik AI analizi yapar.
// Kullanıcı hiçbir şey demeden, buton'a basmadan — tam IDE davranışı.

import { useEffect, useRef, useCallback, useState } from 'react';

export interface AIIssue {
    filePath: string;
    fileName: string;
    line: number;
    type: 'error' | 'warning' | 'suggestion';
    message: string;
    severity: 'high' | 'medium' | 'low';
}

export interface FileAnalysisResult {
    filePath: string;
    fileName: string;
    score: number;
    issues: AIIssue[];
    suggestions: string[];
    summary: string;
    analyzedAt: number;
}

interface AnalysisState {
    results: Map<string, FileAnalysisResult>;
    currentlyAnalyzing: string | null;
    analysisQueue: string[];
}

/** Gerçek analiz edilebilir dosya uzantıları */
const ANALYZABLE_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'cpp', 'c', 'css', 'html', 'vue', 'svelte']);

function isAnalyzable(filePath: string): boolean {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return !!ext && ANALYZABLE_EXTS.has(ext);
}

export function useAIBackgroundAnalysis(
    selectedFile: string,
    fileContent: string,
    isAIReady: boolean
) {
    const [state, setState] = useState<AnalysisState>({
        results: new Map(),
        currentlyAnalyzing: null,
        analysisQueue: [],
    });
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const analysisCache = useRef<Map<string, { timestamp: number; contentHash: string }>>(new Map());
    const isAnalyzingRef = useRef(false);

    /** Basit hash — içerik değişti mi kontrolü için */
    const hashContent = (s: string) => {
        let h = 0;
        for (let i = 0; i < Math.min(s.length, 2000); i++) {
            h = ((h << 5) - h) + s.charCodeAt(i);
            h |= 0;
        }
        return h.toString();
    };

    /** Dosya analiz edilmeli mi? (FIX-29) */
    const shouldAnalyze = useCallback((filePath: string, content: string) => {
        if (!isAnalyzable(filePath)) return false;

        const cached = analysisCache.current.get(filePath);
        const currentHash = hashContent(content);

        if (!cached) return true;

        // 1. İçerik değiştiyse her zaman analiz et
        if (cached.contentHash !== currentHash) return true;

        // 2. TTL kontrolü (1 saat = 3600000ms)
        const CACHE_TTL = 3600_000;
        const now = Date.now();
        if (now - cached.timestamp > CACHE_TTL) {
            console.log(`[AI Background] Cache TTL doldu (${filePath}), yeniden analiz edilecek`);
            return true;
        }

        return false;
    }, []);

    /** Bir dosyayı gerçek AI ile analiz et */
    const analyzeFile = useCallback(async (filePath: string, content: string): Promise<FileAnalysisResult | null> => {
        if (!isAnalyzable(filePath) || !content.trim()) return null;

        try {
            const { performCodeReview } = await import('../services/ai');
            const result = await performCodeReview(filePath, content);

            const fileName = filePath.split(/[/\\]/).pop() || filePath;
            const issues: AIIssue[] = result.issues.map((i: any) => ({
                filePath,
                fileName,
                line: i.line || 0,
                type: i.type,
                message: i.message,
                severity: i.severity,
            }));

            return {
                filePath,
                fileName,
                score: result.score,
                issues,
                suggestions: result.suggestions,
                summary: result.summary,
                analyzedAt: Date.now(),
            };
        } catch (err) {
            console.error(`[AI Background] Analiz hatası (${filePath}):`, err);
            return null;
        }
    }, []);

    /** Kuyruk işleme mantığı - Geliştirilmiş ve Hata Giderilmiş */
    const processQueue = useCallback(async () => {
        if (state.analysisQueue.length === 0 || isAnalyzingRef.current || !isAIReady) return;

        const nextFile = state.analysisQueue[0];
        isAnalyzingRef.current = true;
        setState(prev => ({
            ...prev,
            currentlyAnalyzing: nextFile,
            analysisQueue: prev.analysisQueue.slice(1)
        }));

        console.log(`[AI Background] Analiz başlatılıyor: ${nextFile}`);

        // İçeriği bul (selectedFile ise direct, değilse diskten okumak gerekebilir ama şimdilik selectedFile odaklı)
        // Eğer kuyrukta bekleyen dosya hala selectedFile ise mevcut content kullanılır
        const contentToAnalyze = nextFile === selectedFile ? fileContent : '';

        if (contentToAnalyze) {
            const result = await analyzeFile(nextFile, contentToAnalyze);
            if (result) {
                const contentHash = hashContent(contentToAnalyze);
                analysisCache.current.set(nextFile, { timestamp: Date.now(), contentHash });
                setState(prev => {
                    const newResults = new Map(prev.results);
                    newResults.set(nextFile, result);
                    return { ...prev, results: newResults, currentlyAnalyzing: null };
                });

                if (result.issues.some(i => i.severity === 'high')) {
                    setIsPanelOpen(true);
                }
            } else {
                setState(prev => ({ ...prev, currentlyAnalyzing: null }));
            }
        } else {
            setState(prev => ({ ...prev, currentlyAnalyzing: null }));
        }

        isAnalyzingRef.current = false;

        // Kuyrukta başka dosya varsa bir sonraki tick'te devam et
        setTimeout(() => {
            // State güncellemeleri asenkron olduğu için en güncel haline bakmak için 
            // useEffect veya bağımlılıkla tetiklenebilir.
        }, 100);
    }, [state.analysisQueue, isAIReady, selectedFile, fileContent, analyzeFile]);

    /** Dosya değiştiğinde veya açıldığında otomatik analiz tetikle */
    useEffect(() => {
        if (!selectedFile || !fileContent || !isAIReady) return;
        if (!isAnalyzable(selectedFile)) return;

        if (!shouldAnalyze(selectedFile, fileContent)) {
            return;
        }

        const timer = setTimeout(() => {
            setState(prev => {
                const isAlreadyInQueue = prev.analysisQueue.includes(selectedFile);
                if (isAlreadyInQueue || prev.currentlyAnalyzing === selectedFile) return prev;

                return {
                    ...prev,
                    analysisQueue: [...prev.analysisQueue, selectedFile]
                };
            });
        }, 1500);

        return () => clearTimeout(timer);
    }, [selectedFile, fileContent, isAIReady]);

    // Kuyruk değişimlerini izle ve işleme başlat
    useEffect(() => {
        if (state.analysisQueue.length > 0 && !state.currentlyAnalyzing && !isAnalyzingRef.current) {
            processQueue();
        }
    }, [state.analysisQueue, state.currentlyAnalyzing, processQueue]);

    /** Tüm sonuçları düz dizi olarak al */
    const allIssues = Array.from(state.results.values()).flatMap(r => r.issues);
    const currentFileResult = state.results.get(selectedFile) || null;
    const isAnalyzing = state.currentlyAnalyzing !== null;

    return {
        allIssues,
        currentFileResult,
        allResults: Array.from(state.results.values()),
        isAnalyzing,
        currentlyAnalyzing: state.currentlyAnalyzing,
        isPanelOpen,
        setIsPanelOpen,
        /** Belirli bir dosyayı manuel olarak yeniden analiz et */
        reanalyze: (path: string) => {
            analysisCache.current.delete(path);
        },
    };
}
