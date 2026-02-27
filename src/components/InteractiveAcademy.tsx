import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { callAI } from "../services/aiProvider";
import { getModelIdForRole } from "../services/ai";

interface AcademyProps {
    selectedFile: string;
}

export default function InteractiveAcademy({ selectedFile }: AcademyProps) {
    const [lesson, setLesson] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress] = useState({ rust: 35, react: 62, logic: 48 });

    const analyzeCurrentFile = useCallback(async () => {
        if (!selectedFile) return;
        setIsAnalyzing(true);
        setLesson(null);

        try {
            // Read file content
            const content: string = await invoke("read_file", { path: selectedFile });

            const prompt = `Sen bir eğitim asistanısın. Kullanıcının şu anda yazdığı kodu analiz et ve ona "Günün Dersi" kıvamında, kodunu nasıl geliştirebileceğine dair 3 maddelik çok kısa ve eğitici bir geri bildirim ver. Dil: Türkçe. 
            Dosya: ${selectedFile}
            İçerik:
            ${content}
            
            Format: Markdown kullan. Başlık: "🎓 Bugünün Dersi" olsun.`;

            let accumulated = "";
            const modelId = getModelIdForRole();

            await callAI(prompt, modelId, [], (token) => {
                accumulated += token;
                setLesson(accumulated);
            });
        } catch (error) {
            console.error("Academy analysis error:", error);
            setLesson("❌ Kod analiz edilemedi. Lütfen geçerli bir dosya açın.");
        } finally {
            setIsAnalyzing(false);
        }
    }, [selectedFile]);

    return (
        <div className="h-full flex flex-col bg-[var(--color-background)] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="p-6 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-b border-[var(--color-border)]">
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    🎓 Corex Academy
                </h2>
                <p className="text-sm text-neutral-400">
                    Kodlarını analiz ederek seni bir adım öteye taşıyan kişisel yazılım hocan.
                </p>
            </div>

            <div className="p-4 space-y-6">
                {/* Stats Section */}
                <div className="grid grid-cols-1 gap-3">
                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest px-1">Beceri Seviyelerin</h3>
                    {Object.entries(progress).map(([skill, val]) => (
                        <div key={skill} className="bg-[var(--color-surface)] p-3 rounded-xl border border-[var(--color-border)]">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-semibold capitalize">{skill}</span>
                                <span className="text-[10px] text-blue-400">lvl {Math.floor(val / 10)}</span>
                            </div>
                            <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000"
                                    style={{ width: `${val}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Action */}
                <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-xl">
                    <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center bg-white/5">
                        <span className="text-xs font-bold text-neutral-300">Aktif Dosya Analizi</span>
                        <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                            📁 {selectedFile?.split(/[/\\]/).pop() || 'Dosya seçilmedi'}
                        </div>
                    </div>

                    <div className="p-5">
                        {!lesson && !isAnalyzing ? (
                            <div className="text-center py-4">
                                <div className="text-3xl mb-3">🧐</div>
                                <p className="text-sm text-neutral-400 mb-5">
                                    Şu an açık olan dosyanı analiz etmemi ister misin?<br />
                                    Hatalarını değil, gelişim alanlarını konuşalım.
                                </p>
                                <button
                                    onClick={analyzeCurrentFile}
                                    disabled={!selectedFile}
                                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${selectedFile
                                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                                        : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                        }`}
                                >
                                    {selectedFile ? 'Kodumu Analiz Et & Eğitime Başla' : 'Önce Bir Dosya Açmalısın'}
                                </button>
                            </div>
                        ) : (
                            <div className="min-h-[200px] relative">
                                {isAnalyzing && !lesson && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-surface)]">
                                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                                        <p className="text-xs text-neutral-500">Hocan kodu inceliyor...</p>
                                    </div>
                                )}
                                <div className="prose prose-invert prose-sm max-w-none text-neutral-300 lesson-content">
                                    {lesson}
                                </div>
                                {lesson && !isAnalyzing && (
                                    <button
                                        onClick={() => setLesson(null)}
                                        className="mt-6 w-full py-2 border border-blue-500/30 text-blue-400 text-xs rounded-lg hover:bg-blue-500/10 transition-colors"
                                    >
                                        Yeni Bir Analiz Yap
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Tutorials */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest px-1">Önerilen Eğitimler</h3>
                    <div className="p-4 bg-gradient-to-r from-green-600/10 to-emerald-600/10 border border-green-500/20 rounded-xl cursor-pointer hover:border-green-500/40 transition-all group">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center text-xl">🦀</div>
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-white group-hover:text-green-400">Rust Memory Safety</h4>
                                <p className="text-[10px] text-neutral-500">Ownership ve Borrowing mantığını 5 dakikada çöz.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
