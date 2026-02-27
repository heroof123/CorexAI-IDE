/**
 * Voice Control Service
 * Uses Web Speech API to provide voice commands for the IDE.
 */

export type VoiceCommand = 'SAVE' | 'FORMAT' | 'TOGGLE_SIDEBAR' | 'TOGGLE_CHAT' | 'NEW_AGENT' | 'UNKNOWN';

interface CommandMapping {
    phrases: string[];
    command: VoiceCommand;
}

const COMMAND_MAP: CommandMapping[] = [
    { phrases: ['kaydet', 'save', 'dosyayı kaydet'], command: 'SAVE' },
    { phrases: ['formatla', 'düzelt', 'kod formatla'], command: 'FORMAT' },
    { phrases: ['dosyaları gizle', 'dosyaları göster', 'sidebar kapat', 'toggle sidebar'], command: 'TOGGLE_SIDEBAR' },
    { phrases: ['sohbeti kapat', 'sohbeti aç', 'chat kapat', 'toggle chat'], command: 'TOGGLE_CHAT' },
    { phrases: ['yeni ajan', 'ajan başlat', 'new agent'], command: 'NEW_AGENT' },
];

export class VoiceControlService {
    private recognition: any = null;
    private isListening: boolean = false;
    private onCommandCallback: (command: VoiceCommand, transcript: string) => void = () => { };
    private onStatusCallback: (status: 'listening' | 'idle' | 'processing' | 'error') => void = () => { };

    constructor() {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'tr-TR'; // Default to Turkish

            this.recognition.onstart = () => {
                this.isListening = true;
                this.onStatusCallback('listening');
            };

            this.recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript.toLowerCase();
                this.onStatusCallback('processing');
                this.handleResult(transcript);
            };

            this.recognition.onend = () => {
                this.isListening = false;
                this.onStatusCallback('idle');
            };

            this.recognition.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                this.onStatusCallback('error');
                this.isListening = false;
            };
        }
    }

    private handleResult(transcript: string) {
        let detectedCommand: VoiceCommand = 'UNKNOWN';

        for (const mapping of COMMAND_MAP) {
            if (mapping.phrases.some(phrase => transcript.includes(phrase))) {
                detectedCommand = mapping.command;
                break;
            }
        }

        this.onCommandCallback(detectedCommand, transcript);
    }

    public start() {
        if (!this.recognition) return;
        try {
            this.recognition.start();
        } catch (e) {
            console.error('Failed to start speech recognition:', e);
        }
    }

    public stop() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    public onCommand(cb: (command: VoiceCommand, transcript: string) => void) {
        this.onCommandCallback = cb;
    }

    public onStatus(cb: (status: 'listening' | 'idle' | 'processing' | 'error') => void) {
        this.onStatusCallback = cb;
    }

    public isSupported() {
        return !!this.recognition;
    }
}

export const voiceService = new VoiceControlService();
