import { useEffect, useState } from 'react';
import { contentHoverController } from '../../services/hover/contentHoverController';
import { HoverPart } from '../../services/hover/HoverParticipant';

// Mock Markdown renderer
const renderSimpleMarkdown = (text: string) => {
    return text.split('\\n').map((line, idx) => {
        let content = line;

        // This is a naive implementation just for visual flair in the mockup
        if (content.startsWith('```')) {
            return <div key={idx} className="bg-[#1e1e1e] p-1.5 rounded text-[#9cdcfe] my-1 font-mono text-[11px] border border-[#333]">Code Block</div>;
        }

        // Basic bold
        if (content.includes('**')) content = content.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
        // Basic code span
        if (content.includes('`')) content = content.replace(/`(.*?)`/g, '<code class="text-[#ce9178] bg-[#1e1e1e] px-1 rounded">$1</code>');

        // Special UI hints from providers
        if (content.startsWith('🔴') || content.startsWith('⚠️')) {
            return <div key={idx} className="font-semibold text-red-400 my-0.5" dangerouslySetInnerHTML={{ __html: content }} />;
        }
        if (content.startsWith('✨')) {
            return <div key={idx} className="text-[#00f3ff] italic my-1" dangerouslySetInnerHTML={{ __html: content }} />;
        }

        return <div key={idx} dangerouslySetInnerHTML={{ __html: content }} className="min-h-[14px] my-0.5" />;
    });
};

interface ContentHoverWidgetProps {
    model: any;
    position: { lineNumber: number; column: number };
    x: number;
    y: number;
    onClose: () => void;
}

export const ContentHoverWidget = ({ model, position, x, y, onClose }: ContentHoverWidgetProps) => {
    const [hovers, setHovers] = useState<HoverPart[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        const fetchHovers = async () => {
            try {
                const results = await contentHoverController.provideCombinedHover(model, position);
                if (isMounted) {
                    setHovers(results);
                    setLoading(false);
                }
            } catch (err) {
                if (isMounted) setLoading(false);
            }
        }

        // Add a slight debounce to prevent flashing while typing/moving cursor
        const timer = setTimeout(fetchHovers, 150);
        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [model, position.lineNumber, position.column]);

    // Don't render empty un-loading widget
    if (!loading && hovers.length === 0) return null;

    return (
        <div
            className="fixed z-50 bg-[#252526] border border-[#454545] rounded shadow-2xl overflow-hidden min-w-[300px] max-w-[450px] text-xs text-[#cccccc] animate-fade-in"
            style={{ left: x, top: y + 25 }}
            onMouseLeave={onClose}
        >
            <div className="flex justify-between items-center bg-[#2d2d30] px-2 py-1.5 border-b border-[#333]">
                <div className="flex items-center gap-1.5">
                    <span className="text-[#cccccc] text-[10px]">🔍</span>
                    <span className="font-semibold text-white/90 text-[11px]">Hover Insight</span>
                </div>
                <button onClick={onClose} className="hover:text-white transition-colors hover:bg-red-500/20 rounded-full w-4 h-4 flex items-center justify-center">×</button>
            </div>

            <div className="p-2 space-y-3 max-h-[350px] overflow-y-auto">
                {loading ? (
                    <div className="flex items-center gap-2 text-gray-400 italic p-3 justify-center">
                        <span className="animate-spin text-[10px]">🌀</span>
                        <span className="text-[11px]">Bağlam taranıyor...</span>
                    </div>
                ) : (
                    hovers.map((hover, idx) => (
                        <div key={idx} className="border-b border-[#333]/50 last:border-0 pb-2 last:pb-0">
                            <div className="text-[9.5px] text-[var(--color-primary)] opacity-80 uppercase tracking-widest font-semibold mb-1">{hover.source}</div>
                            <div className="leading-relaxed">
                                {hover.isMarkdown ? renderSimpleMarkdown(hover.content) : hover.content}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
