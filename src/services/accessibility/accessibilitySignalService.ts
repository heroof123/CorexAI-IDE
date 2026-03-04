export enum CorexAudioSignal {
    ERROR = 'error.mp3',
    WARNING = 'warning.mp3',
    SUCCESS = 'success.mp3',
    FOCUS_CHANGED = 'focus.mp3',
    AI_SUGGESTION_READY = 'ai_chime.mp3',
    TERMINAL_COMOLETED = 'terminal_done.mp3'
}

class AccessibilitySignalService {
    private isAudioEnabled: boolean = true;
    private audioContext: AudioContext | null = null;

    // Basit bir sentetik ses oynatıcı mock'u.
    // İleride tarayıcıdan ya da Tauri üzerinden fiziksel mp3 çalabilir.
    private playSynthBeep(freq: number, type: OscillatorType, duration: number) {
        if (!this.isAudioEnabled) return;

        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch (e) {
                console.warn("AudioContext not supported");
                return;
            }
        }

        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);

        // Ses patlamalarını önlemek için fade in/out
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

        osc.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        osc.start();
        osc.stop(this.audioContext.currentTime + duration);
    }

    public toggleAudioSignals(enabled: boolean) {
        this.isAudioEnabled = enabled;
        if (enabled) {
            this.playSignal(CorexAudioSignal.SUCCESS);
            this.announce("Sesli geribildirimler aktifleştirildi.");
        } else {
            this.announce("Sesli geribildirimler kapatıldı.");
        }
    }

    public playSignal(signal: CorexAudioSignal) {
        // Mocking signals with different frequencies
        switch (signal) {
            case CorexAudioSignal.ERROR:
                this.playSynthBeep(200, 'sawtooth', 0.4);
                break;
            case CorexAudioSignal.WARNING:
                this.playSynthBeep(400, 'square', 0.2);
                break;
            case CorexAudioSignal.SUCCESS:
                this.playSynthBeep(800, 'sine', 0.3);
                break;
            case CorexAudioSignal.FOCUS_CHANGED:
                this.playSynthBeep(1200, 'sine', 0.1);
                break;
            case CorexAudioSignal.AI_SUGGESTION_READY:
                // AI "sihirli" hissettiren bir zil
                this.playSynthBeep(1600, 'triangle', 0.1);
                setTimeout(() => this.playSynthBeep(2200, 'sine', 0.3), 100);
                break;
            default:
                this.playSynthBeep(440, 'sine', 0.1);
        }
    }

    /**
     * Bu metot ARIA-live bölgesine yazı yazarak ekran okuyucularının
     * (Screen Readers = NVDA, JAWS, VoiceOver) anında konuşmasını sağlar.
     */
    public announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
        const liveRegion = document.getElementById(`corex-aria-live-${priority}`);
        if (liveRegion) {
            // Her seferinde ekran okuyucuyu tetiklemek için ufak bir boşluk trick'i
            liveRegion.textContent = '';
            setTimeout(() => {
                liveRegion.textContent = message;
            }, 50);
        } else {
            console.warn(`Aria live region NOT FOUND for ${priority}. Message was: ${message}`);
        }
    }
}

export const accessibilitySignalService = new AccessibilitySignalService();
