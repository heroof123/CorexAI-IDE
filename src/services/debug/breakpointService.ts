import { Breakpoint, debugAdapterBridge } from './debugAdapterBridge';

type BreakpointChangeListener = (breakpoints: Breakpoint[]) => void;

class BreakpointService {
    private breakpoints: Map<string, Breakpoint[]> = new Map(); // file_path -> Breakpoints
    private listeners: Set<BreakpointChangeListener> = new Set();

    subscribe(listener: BreakpointChangeListener) {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    private notifyListeners() {
        const allBreakpoints = Array.from(this.breakpoints.values()).flat();
        this.listeners.forEach(l => l(allBreakpoints));
    }

    async toggleBreakpoint(path: string, line: number, condition?: string) {
        const fileBps = this.breakpoints.get(path) || [];
        const existingIndex = fileBps.findIndex(bp => bp.line === line);

        if (existingIndex >= 0) {
            // Remove
            const id = fileBps[existingIndex].id;
            await debugAdapterBridge.removeBreakpoint(id);
            fileBps.splice(existingIndex, 1);
        } else {
            // Add
            const newBp = await debugAdapterBridge.setBreakpoint(path, line, condition);
            fileBps.push(newBp);
        }

        this.breakpoints.set(path, fileBps);
        this.notifyListeners();
    }

    getBreakpointsForFile(path: string): Breakpoint[] {
        return this.breakpoints.get(path) || [];
    }

    getAllBreakpoints(): Breakpoint[] {
        return Array.from(this.breakpoints.values()).flat();
    }

    async removeAllBreakpoints() {
        const all = this.getAllBreakpoints();
        for (const bp of all) {
            await debugAdapterBridge.removeBreakpoint(bp.id);
        }
        this.breakpoints.clear();
        this.notifyListeners();
    }
}

export const breakpointService = new BreakpointService();
