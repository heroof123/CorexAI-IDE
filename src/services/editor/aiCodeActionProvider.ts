import * as monaco from 'monaco-editor';

/**
 * AI Katkılı Code Action Provider (Quick Fix & Refactor)
 * VS Code "Lightbulb" (Ampul) benzeri özellikler sağlar.
 * Hatalara veya seçilen koda göre AI önerileri sunar.
 */
export function registerAICodeActionProvider() {
    // Monaco için global editor command kayıtları:
    // (Bir kez register etmek daha güvenlidir, ancak bu context dışı olduğu için 
    // CustomEvent fırlatarak UI React parçalarının yakalamasını ağlayabiliriz)

    return monaco.languages.registerCodeActionProvider('*', {
        provideCodeActions: (model, range, context, _token) => {
            const actions: monaco.languages.CodeAction[] = [];

            // 1. Otonom Hata Düzeltici (Markers üzerinden çalışır)
            for (const marker of context.markers) {
                if (marker.severity === monaco.MarkerSeverity.Error || marker.severity === monaco.MarkerSeverity.Warning) {

                    // Düzeltici Aksiyonu (Hemen uygular)
                    actions.push({
                        title: `🤖 AI Otonom Düzelt & Açıkla`,
                        diagnostics: [marker],
                        kind: "quickfix",
                        isPreferred: true, // Auto-fix uyumlu olsun (Alt+Enter default fix'i)
                        command: {
                            id: "corex-trigger-inline-chat", // Veya Custom event firelayan bir id
                            title: "AI Auto-Fix",
                            arguments: [{
                                action: "autofix",
                                error: marker.message,
                                code: model.getValueInRange(marker)
                            }]
                        }
                    });

                    // Açıklayıcı Aksiyon
                    actions.push({
                        title: `🤖 Bu hatayı açıklar mısın?`,
                        diagnostics: [marker],
                        kind: "quickfix",
                        command: {
                            id: "corex-trigger-inline-chat",
                            title: "AI Error Explain",
                            arguments: [{
                                action: "explain",
                                error: marker.message,
                                code: model.getValueInRange(marker)
                            }]
                        }
                    });
                }
            }

            // 2. Refactoring Seçenekleri (Sadece kod seçilmişse)
            if (!range.isEmpty()) {
                const selectedText = model.getValueInRange(range);

                // Çok kısa olmayan kod parçalarında çalışsın
                if (selectedText.trim().length > 10) {
                    actions.push({
                        title: `🤖 AI ile Optimize Et (Refactor)`,
                        kind: "refactor.rewrite",
                        command: {
                            id: "corex-trigger-inline-chat",
                            title: "AI Optimize",
                            arguments: [{
                                action: "optimize",
                                code: selectedText
                            }]
                        }
                    });

                    actions.push({
                        title: `🤖 Açıklama Yorumları (Docstrings) Ekle`,
                        kind: "refactor.rewrite",
                        command: {
                            id: "corex-trigger-inline-chat",
                            title: "AI Document",
                            arguments: [{
                                action: "document",
                                code: selectedText
                            }]
                        }
                    });

                    actions.push({
                        title: `🤖 Yeni Bir Fonksiyona Çıkar (Extract Function)`,
                        kind: "refactor.extract",
                        command: {
                            id: "corex-trigger-inline-chat",
                            title: "AI Extract",
                            arguments: [{
                                action: "extract",
                                code: selectedText
                            }]
                        }
                    });
                }
            }

            return {
                actions: actions,
                dispose: () => { }
            };
        }
    });
}
