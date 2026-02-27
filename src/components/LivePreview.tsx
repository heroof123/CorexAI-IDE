import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface LivePreviewProps {
    code: string;
    className?: string;
    showControls?: boolean;
}

const LivePreview: React.FC<LivePreviewProps> = ({ code, className = "", showControls = true }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

    const viewportWidths = {
        desktop: '100%',
        tablet: '768px',
        mobile: '375px'
    };

    useEffect(() => {
        if (iframeRef.current) {
            const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
            if (doc) {
                // Injecting the code with a basic setup (Tailwind CDN for quick demoing)
                doc.open();
                doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                body { font-family: sans-serif; margin: 0; padding: 1rem; background: transparent; }
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
                ::-webkit-scrollbar-thumb:hover { background: #444; }
              </style>
            </head>
            <body>
              <div id="root">${code}</div>
            </body>
          </html>
        `);
                doc.close();
            }
        }
    }, [code]);

    return (
        <div className={`flex flex-col h-full w-full bg-[#1e1e1e] rounded-xl border border-neutral-800 overflow-hidden ${className}`}>
            {showControls && (
                <div className="flex items-center justify-between p-3 border-b border-neutral-800 bg-[#252525]/50 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1.5 mr-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/80" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                            <div className="w-3 h-3 rounded-full bg-green-500/80" />
                        </div>
                        <span className="text-xs font-medium text-neutral-400">Live Preview</span>
                    </div>

                    <div className="flex bg-black/30 rounded-lg p-1">
                        {(['desktop', 'tablet', 'mobile'] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => setViewport(v)}
                                className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold transition-all ${viewport === v ? 'bg-blue-600 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'
                                    }`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-auto p-4 flex justify-center bg-[#0f0f0f] bg-[radial-gradient(#222_1px,transparent_1px)] [background-size:20px_20px]">
                <motion.div
                    layout
                    animate={{ width: viewportWidths[viewport] }}
                    className="h-full bg-white rounded-lg shadow-2xl relative overflow-hidden"
                >
                    <iframe
                        ref={iframeRef}
                        title="Live Preview Content"
                        className="w-full h-full border-none"
                        sandbox="allow-scripts"
                    />
                </motion.div>
            </div>
        </div>
    );
};

export default LivePreview;
