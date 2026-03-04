import { snippetManager } from './snippetManager';

export interface CodeActionInfo {
    id: string;
    title: string;
    description?: string;
    action: () => string; // Returns the code that will be injected or replaced
}

class SnippetCodeActionProvider {
    /**
     * Provide quick fixes or refactor options based on selected text or context
     */
    public provideActions(selectedText: string, language: string): CodeActionInfo[] {
        const actions: CodeActionInfo[] = [];

        // E.g., if there's no selection, maybe suggest inserting a boiler plate
        if (!selectedText || selectedText.trim() === '') {
            const templates = snippetManager.getSnippetsByLanguage(language).filter(s => s.tags.includes('template') || s.tags.includes('boilerplate'));

            templates.forEach(t => {
                actions.push({
                    id: `insert-${t.id}`,
                    title: `Şablon Ekle: ${t.name}`,
                    description: t.description,
                    action: () => t.code
                });
            });
        } else {
            // Suggest refactoring / extraction snippets
            // This is a naive heuristic
            if (language === 'typescript' || language === 'javascript') {
                actions.push({
                    id: 'extract-function',
                    title: 'Seçimi Fonksiyon Olarak Çıkar',
                    description: 'Seçili satırları yeni bir fonksiyona taşır',
                    action: () => {
                        return `function extractedFunction() {\n${selectedText.split('\\n').map(l => '    ' + l).join('\\n')}\n}`;
                    }
                });

                actions.push({
                    id: 'wrap-try-catch',
                    title: 'Try/Catch içine al',
                    description: 'Hata yakalama bloğu ekler',
                    action: () => {
                        return `try {\n${selectedText.split('\\n').map(l => '    ' + l).join('\\n')}\n} catch (error) {\n    console.error(error);\n}`;
                    }
                });
            }
        }

        return actions;
    }
}

export const snippetCodeActionProvider = new SnippetCodeActionProvider();
