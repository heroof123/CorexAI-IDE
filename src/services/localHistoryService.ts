import { invoke } from '@tauri-apps/api/core';

export interface HistoryEntry {
    id: string;
    timestamp: number;
    path: string;
    content: string;
}

class LocalHistoryService {
    private static instance: LocalHistoryService;

    private constructor() { }

    public static getInstance(): LocalHistoryService {
        if (!LocalHistoryService.instance) {
            LocalHistoryService.instance = new LocalHistoryService();
        }
        return LocalHistoryService.instance;
    }

    /**
     * Modül 4.3: Dosya değişikliklerini Snapshot olarak kaydeder
     */
    public async saveSnapshot(path: string, content: string): Promise<string> {
        try {
            const id = await invoke<string>('save_local_history', {
                path,
                content
            });
            return id;
        } catch (err) {
            console.error('Local history kaydı başarısız:', err);
            throw err;
        }
    }

    /**
     * İlgili dosyanın geçmiş listesini döner
     */
    public async getHistory(path: string): Promise<HistoryEntry[]> {
        try {
            return await invoke<HistoryEntry[]>('get_local_history', { path });
        } catch (err) {
            console.error('Local history getirilemedi:', err);
            return [];
        }
    }

    /**
     * Dosyayı belirli bir tarihteki anına çevir (Snapshot Dönüşü)
     */
    public async restoreSnapshot(path: string, entryId: string): Promise<string> {
        try {
            return await invoke<string>('restore_local_history', {
                path,
                entryId
            });
        } catch (err) {
            console.error('Snapshot restore başarısız:', err);
            throw err;
        }
    }
}

export const localHistoryService = LocalHistoryService.getInstance();
