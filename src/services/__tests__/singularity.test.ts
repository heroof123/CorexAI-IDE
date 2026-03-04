import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SingularityService } from '../singularity';
import * as aiProvider from '../ai';

vi.mock('../ai', () => ({
    callAI: vi.fn(),
    getModelIdForRole: vi.fn(() => 'architect'),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn().mockImplementation((cmd) => {
        if (cmd === 'read_file_content') return 'content';
        return true;
    }),
}));

describe('SingularityService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should complete autonomous self-modification loop', async () => {
        vi.spyOn(aiProvider, 'callAI')
            .mockResolvedValueOnce('```json\n{"thought": "I need to fix this", "action": "read", "target": "src/main.ts"}\n```')
            .mockResolvedValueOnce('```json\n{"thought": "Done", "action": "done", "target": "success"}\n```');

        const result = await SingularityService.selfModify('Fix issue', [], '/test/project');

        expect(result).toContain('Evrimi Tamamlandı');
        expect(aiProvider.callAI).toHaveBeenCalledTimes(2);
    });

    it('should handle unparseable action gracefully', async () => {
        vi.spyOn(aiProvider, 'callAI')
            .mockResolvedValue('Unparseable json data without tags');

        await SingularityService.selfModify('Break me', [], '/test/project');

        // It should attempt up to MAX_ITERATIONS (5) then complete
        expect(aiProvider.callAI).toHaveBeenCalled();
    });

    it('should handle unknown actions', async () => {
        vi.spyOn(aiProvider, 'callAI')
            .mockResolvedValueOnce('```json\n{"action": "destroy_world", "target": "earth"}\n```');

        const result = await SingularityService.selfModify('Destroy', [], '/');

        expect(aiProvider.callAI).toHaveBeenCalled();
        expect(result).toContain('Evrimi');
    });
});
