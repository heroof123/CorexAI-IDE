import { useState, useEffect } from "react";
import { voiceService } from "../services/voiceService";

export function useVoiceLogic(
    editor: { saveFile: () => void },
    toggleLeftSidebar: () => void,
    toggleRightSidebar: () => void,
    chat: { sendMessage: (msg: string) => void },
    notify: (type: "success" | "error" | "warning" | "info", title: string, message: string) => void
) {
    const [isVoiceSupported] = useState(voiceService.isSupported());
    const [voiceStatus, setVoiceStatus] = useState<'listening' | 'idle' | 'processing' | 'error'>('idle');

    useEffect(() => {
        voiceService.onStatus(setVoiceStatus);
    }, []);

    const handleVoiceCommand = (command: string) => {
        console.log("🎤 Voice Command Received:", command);
        switch (command) {
            case 'SAVE':
                editor.saveFile();
                notify("success", "Sesli Komut", "Dosya kaydedildi!");
                break;
            case 'FORMAT':
                notify("info", "Sesli Komut", "Kod formatlanıyor...");
                break;
            case 'TOGGLE_SIDEBAR':
                toggleLeftSidebar();
                break;
            case 'TOGGLE_CHAT':
                toggleRightSidebar();
                break;
            case 'NEW_AGENT':
                chat.sendMessage("/agent");
                break;
        }
    };

    return {
        isVoiceSupported,
        voiceStatus,
        setVoiceStatus,
        handleVoiceCommand
    };
}
