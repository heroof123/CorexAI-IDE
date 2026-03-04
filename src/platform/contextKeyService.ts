/**
 * ContextKeyService — Menülerin ve Tuş Atamalarının Ne Zaman Etkin Olacağını Belirler
 * Örn: "editorTextFocus", "isMac", "terminalHasSelection" vb.
 */

type ContextKeyValue = string | boolean | number | null;

export class ContextKeyService {
    private static instance: ContextKeyService;
    private contextKeys = new Map<string, ContextKeyValue>();

    private constructor() {
        // Platform varsayılanları
        this.set('isWindows', navigator.userAgent.includes('Windows'));
        this.set('isMac', navigator.userAgent.includes('Mac'));
    }

    public static getInstance(): ContextKeyService {
        if (!ContextKeyService.instance) {
            ContextKeyService.instance = new ContextKeyService();
        }
        return ContextKeyService.instance;
    }

    /**
     * Yeni bir bağlam anahtarı kaydeder veya günceller
     */
    public set(key: string, value: ContextKeyValue) {
        this.contextKeys.set(key, value);
        // TODO: Event fırlatılabilir "contextChanged"
    }

    /**
     * Bağlam anahtarını okur
     */
    public get(key: string): ContextKeyValue | undefined {
        return this.contextKeys.get(key);
    }

    /**
     * Bağlam anahtarını siler
     */
    public remove(key: string) {
        this.contextKeys.delete(key);
    }

    /**
     * VS Code tarzı "when" clause'larını basitleştirilmiş şekilde değerlendirir
     * Örn: "editorTextFocus && !isWindows"
     */
    public evaluate(when?: string): boolean {
        if (!when) return true; // when yoksa her zaman true

        // Basit bir && operatörü ve ! operatörü desteği içeren ayrıştırıcı
        const conditions = when.split('&&').map((c) => c.trim());

        for (const condition of conditions) {
            const isNegated = condition.startsWith('!');
            const key = isNegated ? condition.slice(1) : condition;

            const value = this.get(key);
            const isTruthy = !!value; // boolean çevrimi

            if (isNegated && isTruthy) return false;
            if (!isNegated && !isTruthy) return false;
        }

        return true; // Tüm koşullar geçti
    }
}

export const contextKeyService = ContextKeyService.getInstance();
