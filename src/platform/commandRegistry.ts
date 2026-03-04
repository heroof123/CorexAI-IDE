export interface Command {
    id: string; // Örn: 'corex.inline-chat'
    title: string; // Kullanıcı Arayüzü İçin: 'CorexAI: Open Inline Chat'
    category?: string; // Menü veya Command Palette Filtresi
    run: (...args: unknown[]) => void | Promise<void>;

    // Eğer command direkt bir kısayolla çalışacaksa:
    keybinding?: {
        key: string;      // Örn: 'ctrl+i', 'cmd+shift+p'
        when?: string;    // bağlam koşulları ('editorFocus && !isMac')
        weight?: number;  // çatışma durumunda öncelik seviyesi (yüksek = kazanır)
    };
}

export class CommandRegistry {
    private static instance: CommandRegistry;
    private commands = new Map<string, Command>();

    private constructor() { }

    public static getInstance(): CommandRegistry {
        if (!CommandRegistry.instance) {
            CommandRegistry.instance = new CommandRegistry();
        }
        return CommandRegistry.instance;
    }

    /**
     * Merkezî Komut Kaydı
     */
    public registerCommand(command: Command) {
        if (this.commands.has(command.id)) {
            console.warn(`[CommandRegistry] '${command.id}' zaten kayıtlı! Üzerine yazılıyor...`);
        }
        this.commands.set(command.id, command);
    }

    /**
     * Özel argümanlarla otonom komut çalıştırıcı
     */
    public executeCommand(id: string, ...args: unknown[]): void | Promise<void> {
        const cmd = this.commands.get(id);
        if (!cmd) {
            console.error(`[CommandRegistry] Bulunamayan komut yürütülmek istendi: ${id}`);
            return;
        }

        // Command için "when" kısıtlaması yok, "when" daha çok Kısayollar ve Menü UI içindir.
        // Ancak komut çalışıyorsa context uygun olmalı ki menü o an etkinleşebilmiş.
        return cmd.run(...args);
    }

    /**
     * Yürütülebilir ve filtrelenebilir tüm kayıtlı komutları alır (Örn: Command Palette için)
     */
    public getCommands(): Command[] {
        return Array.from(this.commands.values());
    }

    /**
     * Tuş kombinasyonlarına karşılık gelen komutları bulmak için filtreler
     */
    public findCommandsByKeybinding(key: string): Command[] {
        const matched: Command[] = [];

        for (const cmd of this.commands.values()) {
            if (cmd.keybinding?.key === key) {
                matched.push(cmd);
            }
        }

        // Weight'e göre önceliklendir: Daha yüksek weight olan en üste gelsin
        return matched.sort((a, b) => {
            const wa = a.keybinding?.weight || 0;
            const wb = b.keybinding?.weight || 0;
            return wb - wa;
        });
    }
}

export const commandRegistry = CommandRegistry.getInstance();
