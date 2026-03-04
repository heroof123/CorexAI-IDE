/**
 * Chat Editing Panel
 * AI'ın önerdiği dosya değişikliklerini hunk bazlı gösterir
 * VS Code chatEditing/chatEditingEditorOverlay.ts referans alınarak
 */

import { useState } from 'react';
import { ChatEditingSession, EditHunk, ChatEditingEntry } from '../../services/chat/chatEditingTypes';
import { chatEditingService } from '../../services/chat/chatEditingService';

interface ChatEditingPanelProps {
    session: ChatEditingSession;
    onApply: (filePath: string, content: string) => void;
    onClose: () => void;
}

export function ChatEditingPanel({ session, onApply, onClose }: ChatEditingPanelProps) {
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(
        new Set(session.entries.keys())
    );

    const entries = Array.from(session.entries.values());
    const totalHunks = entries.reduce((sum, e) => sum + e.hunks.length, 0);
    const pendingHunks = entries.reduce(
        (sum, e) => sum + e.hunks.filter(h => h.accepted === null).length, 0
    );

    const toggleFile = (filePath: string) => {
        setExpandedFiles(prev => {
            const next = new Set(prev);
            next.has(filePath) ? next.delete(filePath) : next.add(filePath);
            return next;
        });
    };

    const handleAcceptAll = () => {
        chatEditingService.acceptAll(session.id);
        entries.forEach(e => {
            const content = chatEditingService.computeFinalContent(e);
            onApply(e.filePath, content);
        });
        onClose();
    };

    const handleRejectAll = () => {
        chatEditingService.rejectAll(session.id);
        onClose();
    };

    const handleAcceptFile = (entry: ChatEditingEntry) => {
        chatEditingService.acceptAllInFile(session.id, entry.filePath);
        const content = chatEditingService.computeFinalContent(entry);
        onApply(entry.filePath, content);
    };

    const handleRejectFile = (entry: ChatEditingEntry) => {
        chatEditingService.rejectAllInFile(session.id, entry.filePath);
    };

    const handleAcceptHunk = (entry: ChatEditingEntry, hunk: EditHunk) => {
        chatEditingService.acceptHunk(session.id, entry.filePath, hunk.id);
        const content = chatEditingService.computeFinalContent(entry);
        onApply(entry.filePath, content);
    };

    const handleRejectHunk = (entry: ChatEditingEntry, hunk: EditHunk) => {
        chatEditingService.rejectHunk(session.id, entry.filePath, hunk.id);
    };

    return (
        <div style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 10,
            overflow: 'hidden',
            margin: '8px 0',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
            {/* Header */}
            <div style={{
                padding: '8px 12px',
                background: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #334155',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13 }}>✏️</span>
                    <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>
                        Önerilen Değişiklikler
                    </span>
                    <span style={{
                        fontSize: 10, padding: '1px 6px',
                        background: '#334155', borderRadius: 4, color: '#94a3b8'
                    }}>
                        {entries.length} dosya · {totalHunks} değişiklik
                    </span>
                    {pendingHunks > 0 && (
                        <span style={{
                            fontSize: 10, padding: '1px 6px',
                            background: '#fbbf2420', borderRadius: 4, color: '#fbbf24'
                        }}>
                            {pendingHunks} bekliyor
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        onClick={handleAcceptAll}
                        style={{
                            padding: '3px 10px', fontSize: 11, fontWeight: 600,
                            background: '#22c55e', border: 'none', borderRadius: 5,
                            color: 'white', cursor: 'pointer',
                        }}
                    >
                        ✓ Tümünü Kabul
                    </button>
                    <button
                        onClick={handleRejectAll}
                        style={{
                            padding: '3px 10px', fontSize: 11, fontWeight: 600,
                            background: '#ef4444', border: 'none', borderRadius: 5,
                            color: 'white', cursor: 'pointer',
                        }}
                    >
                        ✕ Tümünü Reddet
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '3px 8px', fontSize: 11,
                            background: 'transparent', border: '1px solid #334155',
                            borderRadius: 5, color: '#64748b', cursor: 'pointer',
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* File entries */}
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {entries.map(entry => (
                    <div key={entry.filePath} style={{ borderBottom: '1px solid #1e293b' }}>
                        {/* File header */}
                        <div
                            style={{
                                padding: '6px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer',
                                background: expandedFiles.has(entry.filePath) ? '#1e293b50' : 'transparent',
                            }}
                            onClick={() => toggleFile(entry.filePath)}
                        >
                            <span style={{
                                fontSize: 10, transform: expandedFiles.has(entry.filePath) ? 'none' : 'rotate(-90deg)',
                                display: 'inline-block', transition: 'transform 0.15s', color: '#64748b',
                            }}>▾</span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>📄</span>
                            <span style={{ fontSize: 11, color: '#e2e8f0', flex: 1, fontFamily: 'monospace' }}>
                                {entry.filePath}
                            </span>
                            <EntryStateBadge state={entry.state} hunkCount={entry.hunks.length} />
                            <button
                                onClick={(e) => { e.stopPropagation(); handleAcceptFile(entry); }}
                                style={{
                                    padding: '1px 7px', fontSize: 10, fontWeight: 600,
                                    background: '#22c55e20', border: '1px solid #22c55e40',
                                    borderRadius: 4, color: '#22c55e', cursor: 'pointer',
                                }}
                            >✓ Kabul</button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRejectFile(entry); }}
                                style={{
                                    padding: '1px 7px', fontSize: 10,
                                    background: '#ef444420', border: '1px solid #ef444440',
                                    borderRadius: 4, color: '#ef4444', cursor: 'pointer',
                                }}
                            >✕ Red</button>
                        </div>

                        {/* Hunks */}
                        {expandedFiles.has(entry.filePath) && (
                            <div style={{ padding: '2px 0 8px 24px' }}>
                                {entry.hunks.map(hunk => (
                                    <HunkView
                                        key={hunk.id}
                                        hunk={hunk}
                                        onAccept={() => handleAcceptHunk(entry, hunk)}
                                        onReject={() => handleRejectHunk(entry, hunk)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer — checkpoint listesi */}
            {session.checkpoints.length > 0 && (
                <div style={{
                    padding: '6px 12px',
                    borderTop: '1px solid #1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                }}>
                    <span style={{ fontSize: 10, color: '#64748b' }}>
                        🕐 {session.checkpoints.length} checkpoint kaydedildi
                    </span>
                </div>
            )}
        </div>
    );
}

// ── Hunk görünümü ─────────────────────────────────────────────

function HunkView({
    hunk,
    onAccept,
    onReject,
}: {
    hunk: EditHunk;
    onAccept: () => void;
    onReject: () => void;
}) {
    const borderColor =
        hunk.accepted === true ? '#22c55e' :
            hunk.accepted === false ? '#ef4444' :
                '#334155';

    return (
        <div style={{
            margin: '4px 8px',
            border: `1px solid ${borderColor}`,
            borderRadius: 6,
            overflow: 'hidden',
            opacity: hunk.accepted === false ? 0.5 : 1,
        }}>
            {/* Hunk header */}
            <div style={{
                padding: '3px 8px',
                background: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
                    Satır {hunk.startLine}–{hunk.endLine}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                    {hunk.accepted === null && (
                        <>
                            <button
                                onClick={onAccept}
                                style={{
                                    padding: '1px 6px', fontSize: 9, fontWeight: 700,
                                    background: '#22c55e20', border: '1px solid #22c55e60',
                                    borderRadius: 3, color: '#22c55e', cursor: 'pointer',
                                }}
                            >✓</button>
                            <button
                                onClick={onReject}
                                style={{
                                    padding: '1px 6px', fontSize: 9,
                                    background: '#ef444420', border: '1px solid #ef444460',
                                    borderRadius: 3, color: '#ef4444', cursor: 'pointer',
                                }}
                            >✕</button>
                        </>
                    )}
                    {hunk.accepted === true && (
                        <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 700 }}>✓ Kabul Edildi</span>
                    )}
                    {hunk.accepted === false && (
                        <span style={{ fontSize: 9, color: '#ef4444' }}>✕ Reddedildi</span>
                    )}
                </div>
            </div>

            {/* Diff kodu */}
            <div style={{ fontFamily: 'monospace', fontSize: 11 }}>
                {hunk.oldContent && hunk.oldContent.split('\n').map((line, i) => (
                    <div key={`old-${i}`} style={{
                        padding: '0 8px', background: '#ef444415', color: '#fca5a5',
                        whiteSpace: 'pre',
                    }}>
                        - {line}
                    </div>
                ))}
                {hunk.newContent && hunk.newContent.split('\n').map((line, i) => (
                    <div key={`new-${i}`} style={{
                        padding: '0 8px', background: '#22c55e15', color: '#86efac',
                        whiteSpace: 'pre',
                    }}>
                        + {line}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Entry state badge ─────────────────────────────────────────

function EntryStateBadge({
    state,
    hunkCount,
}: {
    state: ChatEditingEntry['state'];
    hunkCount: number;
}) {
    const config = {
        pending: { color: '#fbbf24', label: 'Bekliyor' },
        accepted: { color: '#22c55e', label: 'Kabul' },
        rejected: { color: '#ef4444', label: 'Red' },
        partial: { color: '#a78bfa', label: 'Kısmi' },
    }[state];

    return (
        <span style={{
            fontSize: 9, padding: '1px 6px',
            background: `${config.color}20`, color: config.color,
            borderRadius: 3, border: `1px solid ${config.color}40`,
        }}>
            {config.label} · {hunkCount} hunk
        </span>
    );
}
