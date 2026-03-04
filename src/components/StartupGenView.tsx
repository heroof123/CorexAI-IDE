import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { open } from "@tauri-apps/plugin-dialog";
import { startupGenerator } from '../services/startupGenerator';
import { accessibilitySignalService, CorexAudioSignal } from '../services/accessibility/accessibilitySignalService';

export const StartupGenView: React.FC = () => {
    const [idea, setIdea] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [steps, setSteps] = useState<string[]>([]);

    const handleGenerate = async () => {
        if (!idea.trim()) return;

        let selectedDir = "";
        try {
            const result = await open({
                directory: true,
                multiple: false,
                title: 'Girişim (Startup) Klasörünü Seçin'
            });
            if (!result || typeof result !== "string") {
                return; // User cancelled
            }
            selectedDir = result;
        } catch (e) {
            console.error("Klasör seçilemedi:", e);
            return;
        }

        setIsGenerating(true);
        setSteps(['Evrenin derinliklerinde fikir taranıyor...', 'Pazar araştırması ve rakipler simüle ediliyor...', 'Kuantum mimarisi başlatılıyor...']);
        accessibilitySignalService.playSignal(CorexAudioSignal.FOCUS_CHANGED);

        try {
            await startupGenerator.generateStartup(idea, selectedDir, (step) => {
                setSteps(prev => [...prev, step]);
            });

            setSteps(prev => [...prev, '🔥 Girişim başarıyla başlatıldı! Evrenin yeni efendisi sensin.']);
        } catch (error) {
            console.error(error);
            setSteps(prev => [...prev, `❌ Hata: Klasik evren çöktü. ${error}`]);
            accessibilitySignalService.playSignal(CorexAudioSignal.ERROR);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#050505] p-6 gap-6 relative overflow-hidden text-white font-sans">
            {/* Background Glows */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-orange-600/10 blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-600/10 blur-[120px] pointer-events-none" />

            <div className="space-y-1 relative z-10 text-center mt-2">
                <h3 className="text-xl font-black uppercase tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-purple-500 max-w-max mx-auto filter drop-shadow-[0_0_10px_rgba(251,146,60,0.4)]">
                    Autonomous Startup
                </h3>
                <p className="text-[11px] text-neutral-400 font-mono tracking-widest mt-2 uppercase opacity-70">
                    Hemen bir Fikir ver, Kodunu, Mimarisini Biz Kuralım. Milyoner Ol.
                </p>
            </div>

            <div className="space-y-4 relative z-10 mt-6 z-20">
                <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="Örn: Evdeki kedilerin mama saatini IoT ile ölçüp analiz eden karanlık temalı modern SaaS uygulaması..."
                    className="w-full bg-black/60 backdrop-blur-sm border border-orange-500/20 rounded-2xl p-5 text-sm font-medium text-white outline-none focus:border-orange-500/60 focus:bg-black/80 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] min-h-[140px] resize-none transition-all placeholder-neutral-600"
                    disabled={isGenerating}
                />

                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !idea.trim()}
                    className="w-full py-4 text-xs font-black uppercase tracking-[0.25em] rounded-xl overflow-hidden relative group transition-all disabled:opacity-40 disabled:cursor-not-allowed
                    bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-[0_0_30px_rgba(234,88,12,0.3)] hover:shadow-[0_0_50px_rgba(234,88,12,0.5)]"
                >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {isGenerating ? (
                        <span className="flex items-center justify-center gap-3 animate-pulse text-white">
                            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            ŞİRKET İNŞA EDİLİYOR...
                        </span>
                    ) : (
                        <span className="text-white drop-shadow-md">🚀 BİR ŞİRKET İNŞA ET</span>
                    )}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-2 custom-scrollbar relative z-10 px-1 pb-4">
                <div className="space-y-3">
                    <AnimatePresence>
                        {steps.map((step, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className="flex items-center gap-4 text-xs font-mono bg-black/40 backdrop-blur-md p-3.5 rounded-xl border border-white/5 shadow-sm"
                            >
                                <span className={
                                    step.includes('❌') ? 'text-red-500 text-lg' :
                                        step.includes('🚀') ? 'text-orange-400 text-lg' :
                                            step.includes('🧠') ? 'text-purple-400 text-lg' :
                                                step.includes('🎉') ? 'text-amber-400 text-lg' :
                                                    'text-emerald-400 text-lg'
                                }>
                                    {step.includes('❌') ? '⚠️' : step.includes('🚀') || step.includes('🧠') || step.includes('🎉') ? '' : '•'}
                                </span>
                                <span className={step.includes('❌') ? 'text-red-300 font-bold' : step.includes('🎉') ? 'text-amber-300 font-bold tracking-wide' : 'text-neutral-300'}>
                                    {step}
                                </span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
