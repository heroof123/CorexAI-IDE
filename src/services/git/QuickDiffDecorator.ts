import { invoke } from "@tauri-apps/api/core";

export interface LineDiff {
    originalStart: number;
    originalLength: number;
    modifiedStart: number;
    modifiedLength: number;
    type: 'add' | 'delete' | 'modify';
    content: string; // The diff snippet for a popup widget if needed
}

type DiffListener = (file: string, diffs: LineDiff[]) => void;

class QuickDiffDecoratorService {
    private static instance: QuickDiffDecoratorService;
    private listeners: DiffListener[] = [];
    private fileDiffs = new Map<string, LineDiff[]>();

    private constructor() { }

    public static getInstance() {
        if (!QuickDiffDecoratorService.instance) {
            QuickDiffDecoratorService.instance = new QuickDiffDecoratorService();
        }
        return QuickDiffDecoratorService.instance;
    }

    public async refreshDiff(repoPath: string, filePath: string) {
        try {
            // we will need a git_diff command in tauri backend
            const rawDiff = await invoke<string>("git_diff_file", { repoPath, filePath }).catch(() => null);

            if (rawDiff) {
                // simple diff parser mock
                const diffs = this.parseUnifiedDiff(rawDiff);
                this.fileDiffs.set(filePath, diffs);
                this.notifyListeners(filePath, diffs);
            } else {
                this.fileDiffs.delete(filePath);
                this.notifyListeners(filePath, []);
            }
        } catch (error) {
            console.error("Quick Diff failed:", error);
        }
    }

    public getDiffs(filePath: string): LineDiff[] {
        return this.fileDiffs.get(filePath) || [];
    }

    public onDidChangeDiffs(listener: DiffListener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners(file: string, diffs: LineDiff[]) {
        this.listeners.forEach(l => l(file, diffs));
    }

    private parseUnifiedDiff(rawDiff: string): LineDiff[] {
        // Mock parser for diffs. Real parsing would read "@@ -x,y +a,b @@" and line contents
        const lines = rawDiff.split("\\n");
        const diffs: LineDiff[] = [];
        let currentDiff: Partial<LineDiff> | null = null;

        lines.forEach(line => {
            if (line.startsWith("@@ ")) {
                if (currentDiff) diffs.push(currentDiff as LineDiff);
                // parse @@ -start,length +start,length @@
                const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
                if (match) {
                    currentDiff = {
                        originalStart: parseInt(match[1]),
                        originalLength: match[2] ? parseInt(match[2]) : 1,
                        modifiedStart: parseInt(match[3]),
                        modifiedLength: match[4] ? parseInt(match[4]) : 1,
                        type: 'modify',
                        content: line + "\\n"
                    };
                }
            } else if (currentDiff) {
                currentDiff.content += line + "\\n";
                if (line.startsWith("+") && !line.startsWith("+++")) {
                    currentDiff.type = currentDiff.type === 'delete' ? 'modify' : 'add';
                } else if (line.startsWith("-") && !line.startsWith("---")) {
                    currentDiff.type = currentDiff.type === 'add' ? 'modify' : 'delete';
                }
            }
        });

        if (currentDiff) diffs.push(currentDiff as LineDiff);

        return diffs;
    }
}

export const quickDiffDecorator = QuickDiffDecoratorService.getInstance();
