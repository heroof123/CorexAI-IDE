import { invoke } from "@tauri-apps/api/core";

export interface GitStatusEntry {
    path: string;
    status: 'modified' | 'added' | 'deleted' | 'untracked';
}

type SCMListener = (status: GitStatusEntry[]) => void;

class ScmWorkingSet {
    private static instance: ScmWorkingSet;
    private listeners: SCMListener[] = [];
    private currentStatus: GitStatusEntry[] = [];
    private repoPath: string = "";

    private constructor() { }

    public static getInstance() {
        if (!ScmWorkingSet.instance) {
            ScmWorkingSet.instance = new ScmWorkingSet();
        }
        return ScmWorkingSet.instance;
    }

    public setRepoPath(path: string) {
        this.repoPath = path;
    }

    public async refreshStatus() {
        if (!this.repoPath) return;

        try {
            // "git_status" might return a json or string, depending on backend implementation
            const rawStatus = await invoke<{ path?: string, file_path?: string, status: string }[] | unknown>("git_status", { repoPath: this.repoPath });
            if (rawStatus && Array.isArray(rawStatus)) {
                this.currentStatus = rawStatus.map((item) => ({
                    path: item.path || item.file_path || "",
                    status: item.status as GitStatusEntry['status']
                }));
            }
            this.notifyListeners();
        } catch (error) {
            console.error("SCM Refresh Error:", error);
            // Defaulting to empty or simulated status if backend errs
        }
    }

    public getStatus(): GitStatusEntry[] {
        return this.currentStatus;
    }

    public onDidChangeStatus(listener: SCMListener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(l => l(this.currentStatus));
    }
}

export const scmWorkingSet = ScmWorkingSet.getInstance();
