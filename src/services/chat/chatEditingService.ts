/**
 * Chat Editing Service
 * VS Code coreAi-main/src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingServiceImpl.ts referans alınarak
 *
 * Görevleri:
 * - Çoklu dosya edit sessionlarını yönetir
 * - Her AI yanıtından hunk'ları parse eder
 * - Checkpoint kayıt ve geri yükleme
 * - Per-hunk accept/reject
 */

import { invoke } from '@tauri-apps/api/core';
import {
    ChatEditingSession,
    ChatEditingEntry,
    EditHunk,
    FileCheckpoint,
} from './chatEditingTypes';

// ────────────────────────────────────────────────────────────
// Diff Parser — AI yanıtından hunk'ları çıkar
// ────────────────────────────────────────────────────────────

interface ParsedFileEdit {
    filePath: string;
    newContent: string;
}

/**
 * AI yanıtındaki kod bloklarını parse et.
 * Desteklenen format:
 *   ---DOSYA: src/foo.ts---
 *   ```typescript
 *   ... tam dosya içeriği ...
 *   ```
 */
export function parseFileEditsFromAIResponse(response: string): ParsedFileEdit[] {
    const edits: ParsedFileEdit[] = [];

    // ---DOSYA: <yol>--- formatı
    const fileSectionRegex = /---DOSYA:\s*(.+?)---\s*```[\w]*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = fileSectionRegex.exec(response)) !== null) {
        edits.push({
            filePath: match[1].trim(),
            newContent: match[2],
        });
    }

    // Fallback: tek kod bloğu ve currentFile varsa
    if (edits.length === 0) {
        const singleBlock = /```[\w]*\n([\s\S]*?)```/.exec(response);
        if (singleBlock) {
            return [{ filePath: '__current__', newContent: singleBlock[1] }];
        }
    }

    return edits;
}

/**
 * İki içerik arasındaki satır bazlı diff'i hesaplar
 */
function computeHunks(filePath: string, oldContent: string, newContent: string): EditHunk[] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const hunks: EditHunk[] = [];

    // Basit satır karşılaştırma (gerçek diff algoritması için myers-diff kullanılabilir)
    let hunkId = 0;
    let i = 0;
    while (i < Math.max(oldLines.length, newLines.length)) {
        if (oldLines[i] !== newLines[i]) {
            // Değişen bölgeyi bul
            const hunkStart = i;
            while (i < Math.max(oldLines.length, newLines.length) && oldLines[i] !== newLines[i]) {
                i++;
            }
            hunks.push({
                id: `${filePath}-hunk-${hunkId++}`,
                filePath,
                startLine: hunkStart + 1,
                endLine: i,
                oldContent: oldLines.slice(hunkStart, i).join('\n'),
                newContent: newLines.slice(hunkStart, i).join('\n'),
                accepted: null,
            });
        } else {
            i++;
        }
    }

    return hunks;
}

// ────────────────────────────────────────────────────────────
// Chat Editing Service
// ────────────────────────────────────────────────────────────

class ChatEditingService {
    private _sessions: Map<string, ChatEditingSession> = new Map();
    private _activeSessionId: string | null = null;
    private _listeners: Array<(session: ChatEditingSession | null) => void> = [];

    // ── Session yönetimi ──────────────────────────────────────

    createSession(chatRequestId: string, description: string): ChatEditingSession {
        const session: ChatEditingSession = {
            id: `edit-session-${Date.now()}`,
            chatRequestId,
            entries: new Map(),
            checkpoints: [],
            state: 'pending',
            createdAt: Date.now(),
            description,
        };
        this._sessions.set(session.id, session);
        this._activeSessionId = session.id;
        this._notify(session);
        return session;
    }

    getActiveSession(): ChatEditingSession | null {
        if (!this._activeSessionId) return null;
        return this._sessions.get(this._activeSessionId) ?? null;
    }

    getSession(id: string): ChatEditingSession | null {
        return this._sessions.get(id) ?? null;
    }

    // ── AI yanıtından edit işle ───────────────────────────────

    async applyAIResponse(
        sessionId: string,
        aiResponse: string,
        currentFileContents: Map<string, string>  // filePath → content
    ): Promise<void> {
        const session = this._sessions.get(sessionId);
        if (!session) return;

        session.state = 'active';

        const parsedEdits = parseFileEditsFromAIResponse(aiResponse);

        for (const edit of parsedEdits) {
            const filePath = edit.filePath === '__current__'
                ? (currentFileContents.keys().next().value ?? 'untitled')
                : edit.filePath;

            const oldContent = currentFileContents.get(filePath) ?? '';

            // Checkpoint kaydet (geri alınabilir)
            await this._saveCheckpoint(session, filePath, oldContent, edit.newContent);

            // Hunk'ları hesapla
            const hunks = computeHunks(filePath, oldContent, edit.newContent);

            const entry: ChatEditingEntry = {
                filePath,
                originalContent: oldContent,
                modifiedContent: edit.newContent,
                hunks,
                state: 'pending',
            };

            session.entries.set(filePath, entry);
        }

        this._notify(session);
    }

    // ── Per-hunk accept/reject ────────────────────────────────

    acceptHunk(sessionId: string, filePath: string, hunkId: string): void {
        const session = this._sessions.get(sessionId);
        if (!session) return;

        const entry = session.entries.get(filePath);
        if (!entry) return;

        const hunk = entry.hunks.find(h => h.id === hunkId);
        if (hunk) {
            hunk.accepted = true;
            this._updateEntryState(entry);
            this._notify(session);
        }
    }

    rejectHunk(sessionId: string, filePath: string, hunkId: string): void {
        const session = this._sessions.get(sessionId);
        if (!session) return;

        const entry = session.entries.get(filePath);
        if (!entry) return;

        const hunk = entry.hunks.find(h => h.id === hunkId);
        if (hunk) {
            hunk.accepted = false;
            this._updateEntryState(entry);
            this._notify(session);
        }
    }

    acceptAllInFile(sessionId: string, filePath: string): void {
        const session = this._sessions.get(sessionId);
        const entry = session?.entries.get(filePath);
        if (!entry) return;

        entry.hunks.forEach(h => { h.accepted = true; });
        entry.state = 'accepted';
        this._notify(session!);
    }

    rejectAllInFile(sessionId: string, filePath: string): void {
        const session = this._sessions.get(sessionId);
        const entry = session?.entries.get(filePath);
        if (!entry) return;

        entry.hunks.forEach(h => { h.accepted = false; });
        entry.state = 'rejected';
        this._notify(session!);
    }

    acceptAll(sessionId: string): void {
        const session = this._sessions.get(sessionId);
        if (!session) return;

        session.entries.forEach((_, filePath) => {
            this.acceptAllInFile(sessionId, filePath);
        });
        session.state = 'completed';
        this._notify(session);
    }

    rejectAll(sessionId: string): void {
        const session = this._sessions.get(sessionId);
        if (!session) return;

        session.entries.forEach((_, filePath) => {
            this.rejectAllInFile(sessionId, filePath);
        });
        session.state = 'rejected';
        this._notify(session);
    }

    /**
     * Kabul edilen hunk'ları birleştirerek final içeriği oluştur
     */
    computeFinalContent(entry: ChatEditingEntry): string {
        const acceptedHunkIds = new Set(
            entry.hunks.filter(h => h.accepted === true).map(h => h.id)
        );

        if (acceptedHunkIds.size === 0) return entry.originalContent;
        if (acceptedHunkIds.size === entry.hunks.length) return entry.modifiedContent;

        // Kısmi kabul: sadece kabul edilen hunk'ları uygula
        const lines = entry.originalContent.split('\n');
        for (const hunk of entry.hunks) {
            if (hunk.accepted !== true) continue;
            const newHunkLines = hunk.newContent.split('\n');
            lines.splice(hunk.startLine - 1, hunk.endLine - hunk.startLine + 1, ...newHunkLines);
        }
        return lines.join('\n');
    }

    // ── Checkpoint sistemi ────────────────────────────────────

    private async _saveCheckpoint(
        session: ChatEditingSession,
        filePath: string,
        contentBefore: string,
        contentAfter: string
    ): Promise<void> {
        const checkpoint: FileCheckpoint = {
            id: `ckpt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            filePath,
            contentBefore,
            contentAfter,
            timestamp: Date.now(),
            description: session.description,
        };
        session.checkpoints.push(checkpoint);

        // Tauri backend'e kaydet (opsiyonel — dosya sistemi kalıcılığı için)
        try {
            await invoke('save_checkpoint', {
                id: checkpoint.id,
                filePath,
                content: contentBefore,
                timestamp: checkpoint.timestamp,
            });
        } catch {
            // Backend komutu yoksa sessizce devam et
        }
    }

    async restoreCheckpoint(sessionId: string, checkpointId: string): Promise<string | null> {
        const session = this._sessions.get(sessionId);
        if (!session) return null;

        const checkpoint = session.checkpoints.find(c => c.id === checkpointId);
        if (!checkpoint) return null;

        return checkpoint.contentBefore;
    }

    // ── Event sistemi ─────────────────────────────────────────

    onSessionChange(listener: (session: ChatEditingSession | null) => void): () => void {
        this._listeners.push(listener);
        return () => {
            this._listeners = this._listeners.filter(l => l !== listener);
        };
    }

    private _notify(session: ChatEditingSession): void {
        this._listeners.forEach(l => l(session));
    }

    private _updateEntryState(entry: ChatEditingEntry): void {
        const all = entry.hunks;
        if (all.every(h => h.accepted === true)) {
            entry.state = 'accepted';
        } else if (all.every(h => h.accepted === false)) {
            entry.state = 'rejected';
        } else if (all.some(h => h.accepted !== null)) {
            entry.state = 'partial';
        } else {
            entry.state = 'pending';
        }
    }
}

export const chatEditingService = new ChatEditingService();
