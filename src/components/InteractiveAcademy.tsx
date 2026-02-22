export default function InteractiveAcademy() {
    return (
        <div className="h-full flex flex-col bg-[var(--color-surface)] p-4 items-center justify-center">
            <h2 className="text-xl font-bold mb-2">🎓 Interactive Learning Mode (Academy)</h2>
            <p className="text-sm text-neutral-400 text-center mb-6">
                Senin yazdığın kodlara baka baka sana "daha iyisi şöyle yazılırdı" diyerek<br />
                editör içinde seni eğiten yeni nesil Eğitim Asistanı.
            </p>
            <div className="flex gap-4">
                <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded text-white text-xs font-bold transition-colors">
                    Adım Adım Rust Öğren
                </button>
                <button className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded text-white text-xs font-bold transition-colors">
                    Kodumu Daha Basit Anlat
                </button>
            </div>
        </div>
    )
}
