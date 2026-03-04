import { callAI, getModelIdForRole } from "../services/ai";
import { invoke } from "@tauri-apps/api/core";
import { accessibilitySignalService, CorexAudioSignal } from "../services/accessibility/accessibilitySignalService";

function extractJsonFromText<T>(text: string): T | null {
    try {
        const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) return JSON.parse(match[1]);
        const first = text.indexOf('{');
        const last = text.lastIndexOf('}');
        return JSON.parse(text.substring(first, last + 1));
    } catch {
        return null;
    }
}

export class StartupGenerator {
    private static instance: StartupGenerator;

    private constructor() { }

    public static getInstance(): StartupGenerator {
        if (!StartupGenerator.instance) {
            StartupGenerator.instance = new StartupGenerator();
        }
        return StartupGenerator.instance;
    }

    public async generateStartup(idea: string, basePath: string, onProgress?: (step: string) => void): Promise<void> {
        const log = (msg: string) => {
            console.log(msg);
            if (onProgress) onProgress(msg);
        };

        log(`🚀 Kuantum Fikir Analiz Ediliyor: "${idea}"`);
        accessibilitySignalService.playSignal(CorexAudioSignal.FOCUS_CHANGED);

        // 1. Planlama
        const planPrompt = `Sen efsanevi CorexAI Startup Jeneratörüsün. Tek tuşla şirket kurarsın.
Fikir: "${idea}" 
Modern bir web projesi (Next.js, Vite, vs.) için gereken EN TEMEL klasör yapısını (5-8 arası dosya) çıkar.
Sadece JSON Formatında dön, Dışarıda markdown olmasın:
{
  "name": "startup-name-no-spaces",
  "structure": ["package.json", "src/App.tsx", "src/main.tsx", "index.html"]
}`;

        log(`🧠 Çekirdek Mimari Kuruluyor...`);
        const planRaw = await callAI(planPrompt, getModelIdForRole());
        let plan = extractJsonFromText<{ name: string, structure: string[] }>(planRaw);

        if (!plan || !plan.structure || !plan.name) {
            plan = {
                name: "corex-startup",
                structure: ["package.json", "src/App.tsx", "src/index.css", "index.html"]
            };
        }

        const projectRoot = basePath ? `${basePath}/${plan.name}` : plan.name;
        log(`📁 Proje Dizini Oluşturuluyor: ${projectRoot}`);

        // 2. Dosya Oluşturma
        for (let i = 0; i < plan.structure.length; i++) {
            const file = plan.structure[i];
            log(`⚡ [${i + 1}/${plan.structure.length}] Cisimleştiriliyor: ${file}`);

            const codePrompt = `Write the full, complete, production-ready code for the file: ${file} 
Startup Name: "${plan.name}"
Core Idea: "${idea}"
Context: This is a CorexAI generated project. Make it beautiful, modern, and perfectly formatted. Use Tailwind CSS heavily if frontend.
Return ONLY the raw code for this file. DO NOT WRAP in markdown like \`\`\`tsx. Just plain executable code.`;

            let code = await callAI(codePrompt, getModelIdForRole());

            code = code.replace(/^```(?:\w+)?\n([\s\S]*?)```$/m, '$1').trim();

            try {
                await invoke("create_file", { path: `${projectRoot}/${file}`, content: code });
            } catch (e) {
                log(`❌ Hata (${file}): ${e}`);
            }
        }

        log(`🎉 EVRENSEL GÖÇ BAŞARILI! Şirketin [${plan.name}] hazırlandı.`);
        log(`📂 Dosyalar diskine yazıldı.`);
        accessibilitySignalService.playSignal(CorexAudioSignal.SUCCESS);
        accessibilitySignalService.announce("Startup Jeneratör başarıyla e-ticaret siteni kurdu.");
    }
}

export const startupGenerator = StartupGenerator.getInstance();
