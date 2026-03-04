import * as monaco from 'monaco-editor';
import { testService } from './testService';

// Test statülerini editor üzerinde margin/glyph olarak göstermek için utils
export class TestCoverageDecoration {
    private editor: monaco.editor.IStandaloneCodeEditor;
    private oldDecorations: string[] = [];

    constructor(editor: monaco.editor.IStandaloneCodeEditor) {
        this.editor = editor;

        // Listen run updates to inject decorations
        testService.subscribeRun((status, result) => {
            if (status === 'idle' && result) {
                this.updateDecorations(result.testCases);
            }
        });
    }

    public updateDecorations(testCases: { file: string, line: number, status: string, message?: string | null }[]) {
        // Normalde açık olan "Model" in uri path'i üzerinden eşleşme kurarız
        const model = this.editor.getModel();
        if (!model) return;

        const currentUri = model.uri.path;

        // Bu uri'de geçen testleri bul (mock için contains kullanıyoruz pratik olsun)
        const relevantTests = testCases.filter(t => t.file.replace(/\\/g, '/').includes(currentUri.replace(/\\/g, '/')) || currentUri.replace(/\\/g, '/').includes(t.file.replace(/\\/g, '/')));

        const newDecorations: monaco.editor.IModelDeltaDecoration[] = relevantTests.map(test => {
            const isPassed = test.status === 'passed';
            return {
                range: new monaco.Range(test.line, 1, test.line, 1),
                options: {
                    isWholeLine: false,
                    glyphMarginClassName: isPassed ? 'test-pass-glyph' : 'test-fail-glyph',
                    glyphMarginHoverMessage: test.message ? { value: `**Test Hatası:**\n\`\`\`text\n${test.message}\n\`\`\`` } : undefined,
                    overviewRuler: isPassed ? { color: '#10b981', position: monaco.editor.OverviewRulerLane.Left } : { color: '#ef4444', position: monaco.editor.OverviewRulerLane.Left },
                }
            };
        });

        this.oldDecorations = this.editor.deltaDecorations(this.oldDecorations, newDecorations);
    }

    public clear() {
        this.oldDecorations = this.editor.deltaDecorations(this.oldDecorations, []);
    }
}
