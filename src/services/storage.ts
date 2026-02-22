import { Store } from '@tauri-apps/plugin-store';

let uiStore: Store | null = null;
let secureStore: Store | null = null;
let settingsStore: Store | null = null;

async function getStores() {
    if (!uiStore) uiStore = await Store.load('.ui-state.dat');
    if (!secureStore) secureStore = await Store.load('.secure.dat');
    if (!settingsStore) settingsStore = await Store.load('.settings.dat');
    return { uiStore, secureStore, settingsStore };
}

export const storage = {
    // UI state (localStorage yerine)
    async getUI<T>(key: string): Promise<T | null> {
        const { uiStore } = await getStores();
        const val = await uiStore.get<T>(key);
        return val ?? null;
    },
    async setUI<T>(key: string, value: T): Promise<void> {
        const { uiStore } = await getStores();
        await uiStore.set(key, value);
        await uiStore.save();
    },
    async removeUI(key: string): Promise<void> {
        const { uiStore } = await getStores();
        await uiStore.delete(key);
        await uiStore.save();
    },

    // Ayarlar (AI provider config, model config vs.)
    async getSettings<T>(key: string): Promise<T | null> {
        const { settingsStore } = await getStores();
        const val = await settingsStore.get<T>(key);
        return val ?? null;
    },
    async setSettings<T>(key: string, value: T): Promise<void> {
        const { settingsStore } = await getStores();
        await settingsStore.set(key, value);
        await settingsStore.save();
    },

    // Güvenli (token, api key)
    async getSecure<T>(key: string): Promise<T | null> {
        const { secureStore } = await getStores();
        const val = await secureStore.get<T>(key);
        return val ?? null;
    },
    async setSecure<T>(key: string, value: T): Promise<void> {
        const { secureStore } = await getStores();
        await secureStore.set(key, value);
        await secureStore.save();
    },
};


// Migrasyon: Mevcut localStorage verisini taşı
export async function migrateFromLocalStorage(): Promise<void> {
    const keys = [
        'corex-ai-providers', 'gguf-models', 'gguf-active-model',
        'gguf-download-folder', 'corex-dismissed-insights',
        'gguf-performance-logs', 'gguf-conversation-history',
        'gpu-info-cache', 'ai-output-mode', 'user_profiles'
    ];
    for (const key of keys) {
        const val = localStorage.getItem(key);
        if (val) {
            try {
                const parsed = JSON.parse(val);
                if (key === 'user_profiles') {
                    await storage.setSecure(key, parsed);
                } else {
                    await storage.setSettings(key, parsed);
                }
                localStorage.removeItem(key);
            } catch {
                await storage.setUI(key, val);
                localStorage.removeItem(key);
            }
        }
    }
    console.log('✅ localStorage → Tauri Store migration tamamlandı');
}
