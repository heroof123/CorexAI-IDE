import { useState, useCallback } from "react";
import { callAI } from "../services/aiProvider";

interface ModelResponse {
    modelId: string;
    modelName: string;
    content: string;
    duration: number;
    status: 'idle' | 'running' | 'completed' | 'error';
}

export default function ModelRoulette() {
    const [prompt, setPrompt] = useState("");
    const [responses, setResponses] = useState<ModelResponse[]>([]);
    const [isGlobalLoading, setIsGlobalLoading] = useState(false);

    const startArena = useCallback(async () => {
        if (!prompt.trim()) return;

        // Define models to compare (can be made dynamic later)
        const modelsToCompare = [
            { id: 'ollama:qwen2.5-coder', name: 'Qwen 2.5 Coder' },
            { id: 'ollama:llama3', name: 'Llama 3' },
            { id: 'gguf:local', name: 'Local GGUF' }
        ];

        const initialResponses: ModelResponse[] = modelsToCompare.map(m => ({
            modelId: m.id,
            modelName: m.name,
            content: "",
            duration: 0,
            status: 'running'
        }));

        setResponses(initialResponses);
        setIsGlobalLoading(true);

        // Run all models concurrently
        const promises = modelsToCompare.map(async (model, index) => {
            const startTime = Date.now();
            try {
                let accumulated = "";
                await callAI(prompt, model.id, [], (token) => {
                    accumulated += token;
                    setResponses(prev => prev.map((r, i) =>
                        i === index ? { ...r, content: accumulated } : r
                    ));
                });

                setResponses(prev => prev.map((r, i) =>
                    i === index ? {
                        ...r,
                        status: 'completed',
                        duration: (Date.now() - startTime) / 1000
                    } : r
                ));
            } catch (error) {
                console.error(`Arena error (${model.name}):`, error);
                setResponses(prev => prev.map((r, i) =>
                    i === index ? { ...r, status: 'error', content: "❌ Model yanıt vermedi." } : r
                ));
            }
        });

        await Promise.allSettled(promises);
        setIsGlobalLoading(false);
    }, [prompt]);

    return (
        <div className="h-full flex flex-col bg-[var(--color-background)]">
            {/* Header */}
            <div className="p-4 border-b border-[var(--color-border)] bg-white/5">
                <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                    ⚔️ Model Roulette (Arena)
                </h2>
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">
                    Multi-LLM Benchmarking & Comparison
                </p>
            </div>

            {/* Input Area */}
            <div className="p-4 border-b border-[var(--color-border)] bg-black/20">
                <div className="flex flex-col gap-3">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Kıyaslamak istediğin promptu buraya yaz..."
                        className="w-full h-24 p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm focus:border-blue-500 outline-none transition-all resize-none"
                    />
                    <button
                        onClick={startArena}
                        disabled={isGlobalLoading || !prompt.trim()}
                        className={`w-full py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${isGlobalLoading || !prompt.trim()
                            ? 'bg-neutral-800 text-neutral-500'
                            : 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/20'
                            }`}
                    >
                        {isGlobalLoading ? (
                            <><div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Arena Devam Ediyor...</>
                        ) : 'Modelleri Yarıştır'}
                    </button>
                </div>
            </div>

            {/* Responses Area */}
            <div className="flex-1 overflow-x-auto overflow-y-auto p-4 flex gap-4 custom-scrollbar">
                {responses.map((resp: ModelResponse) => (
                    <div key={resp.modelId} className="min-w-[280px] flex-1 flex flex-col bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-2xl">
                        {/* Model Header */}
                        <div className="p-3 bg-white/5 border-b border-[var(--color-border)] flex justify-between items-center">
                            <div>
                                <h3 className="text-xs font-bold text-white leading-none mb-1">{resp.modelName}</h3>
                                <span className="text-[10px] text-neutral-500 font-mono">{resp.modelId}</span>
                            </div>
                            {resp.status === 'completed' && (
                                <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20">
                                    {resp.duration}s
                                </span>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-3 overflow-y-auto text-[11px] leading-relaxed text-neutral-300 font-light whitespace-pre-wrap">
                            {resp.status === 'running' && !resp.content && (
                                <div className="h-full flex flex-col items-center justify-center opacity-30">
                                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-2" />
                                    <span>Yanıt bekleniyor...</span>
                                </div>
                            )}
                            {resp.content}
                            {resp.status === 'error' && (
                                <div className="text-red-500 italic p-2 border border-red-500/20 bg-red-500/5 rounded">
                                    {resp.content}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
