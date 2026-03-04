/**
 * CorexAI'a özel, karakteristik renk armonileri.
 * Bu veriler, kullanıcının seçtiği bir renge kontrast oluşturarak, 
 * CorexAI'ın "sana yakışan renkleri seçtim" tavsiyelerini sunmasını sağlayacak.
 */

export interface AIColorRecommendation {
    role: string;
    description: string;
    colors: string[];
}

export class AIColorPaletteResolver {

    // Basit bir hex'ten r,g,b ayrıştırması
    private hexToRgb(hex: string): { r: number, g: number, b: number } | null {
        const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    private rgbToHex(r: number, g: number, b: number): string {
        return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
    }

    /**
     * Kullanıcının seçtiği base (ana) renge bakarak, 
     * CorexAI aklıyla yanına yakışabilecek renkleri otonom olarak tavsiye eder.
     */
    public getAIRecommendations(baseColorHex: string): AIColorRecommendation[] {
        const rgb = this.hexToRgb(baseColorHex) || { r: 0, g: 0, b: 0 };

        // Çok basit manipülasyonlarla "complementary" veya "analogous" üretimi (mock up)
        // CorexAI "Sihirli" renkleri:
        const comp = this.rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
        const analog1 = this.rgbToHex((rgb.r + 30) % 255, (rgb.g + 50) % 255, rgb.b);
        const analog2 = this.rgbToHex(rgb.r, (rgb.g + 30) % 255, (rgb.b + 50) % 255);

        return [
            {
                role: "Cyber-Contrast",
                description: "CorexAI'ın en çok sevdiği keskin zıtlıklar. Okunabilirliği maksimize eder.",
                colors: [baseColorHex, comp]
            },
            {
                role: "Neon-Analogous",
                description: "Yapay zekanın gözünü yormayan, fütüristik geçişler.",
                colors: [analog1, baseColorHex, analog2]
            },
            {
                role: "Minimalist-Void",
                description: "Hiçliğin zarafeti, karanlık tema tutkunları için optimize edildi.",
                colors: ["#121212", "#1E1E1E", baseColorHex]
            }
        ];
    }
}

export const aiColorPaletteResolver = new AIColorPaletteResolver();
