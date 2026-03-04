/**
 * Chat Editing Types
 * VS Code coreAi-main/src/vs/workbench/contrib/chat/browser/chatEditing/ referans alınarak yazıldı
 */

export type EditSessionState = 'idle' | 'pending' | 'active' | 'completed' | 'rejected';

export type ChatMode = 'ask' | 'edit' | 'agent';

export interface FileCheckpoint {
    id: string;
    filePath: string;
    contentBefore: string;
    contentAfter: string;
    timestamp: number;
    description: string;
}

export interface EditHunk {
    id: string;
    filePath: string;
    startLine: number;
    endLine: number;
    oldContent: string;
    newContent: string;
    accepted: boolean | null; // null = pending
}

export interface ChatEditingEntry {
    filePath: string;
    originalContent: string;
    modifiedContent: string;
    hunks: EditHunk[];
    state: 'pending' | 'accepted' | 'rejected' | 'partial';
}

export interface ChatEditingSession {
    id: string;
    chatRequestId: string;    // Hangi chat mesajından oluştuğu
    entries: Map<string, ChatEditingEntry>; // filePath → entry
    checkpoints: FileCheckpoint[];
    state: EditSessionState;
    createdAt: number;
    description: string;
}

export interface InlineChatSession {
    id: string;
    editorUri: string;
    startLine: number;
    endLine: number;
    originalText: string;
    state: 'open' | 'applied' | 'discarded';
}
