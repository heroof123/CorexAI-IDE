import { describe, it, expect, vi, beforeEach } from 'vitest';
import { accessibilitySignalService, CorexAudioSignal } from '../accessibilitySignalService';

describe('AccessibilitySignalService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('should announce text using aria-live region', () => {
        document.body.innerHTML = '<div id="corex-aria-live"></div>';

        accessibilitySignalService.announce('Alert to screen reader!');

        const region = document.getElementById('corex-aria-live');
        expect(region?.textContent).toBe('Alert to screen reader!');
    });

    it('should fall back if aria live region is missing', () => {
        expect(() => accessibilitySignalService.announce('No region')).not.toThrow();
    });

    it('should play defined signals without breaking', () => {
        // Mock web audio API if accessible
        const playMock = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('Audio', vi.fn().mockImplementation(() => ({
            play: playMock,
            volume: 1
        })));

        expect(() => accessibilitySignalService.playSignal(CorexAudioSignal.SUCCESS)).not.toThrow();
        expect(() => accessibilitySignalService.playSignal(CorexAudioSignal.WARNING)).not.toThrow();
        expect(() => accessibilitySignalService.playSignal(CorexAudioSignal.ERROR)).not.toThrow();
    });
});
