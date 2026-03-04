import { invoke } from '@tauri-apps/api/core';

class TestCoverageService {
    private coverageData: string = '';

    async getCoverage(path: string = '.') {
        try {
            this.coverageData = await invoke<string>('get_code_coverage', { path });
            // Bu lcov vs parsed edilip editor'a decoration olarak dönebilir.
            this.notifyCoverageUpdate();
        } catch (error) {
            console.error('Failed to get coverage:', error);
        }
    }

    private subscribers = new Set<(data: string) => void>();

    subscribe(listener: (data: string) => void) {
        this.subscribers.add(listener);
        return () => { this.subscribers.delete(listener); };
    }

    private notifyCoverageUpdate() {
        this.subscribers.forEach(l => l(this.coverageData));
    }
}

export const testCoverageService = new TestCoverageService();
