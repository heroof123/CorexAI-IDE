// src/services/testGenerationService.ts
import { invoke } from "@tauri-apps/api/core";
import { callAI } from "./aiProvider";

export interface TestGenRequest {
    filePath: string;
    sourceCode: string;
    framework: 'vitest' | 'jest' | 'mocha';
}

class TestGenerationService {
    /**
     * Generates a full test file for the given source code
     */
    async generateTests(request: TestGenRequest): Promise<string> {
        const prompt = `
      Sen profesyonel bir test mühendisisin. Aşağıdaki kodu incele ve onun için kapsamlı, hata senaryolarını da içeren ${request.framework} testleri yaz.
      
      Dosya Yolu: ${request.filePath}
      Kod:
      \`\`\`typescript
      ${request.sourceCode}
      \`\`\`
      
      Gereksinimler:
      1. Sadece test kodunu döndür, açıklama yapma.
      2. Mocking gerekiyorsa modern yöntemler kullan.
      3. Edge case'leri (hata durumları, boş girdiler vb.) test et.
      4. Kodun okunabilir ve temiz olmasına dikkat et.
    `;

        try {
            const response = await callAI(prompt, "main", []);

            // Extract code block if AI wrapped it
            let testCode = response.trim();
            const match = testCode.match(/```(?:typescript|javascript)?([\s\S]*?)```/);
            if (match) {
                testCode = match[1].trim();
            }

            return testCode;
        } catch (error) {
            console.error("❌ Test Generation AI Failed:", error);
            throw error;
        }
    }

    /**
     * Automatically creates the test file in the project
     */
    async createTestFile(sourcePath: string, testCode: string) {
        // Convert e.g. src/utils/math.ts -> src/utils/math.test.ts
        const parts = sourcePath.split('.');
        const ext = parts.pop();
        const basePath = parts.join('.');
        const testPath = `${basePath}.test.${ext}`;

        await invoke("create_file", { path: testPath, content: testCode });
        return testPath;
    }

    async detectFramework(projectPath: string): Promise<'vitest' | 'jest' | 'mocha'> {
        try {
            const packageJsonStr: string = await invoke("read_file", { path: `${projectPath}/package.json` });
            const pkg = JSON.parse(packageJsonStr);
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            if (deps.vitest) return 'vitest';
            if (deps.jest) return 'jest';
            if (deps.mocha) return 'mocha';
        } catch (e) {
            console.warn("Failed to detect test framework, defaulting to vitest");
        }
        return 'vitest';
    }
}

export const testGenerationService = new TestGenerationService();
