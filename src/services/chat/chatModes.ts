/**
 * Chat Modes Service
 * VS Code coreAi-main/src/vs/workbench/contrib/chat/common/chatModes.ts referans alınarak yazıldı
 *
 * 3 mod:
 * - ask:   Sadece soru/cevap, dosya değiştirmez
 * - edit:  Dosyaları düzenler, kullanıcı onayı gerekir
 * - agent: Tam otonom, tool kullanır, dosya oluşturur/siler
 */

import { ChatMode } from './chatEditingTypes';

export interface ChatModeDefinition {
    id: ChatMode;
    label: string;
    description: string;
    icon: string;
    color: string;
    canEditFiles: boolean;
    canRunTools: boolean;
    canCreateFiles: boolean;
    requiresConfirmation: boolean;
}

export const CHAT_MODES: Record<ChatMode, ChatModeDefinition> = {
    ask: {
        id: 'ask',
        label: 'Sor',
        description: 'Sadece soru ve cevap — dosya değiştirmez',
        icon: '💬',
        color: '#60a5fa',
        canEditFiles: false,
        canRunTools: false,
        canCreateFiles: false,
        requiresConfirmation: false,
    },
    edit: {
        id: 'edit',
        label: 'Düzenle',
        description: 'Dosyaları düzenler — onay gerekir',
        icon: '✏️',
        color: '#34d399',
        canEditFiles: true,
        canRunTools: false,
        canCreateFiles: true,
        requiresConfirmation: true,
    },
    agent: {
        id: 'agent',
        label: 'Agent',
        description: 'Tam otonom — tool çalıştırır, dosya oluşturur/siler',
        icon: '🤖',
        color: '#a78bfa',
        canEditFiles: true,
        canRunTools: true,
        canCreateFiles: true,
        requiresConfirmation: false,
    },
};

class ChatModeService {
    private _currentMode: ChatMode = 'ask';
    private _listeners: Array<(mode: ChatMode) => void> = [];

    get currentMode(): ChatMode {
        return this._currentMode;
    }

    get currentModeDefinition(): ChatModeDefinition {
        return CHAT_MODES[this._currentMode];
    }

    setMode(mode: ChatMode): void {
        if (this._currentMode === mode) return;
        this._currentMode = mode;
        this._listeners.forEach(l => l(mode));
    }

    onModeChange(listener: (mode: ChatMode) => void): () => void {
        this._listeners.push(listener);
        return () => {
            this._listeners = this._listeners.filter(l => l !== listener);
        };
    }

    /**
     * Sistem prompt'una mod bağlamı ekle
     */
    getModeSystemPromptAddition(): string {
        switch (this._currentMode) {
            case 'ask':
                return `Sen bir kod yardımcısısın. SADECE soru cevapla, herhangi bir dosya değiştirme veya kod üretme yapma. Açıklama ve bilgi ver.`;
            case 'edit':
                return `Sen bir kod düzenleyicisin. Kullanıcı dosyaları değiştirmeni isteyebilir. Değişiklikleri diff formatında göster: "---DOSYA: <yol>---" başlığı ile ve tam dosya içeriği ile.`;
            case 'agent':
                return `Sen tam otonom bir geliştirme ajanısın. Dosya oluşturabilir, düzenleyebilir, silebilir ve terminal komutları çalıştırabilirsin. Adım adım ilerle ve her adımı açıkla.`;
            default:
                return '';
        }
    }

    canPerformAction(action: 'editFile' | 'createFile' | 'runTool'): boolean {
        const def = this.currentModeDefinition;
        switch (action) {
            case 'editFile': return def.canEditFiles;
            case 'createFile': return def.canCreateFiles;
            case 'runTool': return def.canRunTools;
        }
    }
}

export const chatModeService = new ChatModeService();
