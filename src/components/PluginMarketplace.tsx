export default function PluginMarketplace() {
    return (
        <div className="h-full flex flex-col bg-[var(--color-surface)] p-4 items-center justify-center">
            <h2 className="text-xl font-bold mb-2">🧩 Profil & Eklenti Mağazası (Yakında)</h2>
            <p className="text-sm text-neutral-400 text-center mb-6">
                Sonsuz genişletilebilir Modül & Tema Sistemi yapılıyor.<br />
                Kendi yazdığın eklentileri (AI plugin'leri dahil) buradan tüm dünyaya sunabileceksin!
            </p>
            <div className="flex gap-4">
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">Plugin Marketplace</div>
                <div className="p-4 bg-pink-500/10 border border-pink-500/30 rounded-lg">Theme Studio</div>
            </div>
        </div>
    )
}
