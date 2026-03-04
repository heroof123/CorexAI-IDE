/**
 * Chat Thinking Part
 * AI "düşünüyor" animasyonu — streaming sırasında
 * VS Code coreAi-main/.../chatContentParts/chatThinkingContentPart.ts referans
 */

import { useEffect, useState } from 'react';

interface ChatThinkingPartProps {
    modelName?: string;
    startTime?: number;
    thinking?: string; // <think> içeriği (opsiyonel)
    expanded?: boolean;
}

export function ChatThinkingPart({
    modelName = 'AI',
    startTime,
    thinking,
    expanded: defaultExpanded = false,
}: ChatThinkingPartProps) {
    const [elapsed, setElapsed] = useState(0);
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [dot, setDot] = useState(0);

    useEffect(() => {
        if (!startTime) return;
        const interval = setInterval(() => {
            setElapsed(Date.now() - startTime);
        }, 100);
        return () => clearInterval(interval);
    }, [startTime]);

    useEffect(() => {
        const interval = setInterval(() => {
            setDot(d => (d + 1) % 4);
        }, 350);
        return () => clearInterval(interval);
    }, []);

    const dots = '.'.repeat(dot);
    const seconds = (elapsed / 1000).toFixed(1);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
        }}>
            {/* Thinking indicator */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                background: '#1e293b50',
                borderRadius: 8,
                border: '1px solid #334155',
            }}>
                {/* Animated dots */}
                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                        <div
                            key={i}
                            style={{
                                width: 5,
                                height: 5,
                                borderRadius: '50%',
                                background: '#6366f1',
                                animation: `thinkingPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                            }}
                        />
                    ))}
                </div>

                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    {modelName} düşünüyor{dots}
                </span>

                {startTime && (
                    <span style={{
                        fontSize: 10,
                        color: '#475569',
                        marginLeft: 'auto',
                    }}>
                        {seconds}s
                    </span>
                )}

                {/* Thinking toggle */}
                {thinking && (
                    <button
                        onClick={() => setExpanded(v => !v)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#6366f1',
                            fontSize: 10,
                            cursor: 'pointer',
                            padding: '1px 4px',
                            borderRadius: 3,
                        }}
                    >
                        {expanded ? '▲ Gizle' : '▼ Düşünce'}
                    </button>
                )}
            </div>

            {/* Thinking content (expandable) */}
            {thinking && expanded && (
                <div style={{
                    padding: '8px 12px',
                    background: '#0f172a',
                    borderRadius: 6,
                    border: '1px solid #1e293b',
                    borderLeft: '3px solid #6366f1',
                    fontSize: 11,
                    color: '#64748b',
                    fontStyle: 'italic',
                    lineHeight: 1.6,
                    maxHeight: 200,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                }}>
                    {thinking}
                </div>
            )}

            <style>{`
        @keyframes thinkingPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
        </div>
    );
}
