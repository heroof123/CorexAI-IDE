import { Message, CodeAction } from "../../types/index";

export interface ChatPanelProps {
    messages: Message[];
    isLoading: boolean;
    onSendMessage: (message: string, context?: string) => void;
    pendingActions: CodeAction[];
    onAcceptAction: (actionId: string) => void;
    onRejectAction: (actionId: string) => void;
    onAcceptAllActions?: () => void;
    onNewSession?: () => void;
    isIndexing: boolean;
    currentFile?: string;
    projectContext?: {
        name: string;
        type: string;
        mainLanguages: string[];
    };
    onStopGeneration?: () => void;
    onRegenerateResponse?: () => void;
    isStreaming?: boolean;
    modelName?: string;
    isMentorMode?: boolean;
    onMentorModeToggle?: (enabled: boolean) => void;
    projectPath?: string;
}

export interface StoredSession {
    id: string;
    title: string;
    createdAt: number;
    messages: Message[];
}
