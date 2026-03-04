use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TestCase {
    pub id: String,
    pub name: String,
    pub file: String,
    pub line: u32,
    pub status: String, // "passed", "failed", "skipped", "pending"
    pub message: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TestSuite {
    pub id: String,
    pub name: String,
    pub tests: Vec<TestCase>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TestRunResult {
    pub success: bool,
    pub total: u32,
    pub passed: u32,
    pub failed: u32,
    pub skipped: u32,
    pub test_cases: Vec<TestCase>,
}

#[tauri::command]
pub async fn scan_workspace_tests(path: String) -> Result<Vec<TestSuite>, String> {
    // Mock testleri döndürelim
    let mock_suites = vec![
        TestSuite {
            id: "suite_1".to_string(),
            name: "AppComponent.spec.ts".to_string(),
            tests: vec![
                TestCase {
                    id: "test_1_1".to_string(),
                    name: "should create the app".to_string(),
                    file: path.clone() + "/AppComponent.spec.ts",
                    line: 12,
                    status: "pending".to_string(),
                    message: None,
                },
                TestCase {
                    id: "test_1_2".to_string(),
                    name: "should render title".to_string(),
                    file: path.clone() + "/AppComponent.spec.ts",
                    line: 18,
                    status: "pending".to_string(),
                    message: None,
                },
            ],
        },
        TestSuite {
            id: "suite_2".to_string(),
            name: "Utils.test.ts".to_string(),
            tests: vec![
                TestCase {
                    id: "test_2_1".to_string(),
                    name: "formatDate() works correctly".to_string(),
                    file: path.clone() + "/Utils.test.ts",
                    line: 5,
                    status: "pending".to_string(),
                    message: None,
                },
            ],
        },
    ];
    Ok(mock_suites)
}

#[tauri::command]
pub async fn run_test_suite(suite_id: String) -> Result<TestRunResult, String> {
    // Simulate test run
    tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;
    
    if suite_id == "suite_1" {
        Ok(TestRunResult {
            success: false,
            total: 2,
            passed: 1,
            failed: 1,
            skipped: 0,
            test_cases: vec![
                TestCase {
                    id: "test_1_1".to_string(),
                    name: "should create the app".to_string(),
                    file: "/AppComponent.spec.ts".to_string(),
                    line: 12,
                    status: "passed".to_string(),
                    message: None,
                },
                TestCase {
                    id: "test_1_2".to_string(),
                    name: "should render title".to_string(),
                    file: "/AppComponent.spec.ts".to_string(),
                    line: 18,
                    status: "failed".to_string(),
                    message: Some("Expected 'CorexAI' to equal 'CoreX'".to_string()),
                },
            ]
        })
    } else {
        Ok(TestRunResult {
            success: true,
            total: 1,
            passed: 1,
            failed: 0,
            skipped: 0,
            test_cases: vec![
                TestCase {
                    id: "test_2_1".to_string(),
                    name: "formatDate() works correctly".to_string(),
                    file: "/Utils.test.ts".to_string(),
                    line: 5,
                    status: "passed".to_string(),
                    message: None,
                },
            ]
        })
    }
}

#[tauri::command]
pub async fn get_code_coverage(_path: String) -> Result<String, String> {
    // Return mock lcov string or JSON
    let lcov_mock = "SF:src/utils.ts\nDA:1,1\nDA:2,0\nDA:3,1\nLF:3\nLH:2\nend_of_record".to_string();
    Ok(lcov_mock)
}
