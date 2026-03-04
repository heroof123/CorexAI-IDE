import { useEffect } from 'react';
import { chatContentRegistry, ChatContentPart } from '../../services/chat/chatContentRegistry';

// Temel part'ları import edip kaydediyoruz
import { ChatMarkdownPart } from './parts/ChatMarkdownPart';
import { ChatDiffBlockPart } from './parts/ChatDiffBlockPart';
import { ChatConfirmationPart } from './parts/ChatConfirmationPart';
import { ChatReferencePart } from './parts/ChatReferencePart';
import { ChatThinkingPart } from './parts/ChatThinkingPart';
import { ChatToolCallPart } from './parts/ChatToolCallPart';
import { ChatCodeBlockPart } from './parts/ChatCodeBlockPart';
import { ChatErrorPart } from './parts/ChatErrorPart';
import { ChatProgressPart } from './parts/ChatProgressPart';
import { ChatTodoListPart } from './parts/ChatTodoListPart';

// Runtime Registry Başlatma
let registryInitialized = false;

function initRegistry() {
    if (registryInitialized) return;

    chatContentRegistry.registerRenderer('markdown', (part, context) => (
        <ChatMarkdownPart key={context.key} data={part.data} />
    ));

    chatContentRegistry.registerRenderer('diff', (part, context) => (
        <ChatDiffBlockPart key={context.key} data={part.data} onApply={context.onApply} onReject={context.onReject} />
    ));

    chatContentRegistry.registerRenderer('confirmation', (part, context) => (
        <ChatConfirmationPart key={context.key} data={part.data} onConfirm={context.onConfirm} onCancel={context.onCancel} />
    ));

    chatContentRegistry.registerRenderer('reference', (part, context) => (
        <ChatReferencePart key={context.key} data={part.data} onFileClick={context.onFileClick} />
    ));

    chatContentRegistry.registerRenderer('thinking', (_part, context) => (
        <ChatThinkingPart key={context.key} />
    ));

    chatContentRegistry.registerRenderer('toolcall', (part, context) => (
        <ChatToolCallPart key={context.key} toolCall={part.data} onConfirm={context.onToolConfirm} onDeny={context.onToolReject} />
    ));

    chatContentRegistry.registerRenderer('codeblock', (part, context) => (
        <ChatCodeBlockPart key={context.key} code={part.data.code} language={part.data.language} onApplyToEditor={context.onApplyCode} onInsertAtCursor={context.onInsertCode} />
    ));

    chatContentRegistry.registerRenderer('error', (part, context) => (
        <ChatErrorPart key={context.key} data={part.data} onRetry={context.onRetry} />
    ));

    chatContentRegistry.registerRenderer('progress', (part, context) => (
        <ChatProgressPart key={context.key} data={part.data} />
    ));

    chatContentRegistry.registerRenderer('todolist', (part, context) => (
        <ChatTodoListPart key={context.key} data={part.data} onToggle={context.onToggleTask} />
    ));

    registryInitialized = true;
}

export function ChatContentRenderer({ parts, context = {} }: { parts: ChatContentPart[], context?: any }) {
    useEffect(() => {
        initRegistry();
    }, []);

    if (!parts || parts.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            {parts.map((part, index) => {
                const node = chatContentRegistry.renderPart(part, { ...context, key: `part-${index}` });
                if (!node) return null;
                return node;
            })}
        </div>
    );
}
