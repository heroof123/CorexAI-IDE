import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startupGenerator } from '../startupGenerator';
import * as aiProvider from '../ai';

vi.mock('../ai', () => ({
    callAI: vi.fn(),
    getModelIdForRole: vi.fn(() => 'test-model'),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn().mockResolvedValue(true),
}));

describe('StartupGenerator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should be a singleton', () => {
        const instance1 = startupGenerator;
        const instance2 = startupGenerator;
        expect(instance1).toBe(instance2);
    });

    it('should generate a startup architecture and files', async () => {
        // mock plan
        vi.spyOn(aiProvider, 'callAI')
            .mockResolvedValueOnce('```json\n{"name":"test-startup","structure":["package.json"]}\n```')
            .mockResolvedValueOnce('console.log("hello");');

        const progressCb = vi.fn();
        await startupGenerator.generateStartup('A test startup', './test-dir', progressCb);

        expect(aiProvider.callAI).toHaveBeenCalledTimes(2);
        expect(progressCb).toHaveBeenCalled();
    });

    it('should fallback to default structure on invalid JSON', async () => {
        vi.spyOn(aiProvider, 'callAI')
            .mockResolvedValueOnce('Invalid JSON formatting')
            .mockResolvedValue('default code content');

        const progressCb = vi.fn();
        await startupGenerator.generateStartup('A test startup', './test-dir', progressCb);

        // Should use fallback array length 4
        expect(aiProvider.callAI).toHaveBeenCalledTimes(5); // 1 plan + 4 files
    });
});
