import { invoke } from '@tauri-apps/api/core';

export interface ConflictBlock {
    id: string;
    startLine: number;
    endLine: number;
    currentContent: string;
    incomingContent: string;
    baseContent?: string;
    resolvedContent?: string;
    isResolved: boolean;
}

class MergeConflictResolver {
    private static instance: MergeConflictResolver;

    private constructor() { }

    public static getInstance(): MergeConflictResolver {
        if (!MergeConflictResolver.instance) {
            MergeConflictResolver.instance = new MergeConflictResolver();
        }
        return MergeConflictResolver.instance;
    }

    /**
     * Parse Git conflict markers from text
     */
    public parseConflicts(text: string): ConflictBlock[] {
        const lines = text.split('\n');
        const conflicts: ConflictBlock[] = [];

        let inConflict = false;
        let currentBlock: Partial<ConflictBlock> | null = null;
        let state: 'current' | 'base' | 'incoming' | 'none' = 'none';

        let currentAcc: string[] = [];
        let baseAcc: string[] = [];
        let incomingAcc: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('<<<<<<<')) {
                inConflict = true;
                currentBlock = { id: `conflict-${i}`, startLine: i, isResolved: false };
                state = 'current';
                currentAcc = [];
                baseAcc = [];
                incomingAcc = [];
            } else if (line.startsWith('|||||||')) {
                state = 'base';
            } else if (line.startsWith('=======')) {
                state = 'incoming';
            } else if (line.startsWith('>>>>>>>')) {
                if (currentBlock && inConflict) {
                    conflicts.push({
                        id: currentBlock.id as string,
                        startLine: currentBlock.startLine as number,
                        endLine: i,
                        currentContent: currentAcc.join('\n'),
                        baseContent: baseAcc.length > 0 ? baseAcc.join('\n') : undefined,
                        incomingContent: incomingAcc.join('\n'),
                        isResolved: false
                    });
                }
                inConflict = false;
                state = 'none';
                currentBlock = null;
            } else {
                if (inConflict) {
                    if (state === 'current') currentAcc.push(line);
                    else if (state === 'base') baseAcc.push(line);
                    else if (state === 'incoming') incomingAcc.push(line);
                }
            }
        }

        return conflicts;
    }

    /**
     * Tamamen otonom olarak AI'dan dosyayı birleştirmesini ister.
     * Kullanıcı için sadece sonucu üretir.
     */
    public async resolveAutonomously(filePath: string, fileContent: string, conflicts: ConflictBlock[]): Promise<{ resolvedContent: string, allSuccess: boolean }> {
        let resolvedText = fileContent;
        let allSuccess = true;

        for (const conflict of conflicts) {
            try {
                const prompt = `
Otonom Kod Birleştirme Uzmanısın (Merge Resolver).
Dosya: ${filePath}

Aşağıdaki Git çakışmasını, projenin bağlamını düşünerek en optimal biçimde birleştir.
Yalnızca çözülmüş kodu ver. Yorum, markdown backtick (\`\`\`) veya ekstra açıklama YAPMA. Yalnızca KODU ver.

<<<<<<< CURRENT
${conflict.currentContent}
=======
${conflict.incomingContent}
>>>>>>> INCOMING
        `.trim();

                const aiResponse = await invoke<string>('chat_with_specific_ai', {
                    message: prompt,
                    modelType: 'coder'
                });

                // Temizlik (örneğin markdown blokları geldiyse sil)
                let cleanCode = aiResponse.trim();
                if (cleanCode.startsWith('```')) {
                    const lines = cleanCode.split('\n');
                    lines.shift();
                    if (lines[lines.length - 1].startsWith('```')) {
                        lines.pop();
                    }
                    cleanCode = lines.join('\n');
                }

                conflict.resolvedContent = cleanCode;
                conflict.isResolved = true;

                conflict.isResolved = true;

                // Metin içindeki ilgili çakışma bloğunu çözümleyip applyResolutions'ta dönüştüreceğiz
            } catch (err) {
                console.error("AI Merge çözümlemesi başarısız oldu:", err);
                allSuccess = false;
                conflict.isResolved = false;
            }
        }

        // Dosyayı tamamen baştan oluştur
        if (allSuccess) {
            resolvedText = this.applyResolutions(fileContent, conflicts);
        }

        return { resolvedContent: resolvedText, allSuccess };
    }

    private applyResolutions(text: string, conflicts: ConflictBlock[]): string {
        const lines = text.split('\n');
        const result: string[] = [];

        let inConflict = false;
        let activeConflict: ConflictBlock | null = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('<<<<<<<')) {
                inConflict = true;
                activeConflict = conflicts.find(c => c.startLine === i) || null;
                if (activeConflict && activeConflict.isResolved && activeConflict.resolvedContent) {
                    result.push(activeConflict.resolvedContent);
                }
            } else if (line.startsWith('>>>>>>>')) {
                inConflict = false;
                activeConflict = null;
            } else {
                if (!inConflict) {
                    result.push(line);
                } else if (activeConflict && !activeConflict.isResolved) {
                    // Eğer çözülemediyse, orjinal çakışmaları basmak lazım 
                    // ama basitleştirmek için current'ı bırakalım veya orjinali basalım
                    result.push(line);
                }
            }
        }

        return result.join('\n');
    }
}

export const mergeConflictResolver = MergeConflictResolver.getInstance();
