export type MarkerSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface MarkerInfo {
    id: string;
    severity: MarkerSeverity;
    message: string;
    source: string; // Örn: 'AILinter', 'TypeScript', 'Eslint'
    file: string;
    line: number;
    column?: number;
}

type MarkerListener = (file: string, markers: MarkerInfo[]) => void;

class MarkersService {
    private static instance: MarkersService;

    // file -> MarkerInfo[]
    private markersMap = new Map<string, MarkerInfo[]>();
    private listeners: MarkerListener[] = [];

    private constructor() { }

    public static getInstance(): MarkersService {
        if (!MarkersService.instance) {
            MarkersService.instance = new MarkersService();
        }
        return MarkersService.instance;
    }

    /**
     * Set markers for a specific file (replaces old markers for that file and source)
     */
    public setMarkers(file: string, source: string, newMarkers: MarkerInfo[]) {
        const existing = this.markersMap.get(file) || [];
        // Eski source'a ait olanları temizle
        const filtered = existing.filter(m => m.source !== source);
        const updated = [...filtered, ...newMarkers];

        this.markersMap.set(file, updated);
        this.notifyListeners(file, updated);
    }

    /**
     * Get all markers for a file
     */
    public getMarkers(file: string): MarkerInfo[] {
        return this.markersMap.get(file) || [];
    }

    /**
     * Get all markers across all files
     */
    public getAllMarkers(): MarkerInfo[] {
        const all: MarkerInfo[] = [];
        for (const markers of this.markersMap.values()) {
            all.push(...markers);
        }
        return all;
    }

    /**
     * Clear all markers for a file
     */
    public clearMarkers(file: string) {
        this.markersMap.delete(file);
        this.notifyListeners(file, []);
    }

    /**
     * Listen for marker changes
     */
    public onDidChangeMarkers(listener: MarkerListener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners(file: string, markers: MarkerInfo[]) {
        this.listeners.forEach(listener => listener(file, markers));
    }
}

export const markersService = MarkersService.getInstance();
