import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';

interface GitAutopilotProps {
    projectPath: string;
    onCommitSuccess?: (message: string) => void;
}

const GitAutopilot: React.FC<GitAutopilotProps> = ({ projectPath, onCommitSuccess }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [suggestion, setSuggestion] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const generateCommitMessage = async () => {
        setIsGenerating(true);
        setStatus('loading');
        setErrorMsg('');

        try {
            // 1. Get diff from backend
            const diff = await invoke<string>('generate_semantic_commit_message', { repoPath: projectPath });

            if (!diff || diff.trim() === '') {
                throw new Error("Staged changes not found. Please stage your changes first.");
            }

            // 2. Call AI to generate message from diff
            const providerConfig = JSON.parse(localStorage.getItem('ai_provider_config') || '{}');
            const prompt = `Generate a concise, semantic commit message (Conventional Commits style) for the following diff:\n\n${diff.slice(0, 5000)}`;

            const message = await invoke<string>("chat_with_dynamic_ai", {
                message: prompt,
                conversationHistory: [
                    { role: "system", content: "You are a senior developer who writes perfect commit messages." }
                ],
                provider_config: providerConfig
            });

            setSuggestion(message.trim());
            setStatus('success');
        } catch (err: any) {
            console.error("Git Autopilot Error:", err);
            setStatus('error');
            setErrorMsg(err.toString());
        } finally {
            setIsGenerating(false);
        }
    };

    const handleApplyCommit = async () => {
        if (!suggestion) return;
        setStatus('loading');
        try {
            await invoke('git_smart_commit', { repoPath: projectPath, message: suggestion });
            onCommitSuccess?.(suggestion);
            setSuggestion('');
            setStatus('idle');
            alert("✅ Semantic commit successfully created!");
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.toString());
        }
    };

    return (
        <div className="bg-[#1e1e1e] border border-neutral-800 rounded-xl overflow-hidden flex flex-col shadow-xl">
            <div className="p-4 border-b border-neutral-800 bg-gradient-to-r from-blue-600/10 to-purple-600/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xl">🤖</span>
                    <div>
                        <h3 className="text-sm font-bold text-white">Git Autopilot</h3>
                        <p className="text-[10px] text-neutral-500 font-medium">AI-POWERED VERSION CONTROL</p>
                    </div>
                </div>
                {status === 'loading' && (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                )}
            </div>

            <div className="p-4 space-y-4">
                {status === 'error' && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                        {errorMsg}
                    </div>
                )}

                <div className="space-y-2">
                    <button
                        onClick={generateCommitMessage}
                        disabled={isGenerating}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <span>📝</span>
                        Semantic Mesaj Oluştur
                    </button>
                </div>

                <AnimatePresence>
                    {suggestion && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-3"
                        >
                            <div className="relative">
                                <textarea
                                    value={suggestion}
                                    onChange={(e) => setSuggestion(e.target.value)}
                                    className="w-full h-24 bg-black/30 border border-neutral-700 rounded-lg p-3 text-xs text-blue-100 font-mono focus:border-blue-500 outline-none transition-all"
                                    placeholder="AI commit mesajı burada görünecek..."
                                />
                                <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded border border-blue-500/30 font-bold uppercase">AI Suggestions</div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleApplyCommit}
                                    className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
                                >
                                    Onayla ve Commit Et
                                </button>
                                <button
                                    onClick={() => setSuggestion('')}
                                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                                >
                                    Yoksay
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="pt-2 border-t border-neutral-800/50 flex items-center justify-center gap-6">
                    <div className="flex flex-col items-center gap-1 opacity-50 hover:opacity-100 cursor-pointer transition-opacity">
                        <span className="text-lg">🌿</span>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Smart Branch</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 opacity-50 hover:opacity-100 cursor-pointer transition-opacity">
                        <span className="text-lg">🚀</span>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">Auto PR</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GitAutopilot;
