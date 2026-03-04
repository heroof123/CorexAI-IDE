import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface CommitEntry {
    hash: string;
    author: string;
    date: string;
    message: string;
}

interface ScmHistoryViewProps {
    repoPath: string;
    onCommitSelect?: (hash: string) => void;
}

export default function ScmHistoryView({ repoPath, onCommitSelect }: ScmHistoryViewProps) {
    const [commits, setCommits] = useState<CommitEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!repoPath) return;

        const fetchHistory = async () => {
            setLoading(true);
            setError(null);
            try {
                // expecting a command that returns an array of commits
                // Alternatively, we run raw "git log" and parse it here
                const rawLog = await invoke<string>("git_log_file", { repoPath, filePath: "" }).catch(e => {
                    throw new Error(e);
                });

                if (rawLog) {
                    const parsed = parseGitLog(rawLog);
                    setCommits(parsed);
                } else {
                    setCommits([]);
                }
            } catch (err: unknown) {
                console.error("Failed to fetch git log:", err);
                const errorMessage = err instanceof Error ? err.message : String(err) || "Geçmiş yüklenemedi";
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [repoPath]);

    const parseGitLog = (raw: string): CommitEntry[] => {
        // Mock parsing for standard git log output
        const lines = raw.split('\\n');
        const entries: CommitEntry[] = [];
        let current: Partial<CommitEntry> = {};

        for (const line of lines) {
            if (line.startsWith('commit ')) {
                if (current.hash) entries.push(current as CommitEntry);
                current = { hash: line.substring(7).trim() };
            } else if (line.startsWith('Author: ')) {
                current.author = line.substring(8).trim();
            } else if (line.startsWith('Date: ')) {
                current.date = line.substring(6).trim();
            } else if (line.trim() !== '' && current.hash) {
                current.message = (current.message ? current.message + '\\n' : '') + line.trim();
            }
        }

        if (current.hash) entries.push(current as CommitEntry);

        return entries;
    };

    if (loading) return <div className="p-4 text-xs text-gray-400">Yükleniyor...</div>;
    if (error) return <div className="p-4 text-xs text-red-400">{error}</div>;

    return (
        <div className="h-full flex flex-col bg-[var(--color-surface)] w-full text-xs">
            <div className="p-2 bg-[var(--color-background)] border-b border-[#333] font-bold text-gray-300">
                SCM Geçmişi
            </div>
            <div className="flex-1 overflow-y-auto w-full">
                {commits.length === 0 ? (
                    <div className="p-4 text-gray-500 text-center">Commit bulunamadı</div>
                ) : (
                    <div className="flex flex-col">
                        {commits.map(commit => (
                            <div
                                key={commit.hash}
                                className="group p-2 border-b border-[#2a2a2a] hover:bg-[#2a2a2d] cursor-pointer flex flex-col gap-1"
                                onClick={() => onCommitSelect && onCommitSelect(commit.hash)}
                            >
                                <div className="flex justify-between items-start">
                                    <span className="font-semibold text-gray-200 line-clamp-1 break-all flex-1" title={commit.message}>
                                        {commit.message || 'No message'}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-mono ml-2">
                                        {commit.hash.substring(0, 7)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-gray-500">
                                    <span>{commit.author.split(' ')[0]}</span>
                                    <span>{new Date(commit.date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
