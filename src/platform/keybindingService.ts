import { commandRegistry } from './commandRegistry';
import { contextKeyService } from './contextKeyService';

/**
 * KeybindingService — Merkezi Kısayol Yöneticisi
 * Etkinleştirilebilir ve devredilebilir durumlarla uyumlu otonom tuş dinleyici
 */
class KeybindingService {
    private static instance: KeybindingService;
    private isListening = false;

    private constructor() { }

    public static getInstance(): KeybindingService {
        if (!KeybindingService.instance) {
            KeybindingService.instance = new KeybindingService();
        }
        return KeybindingService.instance;
    }

    /**
     * Global dinlemeyi başlat
     */
    public start() {
        if (this.isListening) return;

        // Yalnızca uygulamada aktif pencere varken
        window.addEventListener('keydown', this.handleKeyDown);
        this.isListening = true;
    }

    /**
     * Dinlemeyi sonlandır (cleanup vs)
     */
    public stop() {
        if (!this.isListening) return;
        window.removeEventListener('keydown', this.handleKeyDown);
        this.isListening = false;
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        // Normal input vb. alanlardayken kısayolları ezme, 
        // Ancak editör içi ('editorTextFocus' set edilir vs) ve command palette özel ele alınır.

        // Basılan tuş kombinasyonunu string yap
        const keyCombo = this.parseKeyboardEvent(e);

        if (!keyCombo) return;

        // Çalıştırılacak adaylara bak (weight sırayla)
        const commands = commandRegistry.findCommandsByKeybinding(keyCombo);

        for (const cmd of commands) {
            // Input kontrolü: Eger bir input'tayken, cmd "when" gerektirmiyor 
            // veya "when" uymuyorsa, çalıştırma (fırsat ver).
            // Ama eger komut "ctrl+shift+p" (global) isInput olsa bile true donecek sekilde dizayn edilebilir.
            // VS Code mantigiyla, sadece "when" clausenun true dondurdugu ILK komutu calistir.

            const whenClause = cmd.keybinding?.when;

            // Eğer komut herhangi bir context istemeden tanımlandıysa
            // Ancak kullanıcı input giriyorsa (örneğin backspace veya "a"), bu sıkıntıdır. 
            // Default davranış, cmd'nin ne olursa olsun "when" koşuluna uymasi geregi
            // Eger when yoksa calistiracaktir, biz genel bir ayar getirmeliyiz: genelde modifiers olmalidir

            const contextMatches = contextKeyService.evaluate(whenClause);

            if (contextMatches) {
                // En yüksek weight ve uyumlu when'e sahip komut. Yakaladık!
                e.preventDefault();
                e.stopPropagation();

                console.log(`[KeybindingService] Executing '${cmd.id}' with key '${keyCombo}'`);
                try {
                    // Otonom olarak calistir
                    commandRegistry.executeCommand(cmd.id);
                } catch (err) {
                    console.error(`[KeybindingService] Error executing '${cmd.id}':`, err);
                }

                break; // Digerlerini denemene gerek yok, en yuksek calisti.
            }
        }
    };

    /**
     * Klavye olayını `ctrl+shift+a`, `cmd+k cmd+s` gibi parse eder.
     * Şimdilik basitçe tek tuş kombinasyonlarını (modifier+key) çözer.
     */
    private parseKeyboardEvent(e: KeyboardEvent): string {
        const keys: string[] = [];

        // Modifiers (Sabit siralama: ctrl/cmd + alt + shift + tuş)
        if (e.ctrlKey || e.metaKey) keys.push(contextKeyService.evaluate('isMac') ? 'cmd' : 'ctrl');
        if (e.altKey) keys.push('alt');
        if (e.shiftKey) keys.push('shift');

        const rawKey = e.key.toLowerCase();

        // Eger basilan sadece modifier ise atla (örn sadece Shift'e basildiysa isleme alma)
        if (['control', 'meta', 'alt', 'shift'].includes(rawKey)) {
            return '';
        }

        keys.push(rawKey);

        return keys.join('+');
    }
}

export const keybindingService = KeybindingService.getInstance();
