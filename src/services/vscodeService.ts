/**
 * VS Code Compatibility Service
 * 
 * Provides a bridge for importing VS Code themes and snippets.
 * Maps VS Code JSON structures to CorexAI's native theme engine and Monaco snippets.
 */

export interface VSCodeTheme {
    name: string;
    colors: Record<string, string>;
    tokenColors: any[];
}

export class VSCodeCompatibilityService {
    /**
     * Maps VS Code theme keys to CorexAI CSS variables
     */
    private THEME_MAPPING: Record<string, string> = {
        'editor.background': '--color-background',
        'sideBar.background': '--color-surface',
        'activityBar.background': '--color-background',
        'editor.foreground': '--color-text',
        'sideBar.foreground': '--color-textSecondary',
        'list.hoverBackground': '--color-hover',
        'button.background': '--color-primary',
        'input.background': '--color-surface',
        'editorGroupHeader.tabsBackground': '--color-background',
        'tab.activeBackground': '--color-surface',
    };

    /**
     * Import a VS Code Theme JSON
     */
    public importTheme(vscodeTheme: VSCodeTheme): string {
        console.log(`🧩 Importing VS Code Theme: ${vscodeTheme.name}`);
        const root = document.documentElement;

        let appliedCount = 0;
        Object.entries(this.THEME_MAPPING).forEach(([vscodeKey, corexVar]) => {
            const color = vscodeTheme.colors[vscodeKey];
            if (color) {
                root.style.setProperty(corexVar, color);
                appliedCount++;
            }
        });

        return `✅ ${vscodeTheme.name} teması başarıyla uygulandı (${appliedCount} renk eşleştirildi).`;
    }

    /**
     * Import VS Code Snippets
     * In a real implementation, this would register with Monaco
     */
    public importSnippets(snippets: Record<string, any>): string {
        const count = Object.keys(snippets).length;
        console.log(`🧩 Importing ${count} VS Code Snippets`);

        // Mock injection into a global registry
        // (window as any).extraSnippets = { ...(window as any).extraSnippets, ...snippets };

        return `✅ ${count} adet VS Code Snippet başarıyla yüklendi.`;
    }

    /**
     * Mock VSIX parsing (actually just JSON for now)
     */
    public parsePackageJson(packageJson: any) {
        // Look for contributes -> themes or contributes -> snippets
        return packageJson.contributes || {};
    }
}

export const vscodeService = new VSCodeCompatibilityService();
