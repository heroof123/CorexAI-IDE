// AI Tool System - CoreX AI OS
// Tools that AI can use to interact with the system

import { invoke } from '@tauri-apps/api/core';
import { mcpService } from './mcpService';
import { knowledgeBase } from './knowledgeBase';
import html2canvas from 'html2canvas';
import { open } from '@tauri-apps/plugin-dialog';
import { AgentTask, TaskStep } from '../types/agent';


// Tool definitions
export interface Tool {
  name: string;
  description: string;
  parameters: {
    [key: string]: {
      type: string;
      description: string;
      required?: boolean;
    };
  };
}

export const AVAILABLE_TOOLS: Tool[] = [
  {
    name: 'run_terminal',
    description: 'Execute a terminal command and get the output. Use this to run npm, git, build commands, etc.',
    parameters: {
      command: {
        type: 'string',
        description: 'The terminal command to execute (e.g., "npm install axios", "git status")',
        required: true
      }
    }
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file from the project',
    parameters: {
      path: {
        type: 'string',
        description: 'Relative path to the file (e.g., "src/App.tsx")',
        required: true
      }
    }
  },
  {
    name: 'select_directory',
    description: 'Open a native dialog to let the user select a directory. Use this when you need permission to write files to a specific location or to create a new project.',
    parameters: {}
  },
  {
    name: 'write_file',
    description: 'Write or update a file in the project. Supports absolute paths (e.g. from select_directory) or relative paths.',
    parameters: {
      path: {
        type: 'string',
        description: 'File path (relative or absolute)',
        required: true
      },
      content: {
        type: 'string',
        description: 'The content to write to the file',
        required: true
      }
    }
  },
  {
    name: 'list_files',
    description: 'List files in a directory',
    parameters: {
      path: {
        type: 'string',
        description: 'Directory path (default: current directory)',
        required: false
      }
    }
  },
  {
    name: 'plan_task',
    description: 'Create a detailed plan for a complex task. Break it down into steps.',
    parameters: {
      task: {
        type: 'string',
        description: 'The task to plan (e.g., "Add dark mode to the app")',
        required: true
      },
      context: {
        type: 'string',
        description: 'Additional context about the project',
        required: false
      }
    }
  },
  {
    name: 'generate_code',
    description: 'Generate code for a specific component or feature',
    parameters: {
      description: {
        type: 'string',
        description: 'What code to generate (e.g., "React button component with hover effect")',
        required: true
      },
      language: {
        type: 'string',
        description: 'Programming language (e.g., "typescript", "javascript", "python")',
        required: false
      }
    }
  },
  {
    name: 'test_code',
    description: 'Test code or run project tests',
    parameters: {
      type: {
        type: 'string',
        description: 'Test type: "unit", "integration", "build", or "all"',
        required: false
      },
      path: {
        type: 'string',
        description: 'Specific file or directory to test',
        required: false
      }
    }
  },
  {
    name: 'code_review',
    description: 'AI-powered code review: analyzes a file for bugs, code quality, security and best practices. Returns a score (0-100), list of issues, suggestions, and a summary. Use this when user asks to review/check/analyze code.',
    parameters: {
      path: {
        type: 'string',
        description: 'Path to the file to review (e.g. "src/App.tsx")',
        required: true
      }
    }
  },
  {
    name: 'generate_docs',
    description: 'Generate documentation for a source file: README section, API reference, and inline comment suggestions. Use when user asks to document or explain a file.',
    parameters: {
      path: {
        type: 'string',
        description: 'Path to the file to document',
        required: true
      }
    }
  },
  {
    name: 'generate_tests',
    description: 'Generate unit and integration tests for a source file using Jest/Vitest. Use when user asks to create tests for a file.',
    parameters: {
      path: {
        type: 'string',
        description: 'Path to the file to generate tests for',
        required: true
      }
    }
  },
  {
    name: 'refactor_code',
    description: 'Suggest concrete refactoring improvements for a source file: extract functions, remove duplication, apply design patterns. Use when user asks to improve or refactor code.',
    parameters: {
      path: {
        type: 'string',
        description: 'Path to the file to refactor',
        required: true
      }
    }
  },
  {
    name: 'security_scan',
    description: 'Scan a source file for security vulnerabilities: SQL injection, XSS, auth issues, sensitive data exposure. Use when user asks about security or potential vulnerabilities.',
    parameters: {
      path: {
        type: 'string',
        description: 'Path to the file to scan',
        required: true
      }
    }
  },
  {
    name: 'web_search',
    description: 'Search the web for up-to-date information. Use when user asks about recent events, library docs, error solutions, or anything that requires current knowledge. Returns top results with titles, snippets and URLs.',
    parameters: {
      query: {
        type: 'string',
        description: 'Search query (e.g. "React 19 new features" or "TypeError: cannot read property of undefined fix")',
        required: true
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
        required: false
      }
    }
  },
  {
    name: 'save_knowledge',
    description: 'Save important information about the project or user preferences for future recall.',
    parameters: {
      content: {
        type: 'string',
        description: 'The information to save (e.g., "User prefers Tailwind CSS", "API base URL is ...")',
        required: true
      },
      category: {
        type: 'string',
        description: 'Category: "user_preference", "project_context", or "solution_pattern"',
        required: false
      }
    }
  },
  {
    name: 'retrieve_knowledge',
    description: 'Search for stored information in the knowledge base.',
    parameters: {
      query: {
        type: 'string',
        description: 'Search query (e.g., "coding style", "api keys")',
        required: true
      }
    }
  },
  {
    name: 'take_screenshot',
    description: 'Capture a screenshot of the current application window. Use this when you need to see the UI to debug visual issues or verify layout.',
    parameters: {}
  },
  {
    name: 'create_artifact',
    description: 'Create a documentation artifact (markdown file) in the docs/artifacts directory. Use this for implementation plans, walkthroughs, or system documentation.',
    parameters: {
      filename: {
        type: 'string',
        description: 'Name of the file (e.g., "implementation_plan.md", "api_reference.md")',
        required: true
      },
      content: {
        type: 'string',
        description: 'Markdown content of the artifact',
        required: true
      }
    }
  }
];

// Tool execution
export async function executeTool(toolName: string, parameters: any): Promise<any> {
  console.log(`🔧 Executing tool: ${toolName}`, parameters);

  try {
    switch (toolName) {
      case 'run_terminal':
      case 'run_command': // FIX-37 Alias
        return await runTerminal(parameters.command || parameters.cmd);

      case 'read_file':
        return await readFile(parameters.path);

      case 'write_file':
        return await writeFile(parameters.path, parameters.content);

      case 'list_files':
        return await listFiles(parameters.path || '.');

      case 'plan_task':
        return await planTask(parameters.task, parameters.context);

      case 'generate_code':
        return await generateCode(parameters.description, parameters.language);

      case 'test_code':
        return await testCode(parameters.type, parameters.path);

      case 'code_review':
        return await aiCodeReview(parameters.path);

      case 'generate_docs':
        return await aiGenerateDocs(parameters.path);

      case 'generate_tests':
        return await aiGenerateTests(parameters.path);

      case 'refactor_code':
        return await aiRefactorCode(parameters.path);

      case 'security_scan':
        return await aiSecurityScan(parameters.path);

      case 'web_search':
        return await webSearch(parameters.query, parameters.max_results || 5);

      case 'save_knowledge':
        try {
          const item = knowledgeBase.addKnowledge(parameters.content, parameters.category || 'project_context');
          return {
            success: true,
            message: 'Information saved to knowledge base.',
            item
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }

      case 'retrieve_knowledge':
        try {
          const results = knowledgeBase.search(parameters.query);
          return {
            success: true,
            results,
            count: results.length
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }

      case 'take_screenshot':
        return await takeScreenshot();

      case 'create_artifact':
        return await createArtifact(parameters.filename, parameters.content);

      case 'select_directory':
        return await selectDirectory();

      default:
        // Check if it's an MCP tool (format: mcp_serverName_toolName)
        if (toolName.startsWith('mcp_')) {
          return await executeMcpTool(toolName, parameters);
        }
        throw new Error(`Unknown tool: ${toolName}`);
    }

  } catch (error) {
    console.error(`❌ Tool execution failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Tool implementations
const SAFE_COMMANDS = ['ls', 'dir', 'pwd', 'cat', 'echo', 'npm', 'cargo',
  'python', 'git', 'node', 'tsc', 'grep', 'find', 'mkdir', 'cp', 'mv', 'rm', 'npx']; // FIX-18

async function runTerminal(command: string): Promise<any> {
  try {
    // Basic verification
    const firstWord = command.trim().split(/\s+/)[0];
    const baseCmd = firstWord.split(/[/\\]/).pop() || firstWord;

    if (!SAFE_COMMANDS.includes(baseCmd)) {
      throw new Error(`Güvenlik: '${baseCmd}' komutu izin listesinde değil. Lütfen sadece izinli komutları kullanın.`);
    }

    const dangerous = [';', '&&', '||', '|', '`', '$(', '>', '<'];
    for (const d of dangerous) {
      if (command.includes(d)) {
        throw new Error(`Güvenlik: '${d}' karakteri kullanımı yasaktır.`);
      }
    }

    // Windows için cmd kullan
    const isWindows = navigator.platform.toLowerCase().includes('win');
    const shell = isWindows ? 'cmd' : 'sh';
    const shellArgs = isWindows ? ['/C', command] : ['-c', command];

    const result = await invoke('execute_command', {
      command: shell,
      args: shellArgs,
      cwd: null
    });

    // Notify terminal UI (FIX-37)
    window.dispatchEvent(new CustomEvent('corex-terminal-output', {
      detail: { command, output: result }
    }));

    // Result zaten JSON formatında
    const output = result as any;

    return {
      success: output.success || false,
      stdout: output.stdout || '',
      stderr: output.stderr || '',
      command,
      exitCode: output.exit_code
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Command execution failed',
      command,
      stdout: '',
      stderr: String(error)
    };
  }
}

async function readFile(path: string): Promise<any> {
  try {
    const content = await invoke('read_file_content', { path });
    return {
      success: true,
      content,
      path
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'File read failed',
      path
    };
  }
}

async function writeFile(path: string, content: string): Promise<any> {
  try {
    await invoke('write_file', { path, content });
    return {
      success: true,
      path,
      message: 'File written successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'File write failed',
      path
    };
  }
}

async function listFiles(path: string): Promise<any> {
  try {
    const files = await invoke('get_all_files', { path });
    return {
      success: true,
      files,
      path,
      count: Array.isArray(files) ? files.length : 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Directory listing failed',
      path
    };
  }
}

// Generate tool prompt for AI
export async function getToolsPrompt(): Promise<string> {
  const mcpServers = await mcpService.listActiveServers();
  let mcpToolsDescription = '';

  for (const server of mcpServers) {
    try {
      const tools = await mcpService.listTools(server.name);
      for (const tool of tools) {
        const mcpToolName = `mcp_${server.name.replace(/\s+/g, '_')}_${tool.name}`;
        mcpToolsDescription += `
**${mcpToolName}** (MCP: ${server.name})
Description: ${tool.description}
Parameters:
${JSON.stringify(tool.inputSchema.properties || {}, null, 2)}
`;
      }
    } catch (e) {
      console.error(`Failed to load tools for server ${server.name}:`, e);
    }
  }

  return `
🔧 AVAILABLE TOOLS:

You can use these tools by responding in this format:
TOOL: tool_name
PARAMS: {"param1": "value1", "param2": "value2"}

Core Tools:
${AVAILABLE_TOOLS.map(tool => `
**${tool.name}**
Description: ${tool.description}
Parameters:
${Object.entries(tool.parameters).map(([name, param]) =>
    `  - ${name} (${param.type}${param.required ? ', required' : ''}): ${param.description}`
  ).join('\n')}
`).join('\n')}

MCP Tools (Extended Capabilities):
${mcpToolsDescription || 'No active MCP tools available.'}

Example usage:
TOOL: run_terminal
PARAMS: {"command": "npm install axios"}

After using a tool, I will provide you with the result, and you can continue the conversation or use another tool.
`;
}

async function executeMcpTool(mcpToolName: string, parameters: any): Promise<any> {
  try {
    // Parse mcp_serverName_toolName
    const parts = mcpToolName.split('_');
    if (parts.length < 3) throw new Error('Invalid MCP tool name format');

    // Server name might contain underscores if it originally had spaces (we replaced them in prompt)
    // But for now let's assume simple names or find the best match
    const activeServers = await mcpService.listActiveServers();
    let serverName = '';
    let toolName = '';

    // Find server and tool
    for (const server of activeServers) {
      const sanitizedServerName = server.name.replace(/\s+/g, '_');
      if (mcpToolName.startsWith(`mcp_${sanitizedServerName}_`)) {
        serverName = server.name;
        toolName = mcpToolName.substring(`mcp_${sanitizedServerName}_`.length);
        break;
      }
    }

    if (!serverName) throw new Error(`MCP Server not found for tool: ${mcpToolName}`);

    console.log(`🔌 Calling MCP Tool: ${serverName} -> ${toolName}`, parameters);
    const result = await mcpService.callTool(serverName, toolName, parameters);

    return {
      success: true,
      result,
      tool: mcpToolName
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'MCP Tool execution failed',
      tool: mcpToolName
    };
  }
}


// Parse AI response for tool calls
export function parseToolCall(response: string): { toolName: string; parameters: any } | null {
  try {
    // Yeni format: TOOL:tool_name|PARAMS:{json}
    const toolMatch = response.match(/TOOL:(\w+)\|PARAMS:({[\s\S]*?})/);

    if (toolMatch) {
      const toolName = toolMatch[1];
      const paramsJson = toolMatch[2];

      try {
        const parameters = JSON.parse(paramsJson);
        console.log(`✅ Tool parse edildi: ${toolName}`, parameters);
        return { toolName, parameters };
      } catch (jsonError) {
        console.error('❌ JSON parse hatası:', paramsJson);
        return null;
      }
    }

    // Eski format desteği: TOOL: ve PARAMS: ayrı satırlarda
    const oldToolMatch = response.match(/TOOL:\s*(\w+)/);
    const oldParamsMatch = response.match(/PARAMS:\s*({[\s\S]*?})/);

    if (oldToolMatch && oldParamsMatch) {
      const toolName = oldToolMatch[1];
      const parameters = JSON.parse(oldParamsMatch[1]);
      console.log(`✅ Tool parse edildi (eski format): ${toolName}`, parameters);
      return { toolName, parameters };
    }

    return null;
  } catch (error) {
    console.error('❌ Tool parse hatası:', error);
    return null;
  }
}


// 🤖 MULTI-AGENT TOOLS

async function planTask(task: string, context?: string): Promise<any> {
  try {
    console.log('📋 Planning task:', task);

    // Basit plan oluştur
    const steps: TaskStep[] = [
      { id: 'step-1', description: 'Analyze requirements and current implementation', status: 'pending', timestamp: Date.now() },
      { id: 'step-2', description: 'Design solution architecture', status: 'pending', timestamp: Date.now() },
      { id: 'step-3', description: 'Implement core functionality', status: 'pending', timestamp: Date.now() },
      { id: 'step-4', description: 'Verify changes with tests', status: 'pending', timestamp: Date.now() },
      { id: 'step-5', description: 'Document changes and update artifacts', status: 'pending', timestamp: Date.now() }
    ];

    const plan: AgentTask = {
      id: `task-${Date.now()}`,
      title: task,
      objective: task,
      context: context || '',
      steps,
      currentStepIndex: 0,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    return {
      success: true,
      plan,
      message: 'Agent Task Plan created successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Planning failed'
    };
  }
}

async function generateCode(description: string, language?: string): Promise<any> {
  try {
    console.log('💻 Generating code:', description);

    // Basit kod template'i
    const lang = language || 'typescript';
    let code = '';

    if (lang === 'typescript' || lang === 'javascript') {
      code = `// ${description}
export function generatedFunction() {
  // TODO: Implement ${description}
  console.log('Generated function');
  return true;
}`;
    } else if (lang === 'python') {
      code = `# ${description}
def generated_function():
    # TODO: Implement ${description}
    print('Generated function')
    return True`;
    } else {
      code = `// ${description}\n// TODO: Implement this`;
    }

    return {
      success: true,
      code,
      language: lang,
      description,
      message: 'Code generated successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Code generation failed'
    };
  }
}

async function testCode(type?: string, path?: string): Promise<any> {
  try {
    console.log('🧪 Testing code:', type, path);

    const testType = type || 'build';
    let command = '';

    switch (testType) {
      case 'unit':
        command = 'npm test';
        break;
      case 'integration':
        command = 'npm run test:integration';
        break;
      case 'build':
        command = 'npm run build';
        break;
      case 'all':
        command = 'npm test && npm run build';
        break;
      default:
        command = 'npm run build';
    }

    // Terminal komutu çalıştır
    const result = await runTerminal(command);

    return {
      success: result.success,
      testType,
      command,
      output: result.stdout,
      errors: result.stderr,
      message: result.success ? 'Tests passed' : 'Tests failed'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Testing failed'
    };
  }
}

// ============================================================
// AI ANALYSIS TOOLS — Chat sırasında AI tarafından çağrılır
// ============================================================

/** Dosya içeriğini Tauri backend ile oku */
async function readFileContent(path: string): Promise<string> {
  try {
    const content = await invoke<string>('read_file_content', { path });
    return content || '';
  } catch {
    return '';
  }
}

/** AI Code Review — dosyayı oku ve gerçek AI ile incele */
async function aiCodeReview(path: string): Promise<any> {
  try {
    const content = await readFileContent(path);
    if (!content.trim()) return { success: false, error: 'Dosya boş veya okunamadı: ' + path };

    const { performCodeReview } = await import('./ai');
    const result = await performCodeReview(path, content);

    return {
      success: true,
      path,
      score: result.score,
      issueCount: result.issues.length,
      criticalIssues: result.issues.filter((i: any) => i.severity === 'high').length,
      issues: result.issues.slice(0, 10), // İlk 10 sorun (token tasarrufu)
      suggestions: result.suggestions.slice(0, 5),
      summary: result.summary,
      message: `${path} dosyası incelendi. Skor: ${result.score}/100, ${result.issues.length} sorun bulundu.`
    };
  } catch (error) {
    return { success: false, error: String(error), path };
  }
}

/** AI Documentation Generator — dosyayı oku ve gerçek AI ile belgele */
async function aiGenerateDocs(path: string): Promise<any> {
  try {
    const content = await readFileContent(path);
    if (!content.trim()) return { success: false, error: 'Dosya boş veya okunamadı: ' + path };

    const { generateDocumentationForPanel } = await import('./ai');
    const result = await generateDocumentationForPanel(path, content);

    return {
      success: true,
      path,
      readme: result.readme.substring(0, 800),
      apiDocs: result.apiDocs.substring(0, 600),
      comments: result.comments.substring(0, 400),
      message: `${path} için dokümantasyon oluşturuldu.`
    };
  } catch (error) {
    return { success: false, error: String(error), path };
  }
}

/** AI Test Generator — dosyayı oku ve gerçek AI ile test yaz */
async function aiGenerateTests(path: string): Promise<any> {
  try {
    const content = await readFileContent(path);
    if (!content.trim()) return { success: false, error: 'Dosya boş veya okunamadı: ' + path };

    const { generateTestsForPanel } = await import('./ai');
    const result = await generateTestsForPanel(path, content);

    return {
      success: true,
      path,
      unitTests: result.unitTests.substring(0, 1500),
      integrationTests: result.integrationTests.substring(0, 800),
      testPlan: result.testPlan.substring(0, 400),
      message: `${path} için testler oluşturuldu.`
    };
  } catch (error) {
    return { success: false, error: String(error), path };
  }
}

/** AI Refactoring — dosyayı oku ve gerçek AI ile refactoring önerileri al */
async function aiRefactorCode(path: string): Promise<any> {
  try {
    const content = await readFileContent(path);
    if (!content.trim()) return { success: false, error: 'Dosya boş veya okunamadı: ' + path };

    const { suggestRefactoringForPanel } = await import('./ai');
    const result = await suggestRefactoringForPanel(path, content);

    return {
      success: true,
      path,
      suggestionCount: result.suggestions.length,
      suggestions: result.suggestions.slice(0, 5).map((s: any) => ({
        impact: s.impact,
        type: s.type,
        description: s.description
      })),
      summary: result.summary,
      message: `${path} için ${result.suggestions.length} refactoring önerisi bulundu.`
    };
  } catch (error) {
    return { success: false, error: String(error), path };
  }
}

/** AI Security Scan — dosyayı oku ve gerçek AI ile güvenlik taraması yap */
async function aiSecurityScan(path: string): Promise<any> {
  try {
    const content = await readFileContent(path);
    if (!content.trim()) return { success: false, error: 'Dosya boş veya okunamadı: ' + path };

    const { scanSecurity } = await import('./ai');
    const result = await scanSecurity(path, content);

    return {
      success: true,
      path,
      securityScore: result.score,
      vulnerabilityCount: result.vulnerabilities.length,
      criticalVulnerabilities: result.vulnerabilities.filter((v: any) => v.severity === 'critical' || v.severity === 'high').length,
      vulnerabilities: result.vulnerabilities.slice(0, 8),
      summary: result.summary,
      message: `${path} güvenlik taraması tamamlandı. Skor: ${result.score}/100, ${result.vulnerabilities.length} açık bulundu.`
    };
  } catch (error) {
    return { success: false, error: String(error), path };
  }
}

/** Web Arama — DuckDuckGo Instant Answer API (API key gerektirmez) */
async function webSearch(query: string, maxResults: number = 5): Promise<any> {
  try {
    // DuckDuckGo Instant Answer API (ücretsiz, API key yok)
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

    let data: any;
    try {
      // Browser fetch — DuckDuckGo CORS izin veriyor
      const resp = await fetch(url);
      data = await resp.json();
    } catch {
      return {
        success: false,
        query,
        message: `Web araması başarısız: ağ erişimi yok`,
      };
    }

    const results: Array<{ title: string; snippet: string; url: string }> = [];

    // Abstract (ana özet)
    if (data.Abstract) {
      results.push({
        title: data.Heading || query,
        snippet: data.Abstract,
        url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      });
    }

    // RelatedTopics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, maxResults - results.length)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 60),
            snippet: topic.Text,
            url: topic.FirstURL,
          });
        }
      }
    }

    if (results.length === 0) {
      // Sonuç bulunamadıysa arama bağlantısı döndür
      return {
        success: true,
        query,
        results: [],
        searchUrl: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        message: `"${query}" için sonuç bulunamadı. DuckDuckGo'da arama yapabilirsiniz: https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      };
    }

    const resultText = results
      .map((r, i) => `**${i + 1}. ${r.title}**\n${r.snippet}\n🔗 ${r.url}`)
      .join('\n\n');

    return {
      success: true,
      query,
      resultCount: results.length,
      results,
      message: `"${query}" için ${results.length} sonuç bulundu:\n\n${resultText}`,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      query,
      message: `Web araması başarısız: ${error}`,
    };
  }
}

async function takeScreenshot(): Promise<any> {
  try {
    console.log('📸 Taking screenshot...');
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: '#1e1e1e' // Dark theme default background
    });

    // Convert to base64
    const imageData = canvas.toDataURL('image/png');

    // Return structured result for AI
    return {
      success: true,
      message: 'Screenshot captured successfully',
      image_data: imageData, // AI provider will handle this if it supports vision
      description: 'Screenshot of the current application state'
    };
  } catch (error) {
    console.error('❌ Screenshot failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Screenshot failed'
    };
  }
}

async function createArtifact(filename: string, content: string): Promise<any> {
  try {
    const safeFilename = filename.replace(/[/\\]/g, '_').replace(/\.md$/i, '') + '.md';
    const path = `docs/artifacts/${safeFilename}`;

    console.log(`📝 Creating artifact: ${path}`);

    // Use existing writeFile logic
    await writeFile(path, content);

    return {
      success: true,
      message: `Artifact created at ${path}`,
      path,
      description: 'Documentation artifact generated successfully'
    };
  } catch (error) {
    console.error('❌ Artifact creation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Artifact creation failed'
    };
  }
}

async function selectDirectory(): Promise<any> {
  try {
    console.log('📂 Opening directory selection dialog...');
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Proje oluşturulacak klasörü seçin'
    });

    if (selected === null) {
      return { success: false, error: 'Kullanıcı klasör seçmedi' };
    }

    return {
      success: true,
      path: selected as string,
      message: 'Directory selected successfully'
    };
  } catch (error) {
    console.error('❌ Directory selection failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Directory selection failed'
    };
  }
}
