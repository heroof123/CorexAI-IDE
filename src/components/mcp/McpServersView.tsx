import { useState, useEffect } from 'react';
import { mcpRegistry, RegisteredMcpServer } from '../../services/mcp/mcpRegistry';

export function McpServersView() {
    const [servers, setServers] = useState<RegisteredMcpServer[]>([]);

    useEffect(() => {
        // Initial load
        setServers(mcpRegistry.getServers());

        // Subscribe to updates
        const unsubscribe = mcpRegistry.subscribe((updatedServers) => {
            setServers([...updatedServers]);
        });

        return unsubscribe;
    }, []);

    const toggleServer = (server: RegisteredMcpServer) => {
        if (server.status === 'running') {
            mcpRegistry.stopServer(server.name);
        } else {
            mcpRegistry.startServer(server.name);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-neutral-300 font-sans p-4 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest border-b border-neutral-700/50 pb-2">
                MCP Sunucuları
            </h2>

            <div className="flex flex-col gap-2">
                {servers.length === 0 ? (
                    <div className="text-xs text-neutral-500 italic p-2 bg-neutral-800/20 rounded">
                        Kayıtlı MCP sunucusu bulunamadı. Lütfen "Add Server" ile yeni bir tane ekleyin.
                    </div>
                ) : (
                    servers.map((server) => (
                        <div key={server.name} className="flex flex-col sm:flex-row items-center justify-between p-3 rounded-md bg-[#252526] hover:bg-[#2d2d2d] transition-colors border border-transparent shadow-sm">
                            <div className="flex flex-col">
                                <span className="font-semibold text-[13px] text-blue-400 flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${server.status === 'running' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' :
                                            server.status === 'error' ? 'bg-red-500' : 'bg-neutral-500'
                                        }`} />
                                    {server.name}
                                </span>
                                <span className="text-xs text-neutral-500 mt-0.5 truncate max-w-xs">{server.command} {server.args?.join(" ")}</span>
                            </div>

                            <div className="flex gap-2 items-center mt-2 sm:mt-0">
                                <span className="text-[10px] bg-[#1e1e1e] border border-neutral-700 px-2 py-0.5 rounded text-neutral-400 font-mono hidden sm:block">
                                    {server.status.toUpperCase()}
                                </span>
                                <button
                                    onClick={() => toggleServer(server)}
                                    className={`px-3 py-1 rounded text-xs transition-colors shadow-sm font-medium ${server.status === 'running'
                                            ? 'bg-neutral-800 text-red-400 hover:bg-neutral-700'
                                            : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 border border-blue-500/20'
                                        }`}
                                >
                                    {server.status === 'running' ? 'Durdur' : 'Başlat'}
                                </button>
                                <button
                                    onClick={() => mcpRegistry.deregister(server.name)}
                                    className="p-1 hover:text-red-400 text-neutral-500 transition-colors"
                                    title="Sil"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 6h18M19 6l-1 14H6L5 6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
