/**
 * Chat Content Registry
 * AI yanıtlarındaki farklı parça türlerini yönetir ve render eder.
 */

import React from 'react';

export type ChatPartType =
    | 'markdown'
    | 'codeblock'
    | 'diff'
    | 'thinking'
    | 'toolcall'
    | 'confirmation'
    | 'error'
    | 'progress'
    | 'reference'
    | 'todolist';

export interface ChatContentPart {
    type: ChatPartType;
    data: any; // Her part için özel data yapısı
}

export type ChatContentRenderer = (part: ChatContentPart, context: any) => React.ReactNode;

class ChatContentRegistry {
    private renderers = new Map<ChatPartType, ChatContentRenderer>();

    registerRenderer(type: ChatPartType, renderer: ChatContentRenderer) {
        this.renderers.set(type, renderer);
    }

    getRenderer(type: ChatPartType): ChatContentRenderer | undefined {
        return this.renderers.get(type);
    }

    renderPart(part: ChatContentPart, context: any = {}): React.ReactNode {
        const renderer = this.getRenderer(part.type);
        if (!renderer) {
            console.warn(`[ChatContentRegistry] Renderer not found for part type: ${part.type}`);
            return null;
        }
        return renderer(part, context);
    }
}

export const chatContentRegistry = new ChatContentRegistry();
