import { invoke } from '@tauri-apps/api/core';

export interface ReplaceOperation {
    file: string;
    line: number;
    matchStart: number;
    matchEnd: number;
    replacement: string;
}

class ReplaceService {
    private static instance: ReplaceService;

    private constructor() { }

    public static getInstance(): ReplaceService {
        if (!ReplaceService.instance) {
            ReplaceService.instance = new ReplaceService();
        }
        return ReplaceService.instance;
    }

    /**
     * Toplu String Değiştirme ve Diske Kayıt
     */
    public async replaceAll(operations: ReplaceOperation[]): Promise<{ success: boolean; count: number; failedFiles: string[] }> {
        // 1. Dosya bazında grupla
        const fileOperations = new Map<string, ReplaceOperation[]>();

        for (const op of operations) {
            if (!fileOperations.has(op.file)) {
                fileOperations.set(op.file, []);
            }
            fileOperations.get(op.file)!.push(op);
        }

        let count = 0;
        const failedFiles: string[] = [];

        // 2. Her dosyayı belleğe al, değiştir, kaydet
        for (const [file, ops] of fileOperations.entries()) {
            try {
                const content = await invoke<string>('read_file', { path: file });

                // Satırlara ayır ve operasyonları UYGULA
                const lines = content.split('\n');

                // Dikkat: Aynı satırda birden fazla replace varsa index kaymasını önlemek için 
                // sondan başa doğru (matchStart'a göre DESC) uygulamalıyız.
                // Fakat şimdilik basit bir "replace the line parts" mantığı kuracağız:

                // Op'ları satırlara grupla
                const lineOps = new Map<number, ReplaceOperation[]>();
                for (const o of ops) {
                    if (!lineOps.has(o.line)) lineOps.set(o.line, []);
                    lineOps.get(o.line)!.push(o);
                }

                for (const [lineNum, lOps] of lineOps.entries()) {
                    const zeroIndexLine = lineNum - 1;
                    let currentLineStr = lines[zeroIndexLine];

                    // Aynı satırda replace kaymasını önlemek için index'e göre tersten (sağdan sola) değiştirelim
                    lOps.sort((a, b) => b.matchStart - a.matchStart);

                    for (const op of lOps) {
                        const before = currentLineStr.slice(0, op.matchStart);
                        const after = currentLineStr.slice(op.matchEnd);
                        currentLineStr = before + op.replacement + after;
                        count++;
                    }
                    lines[zeroIndexLine] = currentLineStr;
                }

                // 3. Dosyayı diske yaz
                await invoke('write_file', {
                    path: file,
                    content: lines.join('\n')
                });

            } catch (err) {
                console.error(`Replace başarısız: ${file}`, err);
                failedFiles.push(file);
            }
        }

        return { success: failedFiles.length === 0, count, failedFiles };
    }
}

export const replaceService = ReplaceService.getInstance();
