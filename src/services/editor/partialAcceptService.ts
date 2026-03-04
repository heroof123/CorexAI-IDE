import * as monaco from 'monaco-editor';

/**
 * VS Code "Partial Accept" (Kelime/Satır Bazlı Kabul)
 * Modül 4.1 - Gelişmiş Inline Completions
 */
export class PartialAcceptService {
    private static instance: PartialAcceptService;

    private constructor() { }

    public static getInstance(): PartialAcceptService {
        if (!PartialAcceptService.instance) {
            PartialAcceptService.instance = new PartialAcceptService();
        }
        return PartialAcceptService.instance;
    }

    /**
     * Kalan completion metninden sadece bir sonraki kelimeyi alır
     */
    public getNextWord(completionText: string): string | null {
        if (!completionText) return null;

        // Kelime karakterleri ve kelime olmayan karakterler regexi
        const wordMatch = completionText.match(/^(\W*\w+)/);
        if (wordMatch) {
            return wordMatch[1];
        }

        // Eğer sadece whitespace/noktalama kaldıysa onu da dön
        return completionText.charAt(0);
    }

    /**
     * Kalan completion metninden sadece ilk satırı alır
     */
    public getNextLine(completionText: string): string | null {
        if (!completionText) return null;

        const lineIndex = completionText.indexOf('\n');
        if (lineIndex !== -1) {
            return completionText.substring(0, lineIndex + 1); // Satır sonu dahildir
        }
        return completionText;
    }
}

export const partialAcceptService = PartialAcceptService.getInstance();
