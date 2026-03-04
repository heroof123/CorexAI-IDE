import { IHoverParticipant, HoverPart } from './HoverParticipant';
import { MarkdownHoverParticipant } from './markdownHoverParticipant';
import { MarkerHoverParticipant } from './markerHoverParticipant';
import { AIHoverParticipant } from './aiHoverParticipant';

export class ContentHoverController {
    private static instance: ContentHoverController;
    private participants: IHoverParticipant[] = [];

    private constructor() {
        this.participants = [
            new MarkerHoverParticipant(), // High priority: Errors & Diagnostics
            new MarkdownHoverParticipant(), // Standard LSP documentation
            new AIHoverParticipant() // AI fallback or enrichment
        ];
    }

    public static getInstance(): ContentHoverController {
        if (!ContentHoverController.instance) {
            ContentHoverController.instance = new ContentHoverController();
        }
        return ContentHoverController.instance;
    }

    public async provideCombinedHover(model: any, position: any): Promise<HoverPart[]> {
        const results: HoverPart[] = [];
        // Query all participants parallelly to fetch the combined hover payload fast.
        // Timeout mechanism could be implemented here so slow agents don't block.
        const promises = this.participants.map(p =>
            p.provideHover(model, position).catch((error) => {
                console.error(`Hover provider ${p.name} failed`, error);
                return null;
            })
        );

        const hovers = await Promise.all(promises);

        hovers.forEach(h => {
            if (h) results.push(h);
        });

        return results;
    }
}

export const contentHoverController = ContentHoverController.getInstance();
