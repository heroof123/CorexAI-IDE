import { debugAdapterBridge, DebugConfig, Variable } from './debugAdapterBridge';

export type DebugState = 'inactive' | 'initializing' | 'running' | 'paused' | 'terminated';

export interface DebugEvent {
    type: 'state' | 'output' | 'error';
    data?: any;
}

type DebugEventListener = (event: DebugEvent) => void;

export class DebugSession {
    private _id: string | null = null;
    private _state: DebugState = 'inactive';
    private _config: DebugConfig | null = null;
    private listeners: Set<DebugEventListener> = new Set();

    // Geçici paused bilgileri (örn. callstack)
    private _currentFrameId: number | null = null;

    subscribe(listener: DebugEventListener) {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    private emit(event: DebugEvent) {
        this.listeners.forEach(l => l(event));
    }

    private setState(state: DebugState) {
        this._state = state;
        this.emit({ type: 'state', data: state });
    }

    get state() { return this._state; }
    get id() { return this._id; }
    get config() { return this._config; }

    async start(config: DebugConfig) {
        this.setState('initializing');
        this._config = config;
        try {
            this._id = await debugAdapterBridge.startSession(config);
            this.setState('running');
            this.emit({ type: 'output', data: `Session started: ${config.name}\n` });

            // Gerçek bir DAP bağlantısı kurulduğunda, Rust üzerinden WebSocket / Event Listener
            // üzerinden state güncellenir. Ancak şimdilik buradaki mockları kullanacağız.
        } catch (err: any) {
            this.setState('inactive');
            this.emit({ type: 'error', data: `Failed to start: ${err}\n` });
        }
    }

    async stop() {
        if (!this._id) return;
        this.setState('terminated');
        this.emit({ type: 'output', data: 'Session stopped.\n' });
        this._id = null;
        this._state = 'inactive';
        this._currentFrameId = null;
    }

    async continue() {
        if (!this._id || this._state !== 'paused') return;
        await debugAdapterBridge.continue(this._id);
        this.setState('running');
    }

    async stepOver() {
        if (!this._id || this._state !== 'paused') return;
        await debugAdapterBridge.stepOver(this._id);
        this.setState('running');
    }

    async stepInto() {
        if (!this._id || this._state !== 'paused') return;
        await debugAdapterBridge.stepInto(this._id);
        this.setState('running');
    }

    async stepOut() {
        if (!this._id || this._state !== 'paused') return;
        await debugAdapterBridge.stepOut(this._id);
        this.setState('running');
    }

    async getVariables(): Promise<Variable[]> {
        if (!this._id || this._currentFrameId === null) return [];
        return await debugAdapterBridge.getVariables(this._id, this._currentFrameId);
    }

    async evaluate(expression: string): Promise<string> {
        if (!this._id) return '';
        return await debugAdapterBridge.evaluateExpression(this._id, expression);
    }

    // Mock for handling incoming pause events from Rust backend
    public handlePauseEvent(frameId: number) {
        this._currentFrameId = frameId;
        this.setState('paused');
    }
}
