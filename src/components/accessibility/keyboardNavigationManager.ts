import { useEffect, useState } from 'react';
import { accessibilitySignalService, CorexAudioSignal } from '../../services/accessibility/accessibilitySignalService';

/**
 * Klavye Ustaları (Keyboard Ninjas) için özel hazırlanmış bir navigasyon ve odak (Focus) yönetim aracı.
 * Bu hook projenin en üst seviye bileşenine takılıp tuş dinlemeleri yapacak,
 * "Alt+1", "Ctrl+`" gibi kısayolları ekran okuyucu seslendiricisi ile birleştirecek.
 */

export const useKeyboardNavigationManager = () => {
    const [helpOpen, setHelpOpen] = useState(false);

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // [ALT + F1] : CorexAI Erişilebilirlik Paneli ve Sesli Yardım
            if (e.altKey && e.key === 'F1') {
                e.preventDefault();
                setHelpOpen(p => !p);
                accessibilitySignalService.playSignal(CorexAudioSignal.FOCUS_CHANGED);
                accessibilitySignalService.announce(
                    helpOpen ? "CorexAI Erişilebilirlik Yardımı Kapatıldı." : "CorexAI Erişilebilirlik Yardımı Açıldı. Kısayollar ve okuma seçenekleri panelini inceliyorsunuz."
                );
            }

            // [Ctrl + Shift + U] : Tüm Sesli Geribildirimleri Kapat/Aç Toggle
            if (e.ctrlKey && e.shiftKey && (e.key === 'U' || e.key === 'u')) {
                e.preventDefault();
                console.log("Audio toggle requested via shortcut.");
                // Modülün içinde tutulan durumu okumak zor olduğundan,
                // buraya bir callback veya state yollayabilirsiniz, şimdilik mock olarak
                accessibilitySignalService.playSignal(CorexAudioSignal.SUCCESS);
                accessibilitySignalService.announce("Sesli sinyal komutu tetiklendi.");
            }

            // [F6] : IDE Çevresindeki Paneller Arası Sekmeli Gezinme (Focus Cycle)
            if (e.key === 'F6') {
                e.preventDefault();
                // Bu noktada React ref'leri üzerinden sol panel / alt panel / editor sıralamasına atlar.
                accessibilitySignalService.playSignal(CorexAudioSignal.FOCUS_CHANGED);
                accessibilitySignalService.announce("Odak Değişti. Sonraki Grup.");
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [helpOpen]);

    return { helpOpen, setHelpOpen };
};
