import { snippetManager } from './snippetManager';

export interface CompletionItem {
    label: string;
    insertText: string;
    detail: string;
    documentation?: string;
    kind: 'snippet' | 'keyword' | 'text';
}

class SnippetCompletionProvider {
    /**
     * Get completion items based on current context/prefix and language
     */
    public async provideCompletions(language: string, prefix: string): Promise<CompletionItem[]> {
        // Fallback to searching all or language-specific snippets
        const snippets = language ? snippetManager.getSnippetsByLanguage(language) : snippetManager.getAllSnippets();

        // Filter by prefix
        const lowerPrefix = prefix.toLowerCase();
        const filtered = snippets.filter(s =>
            s.name.toLowerCase().startsWith(lowerPrefix) ||
            s.tags.some(t => t.toLowerCase().startsWith(lowerPrefix))
        );

        return filtered.map(s => ({
            label: s.name,
            insertText: s.code,
            detail: `Snippet: ${s.name}`,
            documentation: s.description,
            kind: 'snippet'
        }));
    }
}

export const snippetCompletionProvider = new SnippetCompletionProvider();
