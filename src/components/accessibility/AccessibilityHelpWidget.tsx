import { useEffect, useRef } from 'react';
import { accessibilitySignalService, CorexAudioSignal } from '../../services/accessibility/accessibilitySignalService';

interface AccessibilityHelpWidgetProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AccessibilityHelpWidget = ({ isOpen, onClose }: AccessibilityHelpWidgetProps) => {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        if (isOpen && dialogRef.current) {
            dialogRef.current.showModal();
            dialogRef.current.focus();
        } else if (!isOpen && dialogRef.current) {
            dialogRef.current.close();
        }
    }, [isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <dialog
            ref={dialogRef}
            onKeyDown={handleKeyDown}
            onCancel={onClose}
            className="backdrop:bg-black/60 backdrop:backdrop-blur-sm bg-[#1e1e1e] text-[#ccc] border border-[var(--neon-blue)] rounded-xl shadow-[0_0_30px_rgba(0,243,255,0.2)] p-6 w-[600px] max-w-[90vw] focus:outline-none"
            aria-labelledby="accessibility-help-title"
            aria-describedby="accessibility-help-desc"
        >
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                    <span className="text-[24px]" aria-hidden="true">👁️‍🗨️</span>
                    <h2 id="accessibility-help-title" className="text-xl font-bold tracking-wide text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
                        CorexAI : Erişilebilirlik ve Kısayollar
                    </h2>
                </div>
                <button
                    onClick={() => {
                        accessibilitySignalService.playSignal(CorexAudioSignal.FOCUS_CHANGED);
                        onClose();
                    }}
                    className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors focus:ring-2 focus:ring-[var(--neon-blue)] focus:outline-none"
                    aria-label="Yardım penceresini kapat"
                >
                    ✕
                </button>
            </div>

            <p id="accessibility-help-desc" className="text-sm mb-6 leading-relaxed text-[#aaa]">
                CorexAI, ekran okuyucu (Screen Reader) destekli akıllı bir asistan, klavyeden çalışan otonom kısayollar ve işitsel geribildirimler kullanarak sizinle etkileşime girmek üzere tasarlanmıştır.
                Ses dalgaları ve renk modifikasyonlarıyla uygulamanızı kontrol edebilirsiniz.
            </p>

            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[var(--neon-purple)] uppercase tracking-widest border-b border-[#333] pb-1">
                    Ses ve Okuma
                </h3>
                <ul className="space-y-2 text-sm text-[#ddd]">
                    <li className="flex justify-between group">
                        <span>Sesli Geribildirim (Chime) Aç/Kapa</span>
                        <kbd className="bg-[#333] border border-[#555] rounded px-2 py-0.5 text-xs text-white group-hover:border-[var(--neon-purple)] transition-colors">Ctrl + Shift + U</kbd>
                    </li>
                    <li className="flex justify-between group">
                        <span>Yüksek Kontrast Modu (İleri Süreç)</span>
                        <kbd className="bg-[#333] border border-[#555] rounded px-2 py-0.5 text-xs text-white group-hover:border-[var(--neon-purple)] transition-colors">Alt + Shift + C</kbd>
                    </li>
                </ul>

                <h3 className="text-sm font-semibold text-[var(--neon-blue)] uppercase tracking-widest border-b border-[#333] pb-1 mt-6">
                    Global Kısayollar
                </h3>
                <ul className="space-y-2 text-sm text-[#ddd]">
                    <li className="flex justify-between group">
                        <span>Bu Yardım Sayfası</span>
                        <kbd className="bg-[#333] border border-[#555] rounded px-2 py-0.5 text-xs text-white group-hover:border-[var(--neon-blue)] transition-colors">Alt + F1</kbd>
                    </li>
                    <li className="flex justify-between group">
                        <span>Odak (Focus) Değiştir / Sonraki Sayfa</span>
                        <kbd className="bg-[#333] border border-[#555] rounded px-2 py-0.5 text-xs text-white group-hover:border-[var(--neon-blue)] transition-colors">F6</kbd>
                    </li>
                    <li className="flex justify-between group">
                        <span>Geçerli İletiyi / Hatayı Oku</span>
                        <kbd className="bg-[#333] border border-[#555] rounded px-2 py-0.5 text-xs text-white group-hover:border-[var(--neon-blue)] transition-colors">Alt + R</kbd>
                    </li>
                </ul>
            </div>

            <div className="mt-8 text-center text-[11px] text-[#888] font-mono select-none">
                "Bir uygulamadan daha fazlası; CorexAI."
            </div>
        </dialog>
    );
};
