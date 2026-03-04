import { IHoverParticipant, HoverPart } from './HoverParticipant';
import { markersService } from '../markersService';

export class MarkerHoverParticipant implements IHoverParticipant {
    name = "Markers (Errors/Warnings)";

    async provideHover(model: any, position: any): Promise<HoverPart | null> {
        // model.uri.path might not exist depending on how Monaco provides it; a simple fallback is used.
        const filePath = model.uri ? model.uri.path.replace(/^\\/ /, '') : '';
        const markers = markersService.getMarkers(filePath);

        const currentLineMarkers = markers.filter(m => m.line === position.lineNumber);

        if (currentLineMarkers.length > 0) {
            const markerContent = currentLineMarkers.map(m => {
                let icon = 'ℹ️';
                if (m.severity === 'error') icon = '🔴';
                else if (m.severity === 'warning') icon = '⚠️';
                else if (m.severity === 'hint') icon = '💡';

                return `${icon} **${m.severity.toUpperCase()}**: ${m.message}`;
            }).join('\\n\\n');

            return {
                content: markerContent,
                isMarkdown: true,
                source: this.name
            };
        }
        return null; // Return null if there are no errors on this line
    }
}
