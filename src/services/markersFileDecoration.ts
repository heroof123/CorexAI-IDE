import { markersService, MarkerInfo } from './markersService';

export interface FileDecoration {
    color?: string;       // Hex renk veya css sınıfı ('#ef4444')
    badge?: string;       // Rozette ne yazacak ('1', 'E')
    tooltip?: string;     // Hover olunca gelen mesaj
}

class MarkersFileDecorationService {
    private static instance: MarkersFileDecorationService;

    private constructor() { }

    public static getInstance(): MarkersFileDecorationService {
        if (!MarkersFileDecorationService.instance) {
            MarkersFileDecorationService.instance = new MarkersFileDecorationService();
        }
        return MarkersFileDecorationService.instance;
    }

    /**
     * Markers verisine göre dosyanın ağaç (TreeView) içindeki rengini veya rozetini(badge) verir
     * 
     * @param filePath Dosya konumu
     */
    public getFileDecoration(filePath: string): FileDecoration | null {
        const markers = markersService.getMarkers(filePath);

        if (markers.length === 0) return null;

        // Hata sıralaması: Error > Warning > Info > Hint
        const sorted = [...markers].sort((a, b) => {
            const w = { error: 4, warning: 3, info: 2, hint: 1 };
            return w[b.severity] - w[a.severity];
        });

        const highestSeverity = sorted[0].severity;
        const errorCount = markers.filter(m => m.severity === 'error').length;
        const warningCount = markers.filter(m => m.severity === 'warning').length;

        let totalCount = 0;
        let badgeStr = '';
        let color = '';

        if (highestSeverity === 'error') {
            totalCount = errorCount;
            badgeStr = totalCount.toString();
            color = '#ef4444'; // Red
        } else if (highestSeverity === 'warning') {
            totalCount = warningCount;
            badgeStr = totalCount.toString();
            color = '#eab308'; // Yellow
        } else if (highestSeverity === 'info') {
            totalCount = markers.filter(m => m.severity === 'info').length;
            badgeStr = 'i';
            color = '#3b82f6'; // Blue
        } else {
            badgeStr = '•';
            color = '#9ca3af'; // Gray
        }

        return {
            color,
            badge: badgeStr,
            tooltip: `${errorCount} hata, ${warningCount} uyarı bulundu.`,
        };
    }
}

export const markersFileDecoration = MarkersFileDecorationService.getInstance();
