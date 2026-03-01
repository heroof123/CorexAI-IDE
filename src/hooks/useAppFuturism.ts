import { useEffect } from "react";
import { getAutonomyConfig } from "../services/ai/autonomy";
import { futureImpactAnalyzer } from "../services/futureImpactAnalyzer";
import { codeDnaSplicing } from "../services/codeDnaSplicing";
import { quantumCodeSuperposition } from "../services/quantumCodeSuperposition";
import { babelEngine } from "../services/babelEngine";
import { legacyWhisperer } from "../services/legacyWhisperer";
import { synestheticCodeView } from "../services/synestheticCodeView";
import { zeroLatencyCompilation } from "../services/zeroLatencyCompilation";
import { blackholeGarbageCollector } from "../services/blackholeGarbageCollector";
// codeOracle removed per user request (2 year old prediction thing)

export function useAppFuturism(
    selectedFile: string | null,
    fileContent: string | undefined,
    notify: (type: "success" | "error" | "warning" | "info", title: string, message: string) => void
) {
    useEffect(() => {
        const checkAutonomyMode = () => {
            const config = getAutonomyConfig();
            const isFullAuto = config.level >= 4;

            futureImpactAnalyzer.setEnabled(isFullAuto || true);
            codeDnaSplicing.setEnabled(isFullAuto || true);
            quantumCodeSuperposition.setEnabled(isFullAuto || true);
            babelEngine.setEnabled(isFullAuto || true);
            legacyWhisperer.setEnabled(isFullAuto || true);
            synestheticCodeView.setEnabled(isFullAuto || true);
            zeroLatencyCompilation.setEnabled(isFullAuto || true);
            blackholeGarbageCollector.setEnabled(isFullAuto, (msg) => notify("info", "🗑️ Blackhole GC", msg));

            if (isFullAuto) {
                console.log("🚀 Tam Otomasyon (Full Auto) aktif! Fütüristik ürünler devrede.");
            }
        };

        checkAutonomyMode();
        window.addEventListener('storage', checkAutonomyMode);
        return () => window.removeEventListener('storage', checkAutonomyMode);
    }, [notify]);

    useEffect(() => {
        if (selectedFile && fileContent !== undefined) {
            // Speculative background compilation
            zeroLatencyCompilation.onCodeChange(selectedFile, fileContent);
        }
    }, [selectedFile, fileContent]);
}
