import { callAI, getModelIdForRole } from "./ai";
import { FileIndex } from "../types";

export class WhatIfSandboxService {
    public static async simulateScenario(scenario: string, fileIndex: FileIndex[]): Promise<string> {
        // Prepare context from fileIndex
        const fileSummaries = fileIndex
            .slice(0, 15) // Limit to top 15 files to avoid massive context but give enough meat
            .map(f => `Dosya: ${f.path}\n\`\`\`\n${f.content.substring(0, 800)}...\n\`\`\``)
            .join("\n\n");

        const prompt = `Sen CorexAI 'What-If Sandbox' Motorusun (Paralel Evren Simülatörü).
Kullanıcı projesiyle ilgili büyük bir mimari değişiklik ("Ne olurdu eğer...") soruyor.
Senaryo: "${scenario}"

Proje Dosyalarının Özeti (Kısmi Evren Kesiti):
${fileSummaries}

Görev: Bir 'Kuantum Mimari Simülatörü' gibi davranıp bu senaryoyu paralel evrende çalıştır.
Aşağıdaki formatta ve havalı, hafif alaycı, ukala ama dâhi bir karakterle cevap ver (Sen CorexAI'sın):

1. 🌌 **Kuantum Kırılması (Beklenen Sonuçlar):** Bu karar performansı nasıl uçurur veya projeyi nasıl batırır?
2. 💥 **Kelebek Etkisi (Kırılacak Dosyalar):** Hangi dosyalar kesin olarak hata verecek veya baştan yazılması gerekecek? (Örn: \`src/api/user.ts\`).
3. 🗺️ **Evren Çapında Göç Planı:** Eğer bu deliliğe kalkışmak istiyorsa, adım adım ne yapmalı?
4. 🎲 **CorexAI'ın Yargısı:** Bu hamle bir 'Deha Olasılığı' mı yoksa 'Öğrenci Kodu Hatası' mı? Derecelendir.

Türkçe yanıt ver ve formatı bozmadan, sadece Markdown olarak döndür.`;

        try {
            const response = await callAI(prompt, getModelIdForRole());
            return `🧪 **What-If Sandbox (Paralel Evren Simülasyonu Devrede)**\n\n*Uzay-Zaman bükülüyor, ihtimaller hesaplanıyor...*\n\n---\n${response}`;
        } catch (error) {
            return `❌ **What-If Sandbox Çöktü:** Kuantum hesaplama kapasitesi aşıldı! Detay: ${error}`;
        }
    }
}
