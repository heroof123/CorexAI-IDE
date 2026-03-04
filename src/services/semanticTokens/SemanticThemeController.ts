export const getCorexSemanticThemeRules = () => {
    return [
        // AI'nın harika/optimum bulduğu kodlar: Parlak bir elmas mavisi
        { token: 'corex-optimized', foreground: '#00F3FF', fontStyle: 'bold' },

        // Ciddi güvenlik açığı ya da ölümcül olan noktalar: Kan kırmızısı ve altı çizili
        { token: 'corex-vulnerable', foreground: '#FF2A2A', fontStyle: 'underline' },

        // Eskimiş, CorexAI'ın hiç sevmediği legacy kodlar: Silik ve çizik
        { token: 'corex-deprecated', foreground: '#8E9196', fontStyle: 'strikethrough' },

        // CorexAI "magic" kodlara tepkisi (O2/O3 optimize algoritmalara benzeyen isimler)
        { token: 'corex-magic', foreground: '#B534FF', fontStyle: 'italic bold' },
    ];
};

/**
 * Bu fonksiyon Monaco editor init esnasında çağırılıp, temanın kurallarına enjekte edilebilir.
 * Örnek kullanım:
 * monaco.editor.defineTheme('corex-dark', {
 *   base: 'vs-dark',
 *   inherit: true,
 *   rules: [
 *      ...getCorexSemanticThemeRules(),
 *      { background: '#1e1e1e' }
 *   ]
 * });
 */
