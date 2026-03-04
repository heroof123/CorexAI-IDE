/**
 * Chat Mode Picker Component
 * Ask / Edit / Agent mod seçimi
 */

import React, { useState } from 'react';
import { chatModeService, CHAT_MODES } from '../../services/chat/chatModes';
import { ChatMode } from '../../services/chat/chatEditingTypes';

interface ChatModePickerProps {
    currentMode: ChatMode;
    onChange?: (mode: ChatMode) => void;
    compact?: boolean;
}

export function ChatModePicker({ currentMode, onChange, compact = false }: ChatModePickerProps) {
    const [open, setOpen] = useState(false);
    const current = CHAT_MODES[currentMode];

    const handleSelect = (mode: ChatMode) => {
        chatModeService.setMode(mode);
        onChange?.(mode);
        setOpen(false);
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* Trigger */}
            <button
                onClick={() => setOpen(v => !v)}
                title={current.description}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: compact ? '2px 8px' : '4px 10px',
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${current.color}40`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: current.color,
                    fontSize: compact ? 10 : 11,
                    fontWeight: 600,
                    transition: 'all 0.15s',
                }}
            >
                <span style={{ fontSize: compact ? 11 : 13 }}>{current.icon}</span>
                {current.label}
                <svg
                    width="8" height="8" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5"
                    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                >
                    <path d="M18 15l-6-6-6 6" />
                </svg>
            </button>

            {/* Dropdown */}
            {open && (
                <>
                    {/* Backdrop */}
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                        onClick={() => setOpen(false)}
                    />
                    <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        marginBottom: 4,
                        background: '#1a1a2e',
                        border: '1px solid #334155',
                        borderRadius: 10,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        zIndex: 9999,
                        minWidth: 220,
                        overflow: 'hidden',
                        padding: 4,
                    }}>
                        {Object.values(CHAT_MODES).map(mode => (
                            <button
                                key={mode.id}
                                onClick={() => handleSelect(mode.id)}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 10,
                                    padding: '8px 10px',
                                    background: currentMode === mode.id ? `${mode.color}15` : 'transparent',
                                    border: 'none',
                                    borderRadius: 7,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLElement).style.background = `${mode.color}10`;
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLElement).style.background =
                                        currentMode === mode.id ? `${mode.color}15` : 'transparent';
                                }}
                            >
                                <span style={{ fontSize: 16, marginTop: 1 }}>{mode.icon}</span>
                                <div>
                                    <div style={{
                                        color: currentMode === mode.id ? mode.color : '#e2e8f0',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        marginBottom: 2,
                                    }}>
                                        {mode.label}
                                        {currentMode === mode.id && (
                                            <span style={{
                                                marginLeft: 6,
                                                fontSize: 9,
                                                padding: '1px 5px',
                                                background: `${mode.color}30`,
                                                borderRadius: 3,
                                                color: mode.color,
                                            }}>
                                                Aktif
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: 10.5 }}>
                                        {mode.description}
                                    </div>
                                    <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
                                        {mode.canEditFiles && (
                                            <Tag color="#34d399">Dosya düzenle</Tag>
                                        )}
                                        {mode.canRunTools && (
                                            <Tag color="#f59e0b">Tool çalıştır</Tag>
                                        )}
                                        {mode.canCreateFiles && (
                                            <Tag color="#60a5fa">Dosya oluştur</Tag>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
    return (
        <span style={{
            fontSize: 9,
            padding: '1px 5px',
            background: `${color}15`,
            color,
            borderRadius: 3,
            border: `1px solid ${color}30`,
        }}>
            {children}
        </span>
    );
}
