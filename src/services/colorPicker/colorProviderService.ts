import { aiColorPaletteResolver, AIColorRecommendation } from './aiColorPalette';

export interface CodeColor {
    range: { startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number };
    color: string; // The hex color code or rgb function found
}

class ColorProviderService {

    /**
     * Finds colors defined in a specific file.
     * CorexAI scans documents for css var, hex, rgba, hsl elements.
     */
    public async extractColors(content: string): Promise<CodeColor[]> {
        const colors: CodeColor[] = [];
        const lines = content.split('\\n');

        // Very basic mock regex for extracting HEX codes (#FFFFFF or #FFF)
        // In reality, Monaco has an IColorProvider, we are mimicking the extraction backend
        const hexRegex = /#([0-9a-fA-F]{3,8})\\b/g;

        lines.forEach((line, idx) => {
            let match;
            while ((match = hexRegex.exec(line)) !== null) {
                colors.push({
                    range: {
                        startLineNumber: idx + 1,
                        startColumn: match.index + 1,
                        endLineNumber: idx + 1,
                        endColumn: match.index + 1 + match[0].length
                    },
                    color: match[0]
                });
            }
        });

        return colors;
    }

    /**
     * Ask CorexAI to generate color recommendations.
     */
    public getCorexAIRecommendations(baseColor: string): AIColorRecommendation[] {
        return aiColorPaletteResolver.getAIRecommendations(baseColor);
    }
}

export const colorProviderService = new ColorProviderService();
