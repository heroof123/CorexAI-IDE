const fs = require('fs');

let browserContent = fs.readFileSync('src/components/GGUFModelBrowser.tsx', 'utf8');

const startStr = '{/* Sağ Panel - Model Ayarları */}';
const startIndex = browserContent.indexOf(startStr);
if (startIndex !== -1) {
    const selectedStart = browserContent.indexOf('{selectedModelForConfig && (', startIndex);
    let openBraces = 0;
    let endIndex = -1;
    let inString = false;
    let stringChar = '';

    for (let i = selectedStart; i < browserContent.length; i++) {
        const char = browserContent[i];
        if (!inString) {
            if (char === '{' || char === '(') openBraces++;
            else if (char === '}' || char === ')') {
                openBraces--;
                if (openBraces === 0) {
                    endIndex = i;
                    break;
                }
            } else if (char === "'" || char === '"' || char === '`') {
                inString = true;
                stringChar = char;
            }
        } else {
            if (char === stringChar && browserContent[i - 1] !== '\\') {
                inString = false;
            }
        }
    }

    if (endIndex !== -1) {
        let extractedBlock = browserContent.substring(selectedStart, endIndex + 1);

        // Basic cleanup of {selectedModelForConfig && ( ... )}
        extractedBlock = extractedBlock.replace('{selectedModelForConfig && (', '');
        extractedBlock = extractedBlock.replace(/\)\s*\}/, '');
        // Trim starting whitespaces
        extractedBlock = extractedBlock.trim();

        let panelContent = fs.readFileSync('src/components/GGUFModelBrowser/ModelSettingsPanel.tsx', 'utf8');
        const returnStart = panelContent.indexOf('return (');
        const endBraceIndex = panelContent.lastIndexOf('}');
        const returnEndIndex = panelContent.lastIndexOf(';', endBraceIndex);

        if (returnStart !== -1 && returnEndIndex !== -1) {
            const newReturn = "    return (\n        <div className=\"w-1/3 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)] p-2.5 flex flex-col max-h-[calc(100vh-200px)]\">\n            " +
                extractedBlock.split('\n').join('\n            ') +
                "\n        </div>\n    );\n";
            panelContent = panelContent.substring(0, returnStart) + newReturn + "}";
            fs.writeFileSync('src/components/GGUFModelBrowser/ModelSettingsPanel.tsx', panelContent);
            console.log('Successfully updated ModelSettingsPanel.tsx');
        } else {
            console.error('ModelSettingsPanel return statement not found');
            console.log(returnStart, returnEndIndex);
        }
    } else {
        console.error('ModelSettingsPanel end not found');
    }
} else {
    console.error('ModelSettingsPanel start not found');
}
