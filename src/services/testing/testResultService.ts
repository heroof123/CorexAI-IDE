import { TestCase } from './testService';

class TestResultService {
    private testHistory: Map<string, TestCase[]> = new Map();

    saveResult(suiteId: string, testCases: TestCase[]) {
        this.testHistory.set(suiteId, testCases);
    }

    getHistory(suiteId: string): TestCase[] | undefined {
        return this.testHistory.get(suiteId);
    }

    clearHistory() {
        this.testHistory.clear();
    }
}

export const testResultService = new TestResultService();
