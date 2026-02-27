/**
 * AI Debugging Service
 * Manages debug state and triggers AI analysis for variable states and stack traces.
 */

export interface DebugVariable {
    name: string;
    value: any;
    type: string;
}

export interface DebugFrame {
    file: string;
    line: number;
    function: string;
}

export interface DebugState {
    isPaused: boolean;
    variables: DebugVariable[];
    callStack: DebugFrame[];
    activeFile?: string;
    activeLine?: number;
}

export class AIDebugService {
    private state: DebugState = {
        isPaused: false,
        variables: [],
        callStack: []
    };

    private listeners: ((state: DebugState) => void)[] = [];

    public setState(newState: Partial<DebugState>) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    public getState() {
        return this.state;
    }

    public subscribe(listener: (state: DebugState) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(l => l(this.state));
    }

    // Mock a breakpoint hit for demonstration
    public triggerMockBreakpoint(file: string, line: number) {
        this.setState({
            isPaused: true,
            activeFile: file,
            activeLine: line,
            variables: [
                { name: 'count', value: 42, type: 'number' },
                { name: 'user', value: '{ id: 1, name: "Admin" }', type: 'object' },
                { name: 'isValid', value: false, type: 'boolean' }
            ],
            callStack: [
                { file: file, line: line, function: 'handleCalculate' },
                { file: 'App.tsx', line: 450, function: 'onClick' }
            ]
        });
    }

    public resume() {
        this.setState({ isPaused: false, variables: [], callStack: [] });
    }
}

export const aiDebugService = new AIDebugService();
