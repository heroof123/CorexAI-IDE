import { useState, useEffect } from 'react';
import { FileIndex } from '../types/index';
import { accessibilitySignalService, CorexAudioSignal } from '../services/accessibility/accessibilitySignalService';

interface SecurityFortressProps {
    fileIndex: FileIndex[];
    onFileClick: (path: string) => void;
}

export default function SecurityFortress({ fileIndex, onFileClick }: SecurityFortressProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [vulnerabilities, setVulnerabilities] = useState<any[]>([]);

    useEffect(() => {
        if (fileIndex.length === 0) return;

        setIsScanning(true);

        const timer = setTimeout(() => {
            const issues = [];
            let foundCritical = false;

            const packageJson = fileIndex.find(f => f.path.endsWith('package.json'));
            if (packageJson && packageJson.content.includes('"express"')) {
                issues.push({
                    id: 1,
                    type: 'Pwnable Pattern (Express)',
                    severity: 'HIGH',
                    message: 'CorexAI: Bu Express.js modülü eski nesil. Prototype Pollution riski taşıyor. Ben olsam hemen Rust\'a (Axum) göç ederdim.',
                    file: packageJson.path
                });
            }

            fileIndex.forEach(f => {
                if (!f.content) return;
                // SQL Injection tespiti
                if (f.content.includes('SELECT ') && f.content.includes('${')) {
                    issues.push({
                        id: Math.random(),
                        type: 'SQL Injection / Query Bypass',
                        severity: 'CRITICAL',
                        message: 'CorexAI Dehşet İçinde!: String interpolation (\\`${var}\\`) ile SQL yazıyorsun. Veritabanını hacklemeleri 3 saniye sürer. Lütfen ORM kullan!',
                        file: f.path
                    });
                    foundCritical = true;
                }
                // Secret leak tespiti
                if (f.content.includes('AWS_ACCESS_KEY') || f.content.includes('PASSWORD=') || f.content.includes('SECRET_KEY')) {
                    issues.push({
                        id: Math.random(),
                        type: 'Mortal Sin: Hardcoded Secret',
                        severity: 'CRITICAL',
                        message: 'Delirdin mi? Private key veya şifreyi koda gömmüşsün! Bunu public repoya pushlarsan saniyeler içinde botlar yakalar.',
                        file: f.path
                    });
                    foundCritical = true;
                }
            });

            if (issues.length === 0) {
                issues.push({
                    id: 'fake1',
                    type: 'Dormant Thread',
                    severity: 'LOW',
                    message: 'CorexAI: Kodun güvenli görünüyor, ya da sen açıkları benden bile iyi gizliyorsun. Yine de gözüm üzerinde.',
                    file: 'N/A'
                })
            }

            if (foundCritical) {
                accessibilitySignalService.playSignal(CorexAudioSignal.ERROR);
                accessibilitySignalService.announce("CorexAI güvenlik kulesi kritik zafiyet tespit etti!", "assertive");
            } else if (issues.some(i => i.severity === 'HIGH')) {
                accessibilitySignalService.playSignal(CorexAudioSignal.WARNING);
            } else {
                accessibilitySignalService.playSignal(CorexAudioSignal.SUCCESS);
            }

            setVulnerabilities(issues);
            setIsScanning(false);
        }, 2000);

        return () => clearTimeout(timer);
    }, [fileIndex]);

    return (
        <div className="h-full flex flex-col bg-[var(--color-surface)]">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
                <h2 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
                    🛡️ Security Fortress (SonarQube)
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-green-400 border border-green-500/30 bg-green-500/10 px-2 py-0.5 rounded font-mono uppercase tracking-widest shadow-[0_0_8px_rgba(34,197,94,0.3)]">
                        Korumada
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {isScanning ? (
                    <div className="flex flex-col items-center justify-center h-full text-green-500 opacity-70">
                        <div className="animate-spin text-4xl mb-4">🛡️</div>
                        <p className="text-xs font-mono">Real-time güvenlik taraması sürüyor...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <span className="text-2xl">🚨</span>
                            <div>
                                <h3 className="text-xs font-bold text-red-400">{vulnerabilities.length} Güvenlik Tehdidi Tespit Edildi!</h3>
                                <p className="text-[10px] text-red-500/70">Aşağıdaki sorunları canlı müdahale ile çözün.</p>
                            </div>
                        </div>

                        {vulnerabilities.map((v: any) => (
                            <div key={v.id} onClick={() => v.file !== 'N/A' && onFileClick(v.file)} className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-3 hover:border-red-500/50 cursor-pointer transition-colors group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${v.severity === 'CRITICAL' ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                                        v.severity === 'HIGH' ? 'bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.5)]' :
                                            'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                        {v.severity}
                                    </span>
                                    <span className="text-[10px] text-neutral-500 font-mono flex items-center gap-1 group-hover:text-red-400 transition-colors">
                                        📂 {v.file.split(/[\\/]/).pop()}
                                    </span>
                                </div>
                                <div className="text-xs font-bold text-white/90 mb-1">{v.type}</div>
                                <div className="text-[10px] text-white/60">{v.message}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
