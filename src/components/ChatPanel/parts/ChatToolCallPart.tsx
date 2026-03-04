/**
 * Chat Tool Call Part
 * Tool çağrısı giriş ve çıkışını gösterir
 * VS Code coreAi-main/.../chatContentParts/chatToolInputOutputContentPart.ts referans
 */

import { useState } from 'react';

export interface ToolCallResult {
    toolName: string;
    toolIcon?: string;
    status: 'running' | 'success' | 'error';
    input?: Record<string, unknown>;
    output?: string;
    errorMessage?: string;
    durationMs?: number;
}

interface ChatToolCallPartProps {
    toolCall: ToolCallResult;
    requiresConfirmation?: boolean;
    onConfirm?: () => void;
    onDeny?: () => void;
}

export function ChatToolCallPart({
    toolCall,
    requiresConfirmation = false,
    onConfirm,
    onDeny,
}: ChatToolCallPartProps) {
    const [expanded, setExpanded] = useState(false);

    const statusColor = {
        running: '#fbbf24',
        success: '#22c55e',
        error: '#ef4444',
    }[toolCall.status];

    const statusIcon = {
        running: '⏳',
        success: '✓',
        error: '✗',
    }[toolCall.status];

    return (
        <div style={{
            border: `1px solid ${statusColor}30`,
            borderRadius: 8,
            overflow: 'hidden',
            background: '#0f172a',
            marginBottom: 4,
        }}>
            {/* Tool header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 10px',
                    gap: 8,
                    cursor: 'pointer',
                    background: `${statusColor}08`,
                    borderBottom: expanded ? `1px solid ${statusColor}20` : 'none',
                }}
                onClick={() => setExpanded(v => !v)}
            >
                {/* Status dot */}
                <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: statusColor,
                    display: 'inline-block',
                    flexShrink: 0,
                    ...(toolCall.status === 'running' ? { animation: 'pulse 1.2s ease-in-out infinite' } : {}),
                }} />

                <span style={{ fontSize: 12 }}>{toolCall.toolIcon ?? '🔧'}</span>
                <span style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600, flex: 1 }}>
                    {toolCall.toolName}
                </span>

                {toolCall.durationMs && toolCall.status === 'success' && (
                    <span style={{ fontSize: 9, color: '#475569' }}>
                        {toolCall.durationMs}ms
                    </span>
                )}

                <span style={{ fontSize: 10, color: statusColor }}>{statusIcon}</span>
                <span style={{ fontSize: 9, color: '#475569' }}>
                    {expanded ? '▲' : '▼'}
                </span>
            </div>

            {/* Expanded: input/output */}
            {expanded && (
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Input */}
                    {toolCall.input && Object.keys(toolCall.input).length > 0 && (
                        <div>
                            <div style={{ fontSize: 9, color: '#475569', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase' }}>
                                Giriş
                            </div>
                            <pre style={{
                                margin: 0,
                                padding: '6px 8px',
                                background: '#1e293b',
                                borderRadius: 4,
                                fontSize: 10,
                                color: '#94a3b8',
                                fontFamily: 'monospace',
                                overflow: 'auto',
                                maxHeight: 100,
                                whiteSpace: 'pre-wrap',
                            }}>
                                {JSON.stringify(toolCall.input, null, 2)}
                            </pre>
                        </div>
                    )}

                    {/* Output */}
                    {toolCall.output && (
                        <div>
                            <div style={{ fontSize: 9, color: '#475569', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase' }}>
                                Çıkış
                            </div>
                            <pre style={{
                                margin: 0,
                                padding: '6px 8px',
                                background: '#1e293b',
                                borderRadius: 4,
                                fontSize: 10,
                                color: '#86efac',
                                fontFamily: 'monospace',
                                overflow: 'auto',
                                maxHeight: 150,
                                whiteSpace: 'pre-wrap',
                            }}>
                                {toolCall.output}
                            </pre>
                        </div>
                    )}

                    {/* Error */}
                    {toolCall.errorMessage && (
                        <div style={{
                            padding: '6px 8px',
                            background: '#ef444415',
                            borderRadius: 4,
                            fontSize: 10,
                            color: '#fca5a5',
                            fontFamily: 'monospace',
                        }}>
                            {toolCall.errorMessage}
                        </div>
                    )}

                    {/* Confirmation buttons */}
                    {requiresConfirmation && toolCall.status === 'running' && (
                        <div style={{
                            display: 'flex',
                            gap: 6,
                            paddingTop: 4,
                            borderTop: '1px solid #1e293b',
                        }}>
                            <div style={{ fontSize: 10, color: '#94a3b8', flex: 1, alignSelf: 'center' }}>
                                Bu tool'u çalıştırmaya izin ver?
                            </div>
                            <button
                                onClick={onConfirm}
                                style={{
                                    padding: '3px 10px', fontSize: 10, fontWeight: 600,
                                    background: '#22c55e', border: 'none', borderRadius: 4,
                                    color: 'white', cursor: 'pointer',
                                }}
                            >
                                ✓ İzin Ver
                            </button>
                            <button
                                onClick={onDeny}
                                style={{
                                    padding: '3px 10px', fontSize: 10,
                                    background: '#ef4444', border: 'none', borderRadius: 4,
                                    color: 'white', cursor: 'pointer',
                                }}
                            >
                                ✕ Reddet
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
