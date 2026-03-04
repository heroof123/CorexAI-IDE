import { useState } from 'react';

export interface McpToolCallRequest {
    messageId: string;
    serverName: string;
    toolName: string;
    arguments: any;
    onApprove: () => void;
    onDeny: () => void;
}

interface McpToolCallUIProps {
    request: McpToolCallRequest;
}

export function McpToolCallUI({ request }: McpToolCallUIProps) {
    const [status, setStatus] = useState<'pending' | 'approved' | 'denied'>('pending');

    const handleApprove = () => {
        setStatus('approved');
        request.onApprove();
    };

    const handleDeny = () => {
        setStatus('denied');
        request.onDeny();
    };

    return (
        <div className="bg-[#1e1e1e] border border-blue-500/30 rounded-lg p-3 my-2 text-sm max-w-lg shadow-sm">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-neutral-700/50">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
                <div className="font-semibold text-neutral-300">Tool Kullanım İsteği</div>
            </div>

            <div className="flex gap-2 text-xs mb-3 text-neutral-400">
                <div className="bg-[#2d2d2d] px-2 py-1 rounded inline-flex border border-neutral-700">
                    <span className="text-neutral-500 mr-1">Sunucu:</span>
                    <span className="text-blue-400 font-mono">{request.serverName}</span>
                </div>
                <div className="bg-[#2d2d2d] px-2 py-1 rounded inline-flex border border-neutral-700">
                    <span className="text-neutral-500 mr-1">Fonksiyon:</span>
                    <span className="text-blue-400 font-mono">{request.toolName}</span>
                </div>
            </div>

            <div className="bg-[#0f0f0f] rounded p-2 mb-3 border border-neutral-800 font-mono text-[11px] overflow-x-auto text-green-400">
                {JSON.stringify(request.arguments, null, 2)}
            </div>

            <div className="flex justify-end gap-2 text-xs">
                {status === 'pending' ? (
                    <>
                        <button
                            onClick={handleDeny}
                            className="px-4 py-1.5 rounded transition-colors text-red-400 hover:bg-neutral-800 border border-transparent hover:border-red-500/30"
                        >
                            Reddet
                        </button>
                        <button
                            onClick={handleApprove}
                            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
                        >
                            İzin Ver
                        </button>
                    </>
                ) : (
                    <div className={`px-3 py-1.5 rounded ${status === 'approved' ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10'} font-medium`}>
                        {status === 'approved' ? ' İzin Verildi' : ' Reddedildi'}
                    </div>
                )}
            </div>
        </div>
    );
}
