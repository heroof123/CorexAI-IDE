import { invoke } from '@tauri-apps/api/core';

export interface DebugConfig {
    name: string;
    request: 'launch' | 'attach';
    type: string;
    [key: string]: any;
}

export interface Breakpoint {
    id: string;
    path: string;
    line: number;
    condition?: string;
    verified: boolean;
}

export interface Variable {
    name: string;
    value: string;
    type: string;
    variablesReference: number;
}

export const debugAdapterBridge = {
    async startSession(config: DebugConfig): Promise<string> {
        return await invoke<string>('start_debug_session', {
            config: {
                ...config,
                type_: config.type
            }
        });
    },

    async setBreakpoint(path: string, line: number, condition?: string): Promise<Breakpoint> {
        return await invoke<Breakpoint>('set_breakpoint', { path, line, condition });
    },

    async removeBreakpoint(id: string): Promise<void> {
        return await invoke<void>('remove_breakpoint', { id });
    },

    async continue(sessionId: string): Promise<void> {
        return await invoke<void>('debug_continue', { sessionId });
    },

    async stepOver(sessionId: string): Promise<void> {
        return await invoke<void>('debug_step_over', { sessionId });
    },

    async stepInto(sessionId: string): Promise<void> {
        return await invoke<void>('debug_step_into', { sessionId });
    },

    async stepOut(sessionId: string): Promise<void> {
        return await invoke<void>('debug_step_out', { sessionId });
    },

    async getVariables(sessionId: string, frameId: number): Promise<Variable[]> {
        return await invoke<Variable[]>('get_variables', { sessionId, frameId });
    },

    async evaluateExpression(sessionId: string, expression: string): Promise<string> {
        return await invoke<string>('evaluate_expression', { sessionId, expression });
    }
};
