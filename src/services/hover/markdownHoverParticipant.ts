import { IHoverParticipant, HoverPart } from './HoverParticipant';

export class MarkdownHoverParticipant implements IHoverParticipant {
    name = "LSP/Markdown";

    async provideHover(model: any, position: any): Promise<HoverPart | null> {
        // Mock implementation of asking LSP for hover information
        const word = model.getWordAtPosition(position);
        if (word && word.word.length > 3) {
            return {
                content: `**${word.word}**\\n\\n\`\`\`typescript\\nlet ${word.word}: any;\\n\`\`\`\\n\\nProvided by CorexAI Mock Language Server`,
                isMarkdown: true,
                source: this.name
            };
        }
        return null;
    }
}
