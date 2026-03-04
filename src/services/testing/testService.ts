import { invoke } from '@tauri-apps/api/core';

export interface TestCase {
    id: string;
    name: string;
    file: string;
    line: number;
    status: 'passed' | 'failed' | 'skipped' | 'pending';
    message?: string | null;
}

export interface TestSuite {
    id: string;
    name: string;
    tests: TestCase[];
}

export interface TestRunResult {
    success: boolean;
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    testCases: TestCase[];
}

type TestEventListener = (tests: TestSuite[]) => void;
type TestRunListener = (status: 'running' | 'idle', results?: TestRunResult) => void;

class TestService {
    private suites: TestSuite[] = [];
    private listeners = new Set<TestEventListener>();
    private runListeners = new Set<TestRunListener>();
    private isRunning = false;

    async scanWorkspace(path: string = '.') {
        try {
            const suites = await invoke<TestSuite[]>('scan_workspace_tests', { path });
            this.suites = suites;
            this.notifyListeners();
        } catch (error) {
            console.error('Failed to scan workspace tests:', error);
        }
    }

    async runSuite(suiteId: string) {
        if (this.isRunning) return;

        this.isRunning = true;
        this.notifyRunListeners('running');

        try {
            const result = await invoke<any>('run_test_suite', { suiteId });
            // Tauri den snake_case dönüp biz camelCase beklemiyoruz ama rust struct serialize direkt dönüyor
            // Rust struct camelCase yapılabilirdi ama mapleyelim
            const mappedResult: TestRunResult = {
                success: result.success,
                total: result.total,
                passed: result.passed,
                failed: result.failed,
                skipped: result.skipped,
                testCases: result.test_cases || result.testCases
            };

            this.updateSuiteResults(suiteId, mappedResult.testCases);
            this.notifyRunListeners('idle', mappedResult);
        } catch (error) {
            console.error('Failed to run test suite:', error);
            this.notifyRunListeners('idle');
        } finally {
            this.isRunning = false;
        }
    }

    private updateSuiteResults(suiteId: string, results: TestCase[]) {
        const suite = this.suites.find(s => s.id === suiteId);
        if (suite) {
            // Merge test results into the suite based on ID
            suite.tests = suite.tests.map(test => {
                const res = results.find(r => r.id === test.id);
                return res ? { ...test, status: res.status, message: res.message } : test;
            });
            this.notifyListeners();
        }
    }

    getSuites(): TestSuite[] {
        return this.suites;
    }

    getRunState() {
        return this.isRunning;
    }

    subscribe(listener: TestEventListener) {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    subscribeRun(listener: TestRunListener) {
        this.runListeners.add(listener);
        return () => { this.runListeners.delete(listener); };
    }

    private notifyListeners() {
        this.listeners.forEach(l => l(this.suites));
    }

    private notifyRunListeners(status: 'running' | 'idle', result?: TestRunResult) {
        this.runListeners.forEach(l => l(status, result));
    }
}

export const testService = new TestService();
