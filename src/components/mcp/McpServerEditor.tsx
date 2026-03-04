import { useState, FormEvent } from 'react';
import { mcpRegistry } from '../../services/mcp/mcpRegistry';

export function McpServerEditor() {
    const [name, setName] = useState('');
    const [command, setCommand] = useState('');
    const [args, setArgs] = useState('');

    // Basit bir arayüzle sunucu ekleme
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (!name || !command) return;

        // Split args by space (naive)
        const parsedArgs = args.split(' ').filter(a => a.trim().length > 0);

        mcpRegistry.register({
            name,
            command,
            args: parsedArgs
        });

        // Reset
        setName('');
        setCommand('');
        setArgs('');
    };

    return (
        <div className="bg-[#252526] p-4 rounded-md border border-neutral-700/50 shadow-md">
            <h3 className="text-xs font-semibold text-neutral-300 mb-3 tracking-wide flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                YENİ SUNUCU EKLE
            </h3>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col">
                    <label className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Sunucu Adı (Örn: sqlite-mcp)</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-[#1e1e1e] border border-neutral-700 rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-blue-500/50 transition-colors"
                        placeholder="my-server"
                        required
                    />
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Komut (Örn: npx)</label>
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        className="bg-[#1e1e1e] border border-neutral-700 rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-blue-500/50 transition-colors"
                        placeholder="npx"
                        required
                    />
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Argümanlar (Örn: -y @modelcontextprotocol/server-sqlite)</label>
                    <input
                        type="text"
                        value={args}
                        onChange={(e) => setArgs(e.target.value)}
                        className="bg-[#1e1e1e] border border-neutral-700 rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-blue-500/50 transition-colors"
                        placeholder="-y @modelcontextprotocol/server-sqlite"
                    />
                </div>

                <button
                    type="submit"
                    className="mt-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs py-2 rounded transition-colors shadow"
                >
                    Kaydet
                </button>
            </form>
        </div>
    );
}
