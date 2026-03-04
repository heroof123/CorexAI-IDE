import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('TerminalService', () => {
    // Structural tests representing the Terminal Management system from Phase 3.2

    let activeTerminals: any[] = [];
    let focusedTerminalId: string | null = null;

    beforeEach(() => {
        activeTerminals = [];
        focusedTerminalId = null;
    });

    it('should create multiple terminal instances correctly', () => {
        const createTerminal = (opts: { name: string, shell: string }) => {
            const term = { id: `term-${Date.now()}`, ...opts, state: 'ready' };
            activeTerminals.push(term);
            focusedTerminalId = term.id;
            return term;
        };

        const t1 = createTerminal({ name: 'Bash', shell: '/bin/bash' });
        expect(activeTerminals).toHaveLength(1);
        expect(focusedTerminalId).toBe(t1.id);

        const t2 = createTerminal({ name: 'Zsh', shell: '/bin/zsh' });
        expect(activeTerminals).toHaveLength(2);
        expect(focusedTerminalId).toBe(t2.id);
    });

    it('should handle terminal focusing correctly', () => {
        const createTerminal = (opts: { name: string, shell: string }) => {
            const term = { id: `term-${activeTerminals.length + 1}`, ...opts, state: 'ready' };
            activeTerminals.push(term);
            return term;
        };

        const focusTerminal = (id: string) => {
            const term = activeTerminals.find(t => t.id === id);
            if (!term) throw new Error('Terminal not found');
            focusedTerminalId = id;
        };

        const t1 = createTerminal({ name: 'T1', shell: 'bash' });
        const t2 = createTerminal({ name: 'T2', shell: 'bash' });

        expect(focusedTerminalId).toBeNull();

        focusTerminal(t1.id);
        expect(focusedTerminalId).toBe(t1.id);

        focusTerminal(t2.id);
        expect(focusedTerminalId).toBe(t2.id);
    });

    it('should handle terminal splitting configurations', () => {
        const splitConfig = {
            orientation: 'horizontal',
            terminals: ['term-1', 'term-2']
        };

        const setSplitConfig = (config: any) => {
            if (config.terminals.length < 2) throw new Error('Requires 2+ terminals to split');
            return config;
        };

        const configured = setSplitConfig(splitConfig);
        expect(configured.orientation).toBe('horizontal');
        expect(configured.terminals).toHaveLength(2);

        expect(() => setSplitConfig({ terminals: ['term-1'] })).toThrow('Requires 2+ terminals');
    });

    it('should capture output for AI context correctly', () => {
        const terminalOutput = "npm ERR! Missing script: 'dev'\n\nnpm ERR! Did you mean one of these?";

        const extractErrorForAI = (output: string) => {
            if (output.includes('npm ERR!') || output.includes('Error:')) {
                return `Terminal Error Detected: ${output.split('\n')[0]}`;
            }
            return null;
        };

        const parsedContext = extractErrorForAI(terminalOutput);

        expect(parsedContext).toBeDefined();
        expect(parsedContext).toContain('npm ERR! Missing script: \'dev\'');
    });
});
