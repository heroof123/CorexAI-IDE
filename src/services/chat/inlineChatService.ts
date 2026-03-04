/**
 * Inline Chat Service
 * VS Code coreAi-main/src/vs/workbench/contrib/inlineChat/ referans alınarak yazıldı
 *
 * Ctrl+I ile Monaco editörünün içinde chat açar.
 * Zone widget satırlar arasına gömülür.
 */

import * as monaco from 'monaco-editor';
import { InlineChatSession } from './chatEditingTypes';

type InlineChatCallback = (
    session: InlineChatSession,
    prompt: string
) => Promise<string>;

class InlineChatService {
    private _sessions: Map<string, InlineChatSession> = new Map();
    private _activeEditorSession: string | null = null;
    private _onAIRequest: InlineChatCallback | null = null;

    // Zone widget DOM element takibi
    private _zoneWidgets: Map<string, { dispose: () => void }> = new Map();

    // ── Kayıt (dışarıdan AI callback verilir) ─────────────────

    setAIRequestHandler(handler: InlineChatCallback): void {
        this._onAIRequest = handler;
    }

    // ── Monaco editörüne kayıt ────────────────────────────────

    registerEditor(editor: monaco.editor.IStandaloneCodeEditor, fileUri: string): () => void {
        // Ctrl+I → inline chat aç
        const actionDisposable = editor.addAction({
            id: 'corex.inline-chat.open',
            label: 'CorexAI: Inline Chat (Ctrl+I)',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
            contextMenuGroupId: 'corex',
            contextMenuOrder: 1,
            run: (ed) => {
                const standaloneEd = ed as monaco.editor.IStandaloneCodeEditor;
                const selection = standaloneEd.getSelection();
                if (selection) {
                    this.openSession(standaloneEd, fileUri, selection);
                }
            },
        });

        return () => actionDisposable.dispose();
    }

    // ── Session aç ────────────────────────────────────────────

    openSession(
        editor: monaco.editor.IStandaloneCodeEditor,
        fileUri: string,
        selection: monaco.Selection
    ): InlineChatSession {
        // Önceki session varsa kapat
        if (this._activeEditorSession) {
            this.closeSession(this._activeEditorSession);
        }

        const model = editor.getModel();
        const originalText = model
            ? model.getValueInRange(selection)
            : '';

        const session: InlineChatSession = {
            id: `inline-chat-${Date.now()}`,
            editorUri: fileUri,
            startLine: selection.startLineNumber,
            endLine: selection.endLineNumber,
            originalText,
            state: 'open',
        };

        this._sessions.set(session.id, session);
        this._activeEditorSession = session.id;

        // Zone widget oluştur (inline chat input alanı)
        this._createZoneWidget(editor, session);

        return session;
    }

    // ── Zone Widget (Monaco ViewZone) ─────────────────────────

    private _createZoneWidget(
        editor: monaco.editor.IStandaloneCodeEditor,
        session: InlineChatSession
    ): void {
        const domNode = this._buildWidgetDOM(session, editor);

        let zoneId = '';

        editor.changeViewZones((accessor) => {
            zoneId = accessor.addZone({
                afterLineNumber: session.startLine,
                heightInLines: 4,
                domNode,
            });
        });

        this._zoneWidgets.set(session.id, {
            dispose: () => {
                editor.changeViewZones((accessor) => {
                    accessor.removeZone(zoneId);
                });
                domNode.remove();
            },
        });
    }

    private _buildWidgetDOM(
        session: InlineChatSession,
        editor: monaco.editor.IStandaloneCodeEditor
    ): HTMLElement {
        const container = document.createElement('div');
        container.className = 'corex-inline-chat-zone';
        container.style.cssText = `
      background: #1a1a2e;
      border: 1px solid #6366f1;
      border-radius: 8px;
      padding: 8px 12px;
      margin: 4px 0 4px 48px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 20px rgba(99,102,241,0.2);
      font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
    `;

        // AI ikon
        const icon = document.createElement('span');
        icon.textContent = '✨';
        icon.style.fontSize = '14px';
        container.appendChild(icon);

        // Input
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Bu kodu nasıl değiştireyim? (Enter = Gönder, Esc = Kapat)';
        input.style.cssText = `
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #e2e8f0;
      font-size: 13px;
      placeholder-color: #64748b;
    `;
        container.appendChild(input);

        // Gönder butonu
        const sendBtn = document.createElement('button');
        sendBtn.textContent = '↵';
        sendBtn.style.cssText = `
      background: #6366f1;
      border: none;
      border-radius: 4px;
      color: white;
      padding: 2px 8px;
      cursor: pointer;
      font-size: 12px;
    `;
        container.appendChild(sendBtn);

        // Kapat butonu
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 12px;
      padding: 2px 4px;
    `;
        container.appendChild(closeBtn);

        // Event'ler
        const handleSend = async () => {
            const prompt = input.value.trim();
            if (!prompt) return;

            input.disabled = true;
            sendBtn.disabled = true;
            sendBtn.textContent = '⏳';

            try {
                if (this._onAIRequest) {
                    const result = await this._onAIRequest(session, prompt);
                    this._applyResult(editor, session, result);
                }
                this.closeSession(session.id);
            } catch {
                input.disabled = false;
                sendBtn.disabled = false;
                sendBtn.textContent = '↵';
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSend();
            if (e.key === 'Escape') this.closeSession(session.id);
        });

        sendBtn.addEventListener('click', handleSend);
        closeBtn.addEventListener('click', () => this.closeSession(session.id));

        // Focus
        setTimeout(() => input.focus(), 50);

        return container;
    }

    // ── AI yanıtını editöre uygula ────────────────────────────

    private _applyResult(
        editor: monaco.editor.IStandaloneCodeEditor,
        session: InlineChatSession,
        newText: string
    ): void {
        const model = editor.getModel();
        if (!model) return;

        // Kod bloğu varsa parse et
        const codeMatch = /```[\w]*\n([\s\S]*?)```/.exec(newText);
        const finalText = codeMatch ? codeMatch[1] : newText;

        editor.executeEdits('inline-chat', [{
            range: new monaco.Range(
                session.startLine,
                1,
                session.endLine,
                model.getLineMaxColumn(session.endLine)
            ),
            text: finalText,
        }]);

        session.state = 'applied';
    }

    // ── Session kapat ─────────────────────────────────────────

    closeSession(sessionId: string): void {
        const widget = this._zoneWidgets.get(sessionId);
        widget?.dispose();
        this._zoneWidgets.delete(sessionId);
        this._sessions.delete(sessionId);

        if (this._activeEditorSession === sessionId) {
            this._activeEditorSession = null;
        }
    }

    getActiveSession(): InlineChatSession | null {
        if (!this._activeEditorSession) return null;
        return this._sessions.get(this._activeEditorSession) ?? null;
    }
}

export const inlineChatService = new InlineChatService();
