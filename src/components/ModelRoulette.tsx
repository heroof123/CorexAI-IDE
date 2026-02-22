export default function ModelRoulette() {
    return (
        <div className="h-full flex flex-col bg-[var(--color-surface)] p-4 items-center justify-center">
            <h2 className="text-xl font-bold mb-2">🤖 Multi-LLM Arena (Roulette)</h2>
            <p className="text-sm text-neutral-400 text-center mb-6">
                Aynı promptu arkada GPT-4, Claude ve Gemini'ye (veya yerel modellere) aynı anda yollayıp,<br />
                en iyi cevabı seçtirecek sistem aktif ediliyor...
            </p>
            <div className="flex gap-4">
                <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg animate-pulse">Model A</div>
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg animate-pulse delay-100">Model B</div>
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg animate-pulse delay-200">Model C</div>
            </div>
        </div>
    )
}
