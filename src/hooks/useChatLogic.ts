import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { GithubAgentTask, githubAgent } from "../services/githubAgent";
import { StoredSession, ChatPanelProps } from "../components/ChatPanel/types";
import { saveSession, loadSessions } from "../components/ChatPanel/chatStorage";

export function useChatLogic(props: ChatPanelProps) {
    const {
        messages, isLoading, onSendMessage, isIndexing, currentFile,
        projectContext, projectPath, isStreaming
    } = props;

    const [input, setInput] = useState("");
    const [githubTask, setGithubTask] = useState<GithubAgentTask | null>(null);
    const [isPendingExpanded, setIsPendingExpanded] = useState(true);
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const [ratings, setRatings] = useState<Record<string, "up" | "down">>({});
    const [showHistory, setShowHistory] = useState(false);
    const [sessions, setSessions] = useState<StoredSession[]>([]);
    const [currentSessionId] = useState(() => Math.random().toString(36).slice(2));
    const [isSingularityMode, setIsSingularityMode] = useState(false);
    const [showMentorDropdown, setShowMentorDropdown] = useState(false);
    const [showAgentDropdown, setShowAgentDropdown] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isUserScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const throttledScrollRef = useRef<number>(0);

    // Close dropdowns on outside click roughly
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (!(e.target as Element).closest(".dropdown-container")) {
                setShowMentorDropdown(false);
                setShowAgentDropdown(false);
            }
        };
        document.addEventListener("click", handleOutsideClick);
        return () => document.removeEventListener("click", handleOutsideClick);
    }, []);

    // Mesajları oturuma kaydet
    useEffect(() => {
        if (messages.length === 0) return;
        const firstUserMsg = messages.find(m => m.role === "user");
        const title = firstUserMsg?.content.slice(0, 40) || "Yeni Sohbet";
        saveSession({ id: currentSessionId, title, createdAt: Date.now(), messages });
    }, [messages, currentSessionId]);

    const checkScrollPosition = () => {
        if (!messagesContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        if (!isAtBottom) {
            isUserScrollingRef.current = true;
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            scrollTimeoutRef.current = setTimeout(() => {
                isUserScrollingRef.current = false;
            }, 2000);
        } else {
            isUserScrollingRef.current = false;
        }
    };

    const scrollToBottom = (force = false) => {
        if (!messagesEndRef.current || !messagesContainerRef.current) return;
        if (isUserScrollingRef.current && !force) return;

        const behavior = isStreaming ? "auto" : "smooth";
        messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
    };

    useEffect(() => {
        if (isStreaming) {
            const now = Date.now();
            if (now - throttledScrollRef.current > 100) {
                scrollToBottom();
                throttledScrollRef.current = now;
            }
        } else {
            const timeout = setTimeout(() => scrollToBottom(), 100);
            return () => clearTimeout(timeout);
        }
    }, [messages, isStreaming]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
        }
    }, [input]);

    const handleSend = async () => {
        if (!input.trim() || isLoading || isIndexing) return;

        if (input.startsWith("/github ") && projectPath) {
            const url = input.replace("/github ", "").trim();
            githubAgent.runIssueToPRWorkflow(url, projectPath, (task) => {
                setGithubTask({ ...task });
            });
            setInput("");
            return;
        }

        if (input.startsWith("/analyze-github") && projectPath) {
            githubAgent.searchAndAnalyzeRequests(projectContext?.name || "Corex AI", projectPath, (task) => {
                setGithubTask({ ...task });
            });
            setInput("");
            return;
        }

        const lowerInput = input.toLowerCase();
        const isGithubQuery = lowerInput.includes("github") &&
            (lowerInput.includes("özellik") || lowerInput.includes("varmı") || lowerInput.includes("var mı") || lowerInput.includes("araştır"));

        if (isGithubQuery && projectPath) {
            githubAgent.searchAndAnalyzeRequests(projectContext?.name || "Corex AI", projectPath, (task) => {
                setGithubTask({ ...task });
            });
        }

        let messageToSend = input;
        let systemContext = "";

        if (currentFile) {
            try {
                const fileContent = await invoke<string>("read_file_content", { path: currentFile });
                systemContext = `\n\n--- AKTİF DOSYA: ${currentFile} ---\n\`\`\`${currentFile.split(".").pop()}\n${fileContent}\n\`\`\`\n`;
            } catch (e) {
                console.error("Aktif dosya okunamadı:", e);
            }
        }

        if (uploadedImages.length > 0) {
            messageToSend = `[IMAGES:${uploadedImages.length}]\n${uploadedImages.map((img, i) => `[IMAGE_${i}]:${img}`).join("\n")}\n\n${input}`;
        }

        if (isSingularityMode && !messageToSend.trim().toLowerCase().startsWith("/singularity")) {
            messageToSend = `/singularity ${messageToSend}`;
        }

        onSendMessage(messageToSend, systemContext);
        setInput("");
        setUploadedImages([]);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = event => setUploadedImages(prev => [...prev, event.target?.result as string]);
            reader.readAsDataURL(file);
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        Array.from(items).forEach(item => {
            if (item.type.indexOf("image") !== -1) {
                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = event => setUploadedImages(prev => [...prev, event.target?.result as string]);
                    reader.readAsDataURL(file);
                }
            }
        });
    };

    const removeImage = (index: number) =>
        setUploadedImages(prev => prev.filter((_, i) => i !== index));

    const handleRate = useCallback((id: string, rating: "up" | "down") => {
        setRatings(prev => ({ ...prev, [id]: prev[id] === rating ? (undefined as any) : rating }));
    }, []);

    const messagesWithRatings = messages.map(m => ({ ...m, rating: ratings[m.id] }));

    const refreshSessions = () => {
        setSessions(loadSessions());
    };

    return {
        input, setInput,
        githubTask, setGithubTask,
        isPendingExpanded, setIsPendingExpanded,
        uploadedImages, setUploadedImages,
        ratings, setRatings,
        showHistory, setShowHistory,
        sessions, setSessions,
        currentSessionId,
        isSingularityMode, setIsSingularityMode,
        showMentorDropdown, setShowMentorDropdown,
        showAgentDropdown, setShowAgentDropdown,
        messagesEndRef,
        messagesContainerRef,
        textareaRef,
        fileInputRef,
        messagesWithRatings,
        handleSend,
        handleImageUpload,
        handlePaste,
        removeImage,
        handleRate,
        checkScrollPosition,
        scrollToBottom,
        refreshSessions
    };
}
