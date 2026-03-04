import { useState, useEffect } from 'react';
import { colorProviderService } from '../../services/colorPicker/colorProviderService';
import { AIColorRecommendation } from '../../services/colorPicker/aiColorPalette';

interface ColorPickerWidgetProps {
    initialColor: string;
    onColorSelect: (colorHex: string) => void;
    onClose: () => void;
    position: { top: number, left: number } | null;
}

export const ColorPickerWidget = ({ initialColor, onColorSelect, onClose, position }: ColorPickerWidgetProps) => {
    const [color, setColor] = useState(initialColor);
    const [recommendations, setRecommendations] = useState<AIColorRecommendation[]>([]);

    useEffect(() => {
        // As soon as widget opens or color changes, calculate AI's reaction
        const recs = colorProviderService.getCorexAIRecommendations(color);
        setRecommendations(recs);
    }, [color]);

    if (!position) return null;

    return (
        <div
            className="fixed z-[60] bg-[#1a1a1c] border border-[var(--neon-blue)] shadow-[0_0_20px_rgba(0,243,255,0.15)] rounded-lg overflow-hidden flex flex-col w-[320px] animate-fade-in"
            style={{ top: position.top, left: position.left }}
        >
            {/* Header - CorexAI Branding */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#333] bg-gradient-to-r from-black to-[#0a0a0c]">
                <div className="flex items-center gap-2">
                    <span className="text-[14px] animate-pulse">✨</span>
                    <span className="text-[12px] font-bold tracking-widest text-[#00f3ff] uppercase drop-shadow-[0_0_5px_rgba(0,243,255,0.5)]">CorexAI Palette</span>
                </div>
                <button
                    onClick={onClose}
                    className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                    ✕
                </button>
            </div>

            {/* Central Basic Picker Mock (HTML input color type) */}
            <div className="p-4 flex flex-col gap-3 bg-[#131315]">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded border-2 border-[#333] shadow-inner" style={{ backgroundColor: color }}></div>
                    <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[10px] text-gray-500 font-mono">SELECTED HEX</label>
                        <input
                            type="text"
                            className="bg-[#222] border border-[#444] rounded px-2 py-1 text-xs text-white uppercase font-bold focus:outline-none focus:border-[var(--neon-purple)]"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                        />
                    </div>
                </div>

                <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full h-8 cursor-crosshair rounded bg-transparent opacity-0 absolute top-0 left-0" // The native picker handles deep hue/sat, placed over something or replaced with a canvas later.
                    style={{ position: 'relative', opacity: 1 }}
                />

                <button
                    onClick={() => {
                        onColorSelect(color);
                        onClose();
                    }}
                    className="w-full bg-gradient-to-r from-[#00f3ff]/20 to-[#b534ff]/20 border border-[var(--neon-purple)] hover:from-[#00f3ff]/40 hover:to-[#b534ff]/40 text-white font-bold text-xs py-1.5 rounded transition-all shadow-[0_0_10px_rgba(181,52,255,0.2)]"
                >
                    UYGULA
                </button>
            </div>

            {/* AI Recommendations Area */}
            {recommendations.length > 0 && (
                <div className="p-3 bg-[#1a1a1c] border-t border-[#333] overflow-y-auto max-h-[150px]">
                    <div className="text-[10px] text-gray-500 font-mono mb-2 uppercase tracking-wider text-center">CorexAI Harmonisi (Otonom)</div>

                    <div className="flex flex-col gap-3">
                        {recommendations.map((rec, idx) => (
                            <div key={idx} className="flex flex-col gap-1.5 group">
                                <span className="text-[11px] font-semibold text-[#ccc] group-hover:text-white transition-colors">{rec.role}</span>
                                <span className="text-[9px] text-gray-500 leading-tight">{rec.description}</span>

                                <div className="flex items-center gap-1 mt-1">
                                    {rec.colors.map((c, i) => (
                                        <div
                                            key={i}
                                            className="w-6 h-6 rounded cursor-pointer border border-[#333] hover:scale-110 hover:border-white transition-all shadow-md"
                                            style={{ backgroundColor: c }}
                                            title={c}
                                            onClick={() => setColor(c)} // AI'ın önerdiği renge tıklandığında üsttekini günceller
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
