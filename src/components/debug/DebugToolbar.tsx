import { useState, useEffect } from 'react';
import { debugService } from '../../services/debug/debugService';
import { DebugState } from '../../services/debug/debugSession';

export function DebugToolbar() {
    const [state, setState] = useState<DebugState>(debugService.state);

    useEffect(() => {
        return debugService.onStateChange((newState) => {
            setState(newState);
        });
    }, []);

    if (state === 'inactive') return null;

    return (
        <div style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #334155',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 9999,
        }}>
            {/* Grab handle placeholder */}
            <div style={{
                cursor: 'grab',
                padding: '0 4px',
                color: '#475569',
                display: 'flex',
                alignItems: 'center'
            }}>
                <svg width="10" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                </svg>
            </div>

            <span style={{ fontSize: 10, fontWeight: 600, color: state === 'paused' ? '#eab308' : '#22c55e', marginRight: 8, textTransform: 'uppercase' }}>
                {state}
            </span>

            <ToolbarButton
                icon="⏸"
                title="Pause (F6)"
                disabled={state !== 'running'}
                onClick={() => { /* implement pause logic -> requires sending pause to rust */ }}
                color="#eab308"
            />
            <ToolbarButton
                icon="▶"
                title="Continue (F5)"
                disabled={state !== 'paused'}
                onClick={() => debugService.continue()}
                color="#22c55e"
            />
            <ToolbarButton
                icon="⤵"
                title="Step Over (F10)"
                disabled={state !== 'paused'}
                onClick={() => debugService.stepOver()}
                color="#60a5fa"
            />
            <ToolbarButton
                icon="⬇"
                title="Step Into (F11)"
                disabled={state !== 'paused'}
                onClick={() => debugService.stepInto()}
                color="#60a5fa"
            />
            <ToolbarButton
                icon="⬆"
                title="Step Out (Shift+F11)"
                disabled={state !== 'paused'}
                onClick={() => debugService.stepOut()}
                color="#60a5fa"
            />

            <div style={{ width: 1, height: 16, background: '#334155', margin: '0 4px' }} />

            <ToolbarButton
                icon="⏹"
                title="Stop (Shift+F5)"
                disabled={false}
                onClick={() => debugService.stopDebugging()}
                color="#ef4444"
            />
        </div>
    );
}

interface ToolbarButtonProps {
    icon: string;
    title: string;
    onClick: () => void;
    disabled?: boolean;
    color: string;
}

function ToolbarButton({ icon, title, onClick, disabled, color }: ToolbarButtonProps) {
    const [hover, setHover] = useState(false);
    return (
        <button
            title={title}
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                background: hover && !disabled ? `${color}20` : 'transparent',
                border: 'none',
                color: disabled ? '#475569' : color,
                cursor: disabled ? 'not-allowed' : 'pointer',
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 14,
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {icon}
        </button>
    );
}
