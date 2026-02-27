import React, { useState, useEffect } from 'react';
import { voiceService, VoiceCommand } from '../services/voiceService';

interface VoiceControlOverlayProps {
    onCommand: (command: VoiceCommand) => void;
}

export const VoiceControlOverlay: React.FC<VoiceControlOverlayProps> = ({ onCommand }) => {
    const [status, setStatus] = useState<'listening' | 'idle' | 'processing' | 'error'>('idle');
    const [transcript, setTranscript] = useState('');
    const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        voiceService.onStatus((s) => {
            setStatus(s);
            if (s === 'listening') setIsVisible(true);
            if (s === 'idle') {
                setTimeout(() => setIsVisible(false), 3000);
            }
        });

        voiceService.onCommand((cmd, text) => {
            setTranscript(text);
            setLastCommand(cmd);
            if (cmd !== 'UNKNOWN') {
                onCommand(cmd);
            }
        });
    }, [onCommand]);

    if (!isVisible && status === 'idle') return null;

    return (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Status Indicator */}
            <div className={`
                flex items-center gap-3 px-4 py-2 rounded-full border shadow-2xl backdrop-blur-md transition-all duration-300
                ${status === 'listening' ? 'bg-blue-600/20 border-blue-500 shadow-blue-500/20 w-auto' :
                    status === 'processing' ? 'bg-purple-600/20 border-purple-500 shadow-purple-500/20' :
                        status === 'error' ? 'bg-red-600/20 border-red-500' : 'bg-neutral-900/80 border-neutral-700'}
            `}>
                <div className="relative flex items-center justify-center">
                    {status === 'listening' && (
                        <div className="absolute w-8 h-8 bg-blue-500/30 rounded-full animate-ping" />
                    )}
                    <span className={`text-lg ${status === 'listening' ? 'animate-pulse' : ''}`}>
                        {status === 'listening' ? '🎙️' : status === 'processing' ? '⚙️' : status === 'error' ? '⚠️' : '🎤'}
                    </span>
                </div>

                <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                        {status === 'listening' ? 'Dinleniyor...' :
                            status === 'processing' ? 'İşleniyor...' :
                                status === 'error' ? 'Hata!' : 'Hazır'}
                    </span>
                    <span className="text-sm font-medium text-white min-w-[100px]">
                        {transcript || 'Bir komut söyleyin...'}
                    </span>
                </div>

                {status === 'listening' && (
                    <button
                        onClick={() => voiceService.stop()}
                        className="ml-2 w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Command Feedback */}
            {lastCommand && status !== 'listening' && (
                <div className={`
                    px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border animate-in zoom-in-95 duration-200
                    ${lastCommand === 'UNKNOWN' ? 'bg-neutral-800 border-neutral-700 text-neutral-500' : 'bg-green-600/20 border-green-500 text-green-400'}
                `}>
                    {lastCommand === 'UNKNOWN' ? 'Komut Anlaşılamadı' : `Komut: ${lastCommand}`}
                </div>
            )}
        </div>
    );
};
