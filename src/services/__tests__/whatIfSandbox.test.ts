import { describe, it, expect, vi } from 'vitest';
import { WhatIfSandboxService } from '../whatIfSandbox';
import * as aiProvider from '../ai';

vi.mock('../ai', () => ({
    callAI: vi.fn(),
    getModelIdForRole: vi.fn(() => 'test-model'),
}));

describe('WhatIfSandboxService', () => {
    it('should simulate scenario successfully', async () => {
        vi.spyOn(aiProvider, 'callAI').mockResolvedValue('Simulated Universe Config');

        const result = await WhatIfSandboxService.simulateScenario('Use React instead of Vue', []);

        expect(result).toContain('What-If Sandbox');
        expect(result).toContain('Simulated Universe Config');
        expect(aiProvider.callAI).toHaveBeenCalled();
    });

    it('should handle AI errors gracefully', async () => {
        vi.spyOn(aiProvider, 'callAI').mockRejectedValue(new Error('Quantum computation failed'));

        const result = await WhatIfSandboxService.simulateScenario('Use Rust', []);

        expect(result).toContain('What-If Sandbox Çöktü');
        expect(result).toContain('Quantum computation failed');
    });
});
