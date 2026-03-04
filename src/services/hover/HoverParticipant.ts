export interface HoverPart {
    content: string;
    isMarkdown?: boolean;
    source: string;
}

export interface IHoverParticipant {
    name: string;
    provideHover(model: any, position: any): Promise<HoverPart | null>;
}
