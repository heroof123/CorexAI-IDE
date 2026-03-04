export const SemanticTokenTypes = [
    'namespace',
    'type',
    'class',
    'enum',
    'interface',
    'struct',
    'typeParameter',
    'parameter',
    'variable',
    'property',
    'enumMember',
    'event',
    'function',
    'method',
    'macro',
    'keyword',
    'modifier',
    'comment',
    'string',
    'number',
    'regexp',
    'operator',
    // CorexAI'a özel, karakterin analizlerinden beslenen yepyeni token'lar
    'corex-optimized',   // Yapay zekanın mükemmel bulduğu, çok hızlı çalışan algoritmalar
    'corex-vulnerable',  // AI'ın sezdiği güvenlik zafiyeti içeren metodlar
    'corex-deprecated',  // Eski nesil, kullanılmaması gereken kod yapıları
    'corex-magic'        // CorexAI'ın o esnada kendi yazdığı/dokunduğu satırlar
];

export const SemanticTokenModifiers = [
    'declaration',
    'readonly',
    'static',
    'deprecated',
    'abstract',
    'async',
    'modification',
    'documentation',
    'defaultLibrary'
];

export function getTokenTypesLegend() {
    return SemanticTokenTypes;
}

export function getTokenModifiersLegend() {
    return SemanticTokenModifiers;
}
