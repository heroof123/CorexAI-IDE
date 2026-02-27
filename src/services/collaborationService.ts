import { invoke } from '@tauri-apps/api/core';

export interface CursorPosition {
    line: number;
    column: number;
    file: string;
    timestamp: number;
}

export interface UserPresence {
    id: string;
    name: string;
    color: string;
    cursor?: CursorPosition;
    lastSeen: number;
    isActive: boolean;
}

export type CollabMessage =
    | { type: 'user_join', payload: { user: UserPresence } }
    | { type: 'user_leave', payload: { userId: string } }
    | { type: 'cursor_move', payload: { userId: string, cursor: CursorPosition } }
    | { type: 'edit', payload: { userId: string, file: string, content: string, version: number } }
    | { type: 'users', payload: { users: UserPresence[] } }
    | { type: 'error', payload: { code: string, message: string } };

class CollaborationService {
    private ws: WebSocket | null = null;
    private sessionId: string | null = null;
    private users: Map<string, UserPresence> = new Map();
    private listeners: Set<(users: UserPresence[]) => void> = new Set();
    private statusListeners: Set<(connected: boolean) => void> = new Set();
    private editListeners: Set<(file: string, content: string) => void> = new Set();
    private currentUserId: string = `user_${Math.random().toString(36).substr(2, 9)}`;
    private currentUserName: string = 'Anonymous User';

    constructor() {
        this.currentUserName = localStorage.getItem('corex-user-name') || 'Guest Developer';
    }

    public onUsersUpdate(callback: (users: UserPresence[]) => void) {
        this.listeners.add(callback);
        return () => { this.listeners.delete(callback); };
    }

    public onStatusChange(callback: (connected: boolean) => void) {
        this.statusListeners.add(callback);
        return () => { this.statusListeners.delete(callback); };
    }

    public onRemoteEdit(callback: (file: string, content: string) => void) {
        this.editListeners.add(callback);
        return () => { this.editListeners.delete(callback); };
    }

    private notifyUsers() {
        const userList = Array.from(this.users.values());
        this.listeners.forEach(l => l(userList));
    }

    private notifyStatus(connected: boolean) {
        this.statusListeners.forEach(l => l(connected));
    }

    public async createSession(): Promise<string> {
        return await invoke('create_collab_session');
    }

    public async connect(id: string, port: number = 9001) {
        if (this.ws) this.ws.close();

        // Ensure server is started (Tauri command)
        await invoke('start_collab_server', { port });

        this.sessionId = id;
        this.ws = new WebSocket(`ws://127.0.0.1:${port}`);

        this.ws.onopen = () => {
            console.log('🌐 Connected to collaboration server');
            this.notifyStatus(true);

            // Handshake
            this.ws?.send(`join_session ${id}`);

            // Send join message
            this.sendMessage({
                type: 'user_join',
                payload: {
                    user: {
                        id: this.currentUserId,
                        name: this.currentUserName,
                        color: this.getRandomColor(),
                        lastSeen: Date.now(),
                        isActive: true
                    }
                }
            });
        };

        this.ws.onmessage = (event) => {
            try {
                const msg: CollabMessage = JSON.parse(event.data);
                this.handleMessage(msg);
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('🔴 Disconnected from collaboration server');
            this.notifyStatus(false);
            this.users.clear();
            this.notifyUsers();
        };
    }

    private handleMessage(msg: CollabMessage) {
        switch (msg.type) {
            case 'user_join':
                this.users.set(msg.payload.user.id, msg.payload.user);
                break;
            case 'user_leave':
                this.users.delete(msg.payload.userId);
                break;
            case 'cursor_move':
                const user = this.users.get(msg.payload.userId);
                if (user) {
                    user.cursor = msg.payload.cursor;
                }
                break;
            case 'edit':
                // Notify logic that file content changed (simple implementation)
                this.editListeners.forEach(l => l(msg.payload.file, msg.payload.content));
                break;
            case 'users':
                msg.payload.users.forEach(u => this.users.set(u.id, u));
                break;
        }
        this.notifyUsers();
    }

    public updateCursor(line: number, column: number, file: string) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendMessage({
                type: 'cursor_move',
                payload: {
                    userId: this.currentUserId,
                    cursor: {
                        line,
                        column,
                        file,
                        timestamp: Date.now()
                    }
                }
            });
        }
    }

    public broadcastEdit(file: string, content: string) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendMessage({
                type: 'edit',
                payload: {
                    userId: this.currentUserId,
                    file,
                    content,
                    version: Date.now()
                }
            });
        }
    }

    private sendMessage(msg: CollabMessage) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    private getRandomColor() {
        const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2"];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    public disconnect() {
        this.ws?.close();
        this.ws = null;
    }

    public getSessionId() {
        return this.sessionId;
    }
}

export const collabService = new CollaborationService();
