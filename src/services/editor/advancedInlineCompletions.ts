import * as monaco from 'monaco-editor';
import { predictionService } from '../predictionService';

/**
 * Modül 4.1: Gelişmiş Inline Completions (Hayalet Metin)
 * VS Code 'inlineCompletionsModel.ts' pattern
 */
export function registerAdvancedInlineCompletions() {
    const languages = ["typescript", "javascript", "typescriptreact", "javascriptreact", "rust", "python"];

    languages.forEach(lang => {
        monaco.languages.registerInlineCompletionsProvider(lang, {
            provideInlineCompletions: async (model, position, _context, token) => {
                // IME kullanımındaysak kapat
                // Version guard logic
                const versionAtRequest = model.getVersionId();

                const content = model.getValue();
                // Ajan tabanlı gerçek tahmin servisini çağır
                const text = await predictionService.getCompletion(
                    content,
                    position.lineNumber,
                    position.column,
                    model.uri.path
                );

                if (token.isCancellationRequested || model.getVersionId() !== versionAtRequest || !text) {
                    return { items: [] };
                }

                return {
                    items: [
                        {
                            insertText: text,
                            range: new monaco.Range(
                                position.lineNumber,
                                position.column,
                                position.lineNumber,
                                position.column
                            ),
                            // Eğer kısmi kabul yapılabilsin istiyorsak command de eklenebilir
                            command: {
                                id: 'corex.acceptPartialCompletions',
                                title: 'Partial Accept',
                                arguments: [text]
                            }
                        },
                    ],
                    enableForwardStability: true, // Type as you go destekli
                };
            },
            handleItemDidShow: () => { },
            disposeInlineCompletions: () => { }
        });
    });

    console.log("🚀 Modül 4.1: Gelişmiş Inline Completions servisi kaydedildi.");
}
