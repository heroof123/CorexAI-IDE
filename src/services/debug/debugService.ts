import { DebugSession, DebugState, DebugEvent } from './debugSession';
import { DebugConfig } from './debugAdapterBridge';

class DebugService {
    private currentSession: DebugSession | null = null;
    private listeners: Set<(state: DebugState) => void> = new Set();
    private activeConsoleOutput: string[] = [];

    async startDebugging(config: DebugConfig) {
        if (this.currentSession && this.currentSession.state !== 'inactive') {
            await this.currentSession.stop();
        }

        this.currentSession = new DebugSession();
        this.currentSession.subscribe(this.handleSessionEvent.bind(this));
        await this.currentSession.start(config);
    }

    async stopDebugging() {
        if (this.currentSession) {
            await this.currentSession.stop();
            this.currentSession = null;
        }
    }

    private handleSessionEvent(event: DebugEvent) {
        if (event.type === 'state') {
            this.listeners.forEach(l => l(event.data as DebugState));
        } else if (event.type === 'output' || event.type === 'error') {
            this.activeConsoleOutput.push(event.data as string);
        }
    }

    onStateChange(listener: (state: DebugState) => void) {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    get state(): DebugState {
        return this.currentSession?.state || 'inactive';
    }

    get consoleOutput(): string[] {
        return this.activeConsoleOutput;
    }

    clearConsole() {
        this.activeConsoleOutput = [];
    }

    getSession(): DebugSession | null {
        return this.currentSession;
    }

    async continue() { await this.currentSession?.continue(); }
    async stepOver() { await this.currentSession?.stepOver(); }
    async stepInto() { await this.currentSession?.stepInto(); }
    async stepOut() { await this.currentSession?.stepOut(); }
}

export const debugService = new DebugService();
