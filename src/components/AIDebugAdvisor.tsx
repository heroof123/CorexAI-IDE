import React, { useState, useEffect } from 'react';
import { aiDebugService, DebugState } from '../services/aiDebugService';
import { callAI } from '../services/aiProvider';
import { getModelIdForRole } from '../services/ai';
import { Bug, Sparkles, Play } from 'lucide-react';

export const AIDebugAdvisor: React.FC = () => {
    const [state, setState] = useState<DebugState>(aiDebugService.getState());
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        const unsubscribe = aiDebugService.subscribe((newState) => {
            setState(newState);
            if (!newState.isPaused) {
                setAnalysis(null);
            }
        });
        return unsubscribe;
    }, []);

    const analyzeState = async () => {
        if (!state.isPaused) return;
        setIsAnalyzing(true);
        setAnalysis("");

        const prompt = `
            Sen bir kıdemli hata ayıklama (debug) asistanısın. 
            Aşağıdaki debug verilerini incele ve bu noktada neden durulmuş olabileceğini, 
            değişkenlerdeki olası mantık hatalarını ve bir sonraki adımda neye dikkat edilmesi gerektiğini açıkla.
            
            Aktif Dosya: ${state.activeFile} (Satır: ${state.activeLine})
            
            Değişkenler:
            ${state.variables.map(v => `- ${v.name} (${v.type}): ${v.value}`).join('\n')}
            
            Call Stack:
            ${state.callStack.map(f => `- ${f.function} @ ${f.file}:${f.line}`).join('\n')}
            
            Lütfen kısa, teknik ve aksiyon odaklı bir cevap ver. Dil: Türkçe.
        `;

        try {
            const modelId = getModelIdForRole();
            let accumulated = "";
            await callAI(prompt, modelId, [], (token) => {
                accumulated += token;
                setAnalysis(accumulated);
            });
        } catch (error) {
            console.error("Debug analysis error:", error);
            setAnalysis("❌ Analiz yapılamadı.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (!state.isPaused) return null;

    return (
        <div className="mt-4 bg-indigo-600/10 border border-indigo-500/30 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-3 bg-indigo-600/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-400" />
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">AI Debug Danışmanı</span>
                </div>
                <button
                    onClick={() => aiDebugService.resume()}
                    className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-white transition-colors flex items-center gap-1"
                >
                    <Play size={10} fill="currentColor" /> Devam Et
                </button>
            </div>

            <div className="p-4">
                {!analysis && !isAnalyzing ? (
                    <div className="flex flex-col items-center gap-3 py-2 text-center">
                        <Bug size={32} className="text-indigo-400/50" />
                        <p className="text-[11px] text-neutral-400 leading-relaxed">
                            Kod şu an duraklatıldı.<br />
                            Değişkenleri ve stack trace'i AI ile analiz etmek ister misin?
                        </p>
                        <button
                            onClick={analyzeState}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg shadow-lg shadow-indigo-600/20 transition-all"
                        >
                            Canlı Analiz Başlat
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {isAnalyzing && !analysis && (
                            <div className="flex items-center gap-2 py-4 animate-pulse">
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75" />
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150" />
                                <span className="text-[10px] text-indigo-400 ml-2">Mantık hataları taranıyor...</span>
                            </div>
                        )}
                        <div className="prose prose-invert prose-xs text-[11px] text-neutral-300 leading-relaxed">
                            {analysis}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
