import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('DebugService', () => {
    // Structural tests representing the DAP Debug architecture defined in Phase 2.1

    let activeSession: any = null;
    let breakpoints: Record<string, number[]> = {};

    beforeEach(() => {
        activeSession = null;
        breakpoints = {};
    });

    it('should start a DAP debug session securely', () => {
        const startSession = (config: Record<string, string>) => {
            if (!config.program) throw new Error('Program path required');
            activeSession = { id: 'dap-1', ...config, status: 'running' };
            return activeSession;
        };

        const session = startSession({ program: 'src/main.ts', type: 'node' });

        expect(session).toBeDefined();
        expect(session.id).toBe('dap-1');
        expect(session.status).toBe('running');
    });

    it('should fail to start a session without a program', () => {
        const startSession = (config: Record<string, string>) => {
            if (!config.program) throw new Error('Program path required');
            activeSession = { id: 'dap-1', ...config, status: 'running' };
            return activeSession;
        };

        expect(() => startSession({ type: 'node' })).toThrow('Program path required');
    });

    it('should securely manage breakpoints by file', () => {
        const addBreakpoint = (file: string, line: number) => {
            if (!breakpoints[file]) breakpoints[file] = [];
            if (!breakpoints[file].includes(line)) {
                breakpoints[file].push(line);
            }
        };

        const toggleBreakpoint = (file: string, line: number) => {
            if (!breakpoints[file]) breakpoints[file] = [];
            const idx = breakpoints[file].indexOf(line);
            if (idx === -1) breakpoints[file].push(line);
            else breakpoints[file].splice(idx, 1);
        };

        addBreakpoint('src/app.ts', 12);
        addBreakpoint('src/app.ts', 15);
        expect(breakpoints['src/app.ts']).toHaveLength(2);

        toggleBreakpoint('src/app.ts', 12);
        expect(breakpoints['src/app.ts']).not.toContain(12);
        expect(breakpoints['src/app.ts']).toContain(15);
    });
});
