/**
 * Chat Code Block Part
 * VS Code coreAi-main/.../chatContentParts/codeBlockPart.ts referans alınarak
 *
 * Apply / Insert / Copy / Run butonlarıyla zengin kod bloğu
 */

import { useState, useCallback } from 'react';

interface ChatCodeBlockPartProps {
    code: string;
    language: string;
    currentFile?: string;
    onApplyToEditor?: (code: string) => void;
    onInsertAtCursor?: (code: string) => void;
    onRunInTerminal?: (code: string) => void;
}

export function ChatCodeBlockPart({
    code,
    language,
    currentFile,
    onApplyToEditor,
    onInsertAtCursor,
    onRunInTerminal,
}: ChatCodeBlockPartProps) {
    const [copied, setCopied] = useState(false);
    const [applying, setApplying] = useState(false);
    const [hovered, setHovered] = useState(false);

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [code]);

    const handleApply = useCallback(async () => {
        if (!onApplyToEditor) return;
        setApplying(true);
        try {
            onApplyToEditor(code);
        } finally {
            setApplying(false);
        }
    }, [code, onApplyToEditor]);

    const handleRun = useCallback(() => {
        if (onRunInTerminal) onRunInTerminal(code);
    }, [code, onRunInTerminal]);

    const handleInsert = useCallback(() => {
        if (onInsertAtCursor) onInsertAtCursor(code);
    }, [code, onInsertAtCursor]);

    const isRunnable = ['bash', 'sh', 'shell', 'powershell', 'python', 'py', 'javascript', 'js', 'ts', 'typescript'].includes(language.toLowerCase());

    return (
        <div
            style={{
                position: 'relative',
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid #1e293b',
                background: '#0d1117',
                marginBottom: 4,
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '5px 10px',
                background: '#161b22',
                borderBottom: '1px solid #21262d',
            }}>
                <span style={{
                    fontSize: 10,
                    color: '#8b949e',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                }}>
                    {language || 'code'}
                </span>

                {/* Action Toolbar */}
                <div style={{
                    display: 'flex',
                    gap: 4,
                    opacity: hovered ? 1 : 0,
                    transition: 'opacity 0.15s',
                }}>
                    {onApplyToEditor && (
                        <ToolbarButton
                            icon={applying ? '⏳' : '●'}
                            label={applying ? 'Uygulanıyor...' : 'Dosyaya Uygula'}
                            color="#6366f1"
                            onClick={handleApply}
                            disabled={applying}
                        />
                    )}
                    {onInsertAtCursor && (
                        <ToolbarButton
                            icon="⤵"
                            label="Cursor'a Ekle"
                            color="#34d399"
                            onClick={handleInsert}
                        />
                    )}
                    {isRunnable && onRunInTerminal && (
                        <ToolbarButton
                            icon="▶"
                            label="Terminalde Çalıştır"
                            color="#f59e0b"
                            onClick={handleRun}
                        />
                    )}
                    <ToolbarButton
                        icon={copied ? '✓' : '📋'}
                        label={copied ? 'Kopyalandı!' : 'Kopyala'}
                        color={copied ? '#22c55e' : '#8b949e'}
                        onClick={handleCopy}
                    />
                </div>
            </div>

            {/* Code content */}
            <pre style={{
                margin: 0,
                padding: '12px 16px',
                overflowX: 'auto',
                fontSize: 12,
                lineHeight: '1.6',
                color: '#e6edf3',
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                whiteSpace: 'pre',
                background: 'transparent',
            }}>
                <code>{code}</code>
            </pre>

            {/* Line count */}
            <div style={{
                padding: '2px 10px',
                borderTop: '1px solid #21262d',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 9,
                color: '#484f58',
            }}>
                <span>{code.split('\n').length} satır</span>
                {currentFile && (
                    <span>hedef: {currentFile.split('/').pop()}</span>
                )}
            </div>
        </div>
    );
}

function ToolbarButton({
    icon,
    label,
    color,
    onClick,
    disabled = false,
}: {
    icon: string;
    label: string;
    color: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    const [hover, setHover] = useState(false);

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={label}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                background: hover ? `${color}20` : 'transparent',
                border: `1px solid ${hover ? color : 'transparent'}`,
                borderRadius: 4,
                color: hover ? color : '#8b949e',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: 10,
                fontWeight: hover ? 600 : 400,
                transition: 'all 0.1s',
                opacity: disabled ? 0.5 : 1,
                whiteSpace: 'nowrap',
            }}
        >
            <span>{icon}</span>
            {hover && <span style={{ fontSize: 9 }}>{label}</span>}
        </button>
    );
}
