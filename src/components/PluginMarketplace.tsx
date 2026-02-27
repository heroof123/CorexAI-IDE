// src/components/PluginMarketplace.tsx
import { useState } from "react";
import { usePlugins, MarketplacePlugin } from "../hooks/usePlugins";
import LoadingSpinner from "./LoadingSpinner";
import { vscodeService } from "../services/vscodeService";
import { Code, Palette, Import, Terminal } from "lucide-react";

export default function PluginMarketplace() {
    const { marketplacePlugins, loading, togglePlugin, refreshPlugins } = usePlugins();
    const [activeTab, setActiveTab] = useState<"browse" | "installed" | "vscode">("browse");
    const [vscodeJson, setVscodeJson] = useState("");
    const [importLog, setImportLog] = useState("");

    const installedCount = marketplacePlugins.filter(p => p.installed).length;

    return (
        <div className="h-full flex flex-col bg-[var(--color-background)] overflow-hidden">
            {/* Header Section */}
            <div className="p-6 border-b border-white/5 bg-white/2 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black tracking-tighter text-white flex items-center gap-2">
                            <span className="text-blue-500">🧩</span> Corex Marketplace
                        </h1>
                        <p className="text-xs text-neutral-500 mt-1 uppercase tracking-widest font-medium">
                            Genişletilebilir AI Ekosistemi
                        </p>
                    </div>
                    <button
                        onClick={refreshPlugins}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors group"
                        title="Yenile"
                    >
                        <span className="group-hover:rotate-180 transition-transform duration-500 block text-lg">🔄</span>
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1 p-1 bg-black/20 rounded-xl w-fit border border-white/5">
                    <button
                        onClick={() => setActiveTab("browse")}
                        className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "browse"
                            ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                            : "text-neutral-500 hover:text-white"
                            }`}
                    >
                        Mağazada Keşfet
                    </button>
                    <button
                        onClick={() => setActiveTab("installed")}
                        className={`px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "installed"
                            ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                            : "text-neutral-500 hover:text-white"
                            }`}
                    >
                        Yüklü Olanlar
                        <span className="px-1.5 py-0.5 bg-black/30 rounded text-[10px]">{installedCount}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("vscode")}
                        className={`px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "vscode"
                            ? "bg-orange-600 text-white shadow-lg shadow-orange-500/20"
                            : "text-neutral-500 hover:text-white"
                            }`}
                    >
                        <Import size={12} /> VS Code İçe Aktar
                    </button>
                </div>
            </div>

            {activeTab === "vscode" ? (
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 animate-in fade-in duration-300">
                    <div className="bg-orange-600/10 border border-orange-500/20 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            <Code className="text-orange-500" /> VS Code Eklenti Dönüştürücü
                        </h2>
                        <p className="text-sm text-neutral-400 mb-6">
                            Pazaryerinde bulamadığın bir tema mı var? VS Code Theme JSON'ını aşağıya yapıştır, <br />
                            CorexAI'a anında entegre edelim.
                        </p>

                        <textarea
                            value={vscodeJson}
                            onChange={(e) => setVscodeJson(e.target.value)}
                            placeholder='{ "name": "My VS Theme", "colors": { "editor.background": "#1e1e1e", ... } }'
                            className="w-full h-48 bg-black/40 border border-white/5 rounded-xl p-4 text-xs font-mono text-orange-200 outline-none focus:border-orange-500/50 transition-all mb-4"
                        />

                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    try {
                                        const json = JSON.parse(vscodeJson);
                                        const msg = vscodeService.importTheme(json);
                                        setImportLog(msg);
                                    } catch (e) {
                                        setImportLog("❌ Geçersiz JSON formatı.");
                                    }
                                }}
                                className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                            >
                                <Palette size={14} /> Temayı Uygula
                            </button>
                            <button
                                onClick={() => {
                                    try {
                                        const json = JSON.parse(vscodeJson);
                                        const msg = vscodeService.importSnippets(json);
                                        setImportLog(msg);
                                    } catch (e) {
                                        setImportLog("❌ Geçersiz JSON formatı.");
                                    }
                                }}
                                className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                            >
                                <Terminal size={14} /> Snippetları Yükle
                            </button>
                        </div>

                        {importLog && (
                            <div className={`mt-6 p-4 rounded-xl text-xs font-medium animate-in zoom-in-95 ${importLog.startsWith('✅') ? 'bg-green-600/10 text-green-400 border border-green-500/20' : 'bg-red-600/10 text-red-400 border border-red-500/20'}`}>
                                {importLog}
                            </div>
                        )}
                    </div>

                    <div className="bg-white/5 border border-white/5 rounded-2xl p-6 opacity-60">
                        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Desteklenen VS Code Özellikleri</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-black/20 rounded-lg text-[10px]">✅ Editor/Sidebar Colors</div>
                            <div className="p-3 bg-black/20 rounded-lg text-[10px]">✅ Text Snippets</div>
                            <div className="p-3 bg-black/20 rounded-lg text-[10px]">⏳ Full LSP (Yakında)</div>
                            <div className="p-3 bg-black/20 rounded-lg text-[10px]">⏳ Terminal Themes (Yakında)</div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {loading ? (
                        <div className="h-64 flex items-center justify-center">
                            <LoadingSpinner size="lg" text="Eklentiler taranıyor..." />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {marketplacePlugins
                                .filter(p => activeTab === "installed" ? p.installed : true)
                                .map((plugin) => (
                                    <PluginCard
                                        key={plugin.id}
                                        plugin={plugin}
                                        onToggle={togglePlugin}
                                    />
                                ))}
                        </div>
                    )}

                    {!loading && marketplacePlugins.filter(p => activeTab === "installed" ? p.installed : true).length === 0 && (
                        <div className="h-64 flex flex-col items-center justify-center text-center opacity-50">
                            <div className="text-4xl mb-4">🏜️</div>
                            <p className="text-sm">Burada henüz bir eklenti yok.</p>
                            {activeTab === "installed" && (
                                <button
                                    onClick={() => setActiveTab("browse")}
                                    className="mt-4 text-xs text-blue-400 hover:underline"
                                >
                                    Mağazaya göz at
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Footer Info */}
            <div className="p-4 border-t border-white/5 bg-white/1 text-[10px] text-neutral-600 flex justify-between items-center italic">
                <span>* Beta sürümünde sadece yerel eklentiler desteklenir.</span>
                <span className="not-italic text-blue-500/50 hover:text-blue-500 cursor-pointer transition-colors">Geliştirici Dokümantasyonu →</span>
            </div>
        </div>
    );
}

function PluginCard({ plugin, onToggle }: { plugin: MarketplacePlugin, onToggle: (id: string, active: boolean) => void }) {
    return (
        <div className="glass-card p-5 group hover:border-blue-500/30 transition-all duration-300 relative overflow-hidden flex flex-col h-full">
            {/* Background Glow */}
            <div className={`absolute -top-10 -right-10 w-24 h-24 blur-[60px] opacity-0 group-hover:opacity-30 transition-opacity duration-500 ${plugin.category === "Theme" ? "bg-purple-500" : "bg-blue-500"
                }`} />

            <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/5">
                    {plugin.icon}
                </div>
                <div className="flex flex-col items-end">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10 ${plugin.category === "Theme" ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"
                        }`}>
                        {plugin.category}
                    </span>
                    <span className="text-[10px] text-neutral-600 mt-1 font-mono">v{plugin.version}</span>
                </div>
            </div>

            <div className="flex-1">
                <h3 className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{plugin.name}</h3>
                <p className="text-xs text-neutral-500 mt-2 line-clamp-2 leading-relaxed">
                    {plugin.description}
                </p>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-white/5">
                <div className="flex flex-col">
                    <span className="text-[9px] text-neutral-600 uppercase font-bold tracking-tighter">Geliştirici</span>
                    <span className="text-[10px] text-neutral-400 font-medium">{plugin.author}</span>
                </div>

                {plugin.installed ? (
                    <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg">
                        <button
                            onClick={() => onToggle(plugin.id, !plugin.active)}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${plugin.active
                                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                : "bg-neutral-500/20 text-neutral-400 hover:bg-neutral-500/30"
                                }`}
                        >
                            {plugin.active ? "AKTİF" : "DEVRE DIŞI"}
                        </button>
                    </div>
                ) : (
                    <button
                        className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-[11px] font-bold shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                    >
                        YÜKLE
                    </button>
                )}
            </div>
        </div>
    );
}
