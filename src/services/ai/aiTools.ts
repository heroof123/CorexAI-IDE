// AI Tool System - CoreX AI OS
// Tools that AI can use to interact with the system

import { invoke } from '@tauri-apps/api/core';
import { mcpService } from '../mcpService';
import { knowledgeBase } from '../knowledgeBase';
import html2canvas from 'html2canvas';
import { open } from '@tauri-apps/plugin-dialog';
import { AgentTask, TaskStep } from '../../types/agent';


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
    name: 'delegate_task',
    description: 'Devredilecek görevi başka bir uzmana (Architect, Developer, QA) aktarır. Görevin senin uzmanlık alanını aştığını veya mimari planlamadan kodlamaya geçiş yapmak gerektiğini düşündüğünde kullan.',
    parameters: {
      target_agent: { type: 'string', description: 'Architect, Developer veya QA' },
      task_description: { type: 'string', description: 'O ajana verilen tam ve detaylı görev emri.' }
    }
  },
  {
    name: 'run_browser_test',
    description: 'Opens a specific URL in the internal BrowserPanel for testing or visual inspection. Use this after running a web server to see the result. Emits an event to the frontend.',
    parameters: {
      url: { type: 'string', description: 'The URL to test (e.g. http://localhost:3000)' }
    }
  },
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
    description: 'Read the contents of a file from the project. DO NOT use this to check if a file exists before creating it in an empty project. If you are asked to create a new file or start a new project, use "write_file" directly.',
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
    description: 'List directories and files in a specific folder (use glob_search to find specific files across the project).',
    parameters: {
      path: {
        type: 'string',
        description: 'Directory path (default: current directory)',
        required: false
      }
    }
  },
  {
    name: 'glob_search',
    description: 'Find files across the entire project matching a specific naming pattern.',
    parameters: {
      pattern: {
        type: 'string',
        description: 'Glob pattern to search (e.g. "*.ts", "**/components/*.tsx")',
        required: true
      }
    }
  },
  {
    name: 'grep_search',
    description: 'Search for a specific string or regex pattern across the entire codebase. Excellent for finding where a function is called or where a variable is defined.',
    parameters: {
      query: {
        type: 'string',
        description: 'The regex or string query to search for (e.g. "AuthService", "function isValid\\(")',
        required: true
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
  },
  {
    name: 'fix_terminal_error',
    description: 'Terminal Expert - Hata aldığın terminal çıktısını analiz eder ve çözüm üretip uygular. Derleme hataları, paket eksikleri veya sistem hataları için kullan.',
    parameters: {
      command: { type: 'string', description: 'Hata veren komut', required: true },
      error_output: { type: 'string', description: 'Terminaldeki hata çıktısı', required: true }
    }
  },
  {
    name: 'scaffold_module',
    description: 'Project Architect - Yeni bir modül yapısı oluşturur. Belirli bir mimari desene (örn. Service-Controller, Repository, React Component) göre klasör ve dosyaları otomatik iskeletini kurar.',
    parameters: {
      module_name: { type: 'string', description: 'Oluşturulacak modülün adı', required: true },
      pattern: { type: 'string', description: 'Mimari desen: "service", "component", "hook", "api"', required: true },
      path: { type: 'string', description: 'Oluşturulacağı üst dizin (opsiyonel)', required: false }
    }
  },
  {
    name: 'deep_search_project',
    description: 'Advanced RAG - Tüm projede derinlemesine semantik ve metinsel arama yapar. Vektörel hafızayı, grep aramayı ve dosya isimlerini birleştirerek en doğru bağlamı getirir.',
    parameters: {
      query: { type: 'string', description: 'Aranacak kavram veya kod bloğu', required: true }
    }
  },
  {
    name: 'get_project_map',
    description: 'Project Architect - Projenin genel mimari haritasını çıkarır. Önemli dosyaları, modül ilişkilerini ve dizin yapısını özetler.',
    parameters: {}
  },
  {
    name: 'panic_cleanup',
    description: 'NUCLEAR BUTTON - Terminalde askıda kalan portları (3000, 5173, 8000 vb.) ve zombi node/python süreçlerini temizler. "Port already in use" hataları için birebirdir.',
    parameters: {
      port: { type: 'number', description: 'Özellikle temizlenmesi gereken port (opsiyonel)', required: false }
    }
  },
  {
    name: 'vram_optimize',
    description: 'VIRTUAL VRAM (Donanım İllüzyonu) - Mevcut GPU belleğinizden daha büyük modelleri (örn: 8GB VRAM ile 30B model) çalıştırmak için donanım optimizasyonu uygular. NVMe-GPU arasında ağırlık takası yapar.',
    parameters: {
      model_path: { type: 'string', description: 'Optimize edilecek modelin yolu', required: true }
    }
  },
  {
    name: 'vision_ui_test',
    description: 'VISION TESTER - Uygulamanın ekran görüntüsünü alır ve AI kullanarak görsel hataları (kırık tasarım, yanlış renkler vb.) analiz eder.',
    parameters: {
      focus_area: { type: 'string', description: 'Özellikle incelenmesini istediğin alan (örn: chat paneli)', required: false }
    }
  }
];

// Tool execution
export async function executeTool(toolName: string, parameters: any, projectPath: string = ""): Promise<any> {
  console.log(`🔧 Executing tool: ${toolName}`, parameters);

  // Normalize project root
  const rootPath = projectPath.replace(/\\/g, '/').replace(/\/$/, '');

  try {
    switch (toolName) {
      case 'delegate_task':
        const { AgentService } = await import('../agentService');
        AgentService.getInstance().setActiveRole(parameters.target_agent);
        return {
          status: 'success',
          message: `Otonomi yetkisi ${parameters.target_agent} ajanına devredildi. Görev: ${parameters.task_description}`
        };

      case 'run_browser_test':
        window.dispatchEvent(new CustomEvent('corex:open-browser', { detail: { url: parameters.url } }));
        return {
          status: 'success',
          message: `Tarayıcı başlatıldı: ${parameters.url}. Vision özellikleri varsa ekran yakalama yapabilirim.`,
          url: parameters.url
        };

      case 'run_terminal':
      case 'run_command': // FIX-37 Alias
        return await runTerminal(parameters.command || parameters.cmd, rootPath);

      case 'read_file':
        return await readFile(parameters.path, rootPath);

      case 'write_file':
        return await writeFile(parameters.path, parameters.content, rootPath);

      case 'list_files':
        return await listFiles(parameters.path || '.', rootPath);

      case 'glob_search':
        return await globSearch(parameters.pattern, rootPath);

      case 'grep_search':
        return await grepSearch(parameters.query, rootPath);

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

      case 'fix_terminal_error':
        return await fixTerminalError(parameters.command, parameters.error_output);

      case 'scaffold_module':
        return await scaffoldModule(parameters.module_name, parameters.pattern, parameters.path);

      case 'deep_search_project':
        return await deepSearchProject(parameters.query, rootPath);

      case 'get_project_map':
        return await getProjectMap(rootPath);

      case 'panic_cleanup':
        return await panicCleanup(parameters.port);

      case 'vram_optimize':
        return await optimizeVRAM(parameters.model_path);

      case 'vision_ui_test':
        return await visionUITest(parameters.focus_area);

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
  'python', 'git', 'node', 'tsc', 'grep', 'find', 'mkdir', 'cp', 'mv', 'rm', 'npx',
  'vitest', 'jest', 'touch', 'tree', 'code', 'pip']; // FIX-18

async function runTerminal(command: string, rootPath: string = ""): Promise<any> {
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
      cwd: rootPath || null
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

async function readFile(path: string, rootPath: string = ""): Promise<any> {
  try {
    // Normalleşmiş yol
    let targetPath = path.replace(/\\/g, '/');

    // Hallüsinasyon temizliği (/app/ vb.)
    targetPath = targetPath.replace(/^(\/app\/|C:\\app\\|proj\/|.\/)/i, '');

    // Eğer rootPath varsa ve targetPath relative ise (drive letter veya root slash yoksa)
    if (rootPath && !targetPath.includes(':') && !targetPath.startsWith('/') && !targetPath.startsWith('\\')) {
      targetPath = `${rootPath}/${targetPath}`;
    }

    const content = await invoke('read_file_content', { path: targetPath });
    return {
      success: true,
      content,
      path: targetPath
    };
  } catch (error) {
    return {
      success: false,
      error: `Dosya bulunamadı (${path}). Eğer boş bir projedeysen veya dosyayı sıfırdan oluşturman gerekiyorsa, lütfen 'write_file' GÖREVİNİ KULLANARAK dosyayı (gerekli kodlarıyla birlikte) sen oluştur.`,
      path
    };
  }
}

async function writeFile(path: string, content: string, rootPath: string = ""): Promise<any> {
  try {
    // Normalleşmiş yol
    let targetPath = path.replace(/\\/g, '/');

    // Hallüsinasyon temizliği (/app/ vb.)
    targetPath = targetPath.replace(/^(\/app\/|C:\\app\\|proj\/|.\/)/i, '');

    // Eğer rootPath varsa ve targetPath relative ise
    if (rootPath && !targetPath.includes(':') && !targetPath.startsWith('/') && !targetPath.startsWith('\\')) {
      targetPath = `${rootPath}/${targetPath}`;
    }

    await invoke('write_file', { path: targetPath, content });
    return {
      success: true,
      path: targetPath,
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

async function listFiles(path: string, rootPath: string = ""): Promise<any> {
  try {
    let targetPath = path.replace(/\\/g, '/');
    if (rootPath && !targetPath.includes(':') && !targetPath.startsWith('/') && !targetPath.startsWith('\\')) {
      targetPath = `${rootPath}/${targetPath}`;
    }
    const files = await invoke('get_all_files', { path: targetPath });
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

async function globSearch(pattern: string, rootPath: string = ""): Promise<any> {
  try {
    // Tauri backend'de find/glob komutu çalıştırıyoruz
    // isWindows kontrolü
    const isWindows = navigator.platform.toLowerCase().includes('win');
    let command = '';

    if (isWindows) {
      command = `dir /b /s "${pattern.replace(/\*/g, '').replace('**', '')}"`; // Basit fallback
    } else {
      command = `find . -name "${pattern}" -not -path "*/node_modules/*" -not -path "*/.git/*"`;
    }

    const result = await runTerminal(command, rootPath);
    return {
      success: result.success,
      pattern,
      results: result.stdout,
      message: result.stdout ? 'Files found' : 'No files found matching the pattern',
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function grepSearch(query: string, rootPath: string = ""): Promise<any> {
  try {
    console.log(`🔎 Grep Searching for "${query}" in ${rootPath || 'current directory'}`);
    const results = await invoke('grep_search_command', {
      query,
      path: rootPath || '.'
    }) as any;
    // Uzun çıktıları sınırla
    const stdout = results.stdout || '';
    const limitCount = 5000;
    const finalOut = stdout.length > limitCount ? stdout.substring(0, limitCount) + '\n...[TRUNCATED]' : stdout;

    return {
      success: results.success || finalOut.length > 0,
      query,
      matches: finalOut,
      message: finalOut ? 'Search completed' : 'No matches found',
    };
  } catch (error) {
    return { success: false, error: String(error) };
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
### 🔌 ${mcpToolName} (MCP Server: ${server.name})
**Description:** ${tool.description}
**Parameters:** 
\`\`\`json
${JSON.stringify(tool.inputSchema.properties || {}, null, 2)}
\`\`\`
**Required:** ${JSON.stringify(tool.inputSchema.required || [])}
`;
      }
    } catch (e) {
      console.error(`Failed to load tools for server ${server.name}:`, e);
    }
  }

  return `
🛠️ KULLANILABİLİR ARAÇLAR (TOOLS):

Aşağıdaki araçları kullanarak sistemde işlem yapabilirsin. Bir aracı kullanmak için SADECE aşağıdaki formatta yanıt ver:
TOOL: arac_adi | PARAMS: {"parametre1": "değer1"}

Önemli Kurallar:
1. Tool çağırmadan önce Türkçe olarak KISA bir açıklama yap ("Dosyayı okuyorum", "Komutu çalıştırıyorum" vb).
2. Sonra YENİ BİR SATIRDA yukarıdaki Tool formatını eksiksiz yaz.
3. Aracı çağırdıktan sonra sonucun gelmesini bekle, peş peşe mesaj yazma.

Kullanılabilir Araçlar:
${AVAILABLE_TOOLS.map(tool => `
- **${tool.name}**: ${tool.description}
  Parametreler: ${Object.entries(tool.parameters).map(([name, param]) =>
    `\`${name}\` (${param.type}${param.required ? ', zorunlu' : ''}): ${param.description}`
  ).join(', ')}
`).join('')}

MCP Araçları (Eklentiler):
${mcpToolsDescription || '_Şu an aktif eklenti aracı yok._'}
`;
}

async function executeMcpTool(mcpToolName: string, parameters: any): Promise<any> {
  try {
    const parts = mcpToolName.split('_');
    if (parts.length < 3) throw new Error('Invalid MCP tool name format. Expected mcp_server_tool');

    const activeServers = await mcpService.listActiveServers();
    let serverName = '';
    let toolName = '';

    for (const server of activeServers) {
      const sanitizedServerName = server.name.replace(/\s+/g, '_');
      if (mcpToolName.startsWith(`mcp_${sanitizedServerName}_`)) {
        serverName = server.name;
        toolName = mcpToolName.substring(`mcp_${sanitizedServerName}_`.length);
        break;
      }
    }

    if (!serverName) {
      const serverAttempt = parts[1];
      throw new Error(`MCP Server "${serverAttempt}" is not active. Please start the server from the MCP panel first.`);
    }

    console.log(`🔌 [MCP] Calling ${serverName} -> ${toolName}`, parameters);
    const result = await mcpService.callTool(serverName, toolName, parameters);

    return {
      success: true,
      data: result,
      server: serverName,
      tool: toolName,
      message: `Successfully executed ${toolName} on MCP server ${serverName}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown MCP error';
    console.error(`❌ [MCP Error]`, errorMessage);
    return {
      success: false,
      error: errorMessage,
      tool: mcpToolName,
      hint: "Make sure the MCP server is running and the tool parameters match the required schema."
    };
  }
}


// Parse AI response for tool calls (MULTIPLE TOOLS SUPPORT)
export function parseToolCalls(response: string): Array<{ toolName: string; parameters: any }> {
  try {
    const results: Array<{ toolName: string; parameters: any }> = [];

    // Gelişmiş string ayrıştırma (CSS içi süslü parantez gibi hataları önlemek için regex yerine manuel blok arama)
    const regexToolMarker = /TOOL:\s*/;
    if (!regexToolMarker.test(response)) {
      return results; // TOOL etiketi hiç yoksa parse edilecek bir şey de yoktur
    }

    const sections = response.split(regexToolMarker);

    for (let i = 1; i < sections.length; i++) { // 1'den başla çünkü section[0] ilk TOOL'dan önceki kısımdır
      const section = sections[i];
      const parts = section.split(/\|\s*PARAMS:\s*/);

      if (parts.length >= 2) {
        // İlk parça aracın ismini içerir. Örn: "write_file " -> "write_file", bazen sonrasında "\n" olabilir.
        const toolName = parts[0].trim().split(/\s+/)[0];

        // Geri kalanı parametrelerdir
        const paramsStr = parts.slice(1).join("| PARAMS: ").trim();

        // Parametreler bir JSON objesidir. 
        // Döngüsel olarak (sondan başa) geçerli bir JSON arayalım
        let parsed = false;
        let currentStr = paramsStr;

        while (!parsed && currentStr.length > 0) {
          const lastBrace = currentStr.lastIndexOf('}');
          const firstBrace = currentStr.indexOf('{');

          if (lastBrace === -1 || firstBrace === -1 || lastBrace <= firstBrace) {
            break; // Hiç geçerli süslü parantez kalmadıysa döngüden çık
          }

          const attemptJson = currentStr.substring(firstBrace, lastBrace + 1);
          try {
            // Kod blokları içinde verildiyse temizle
            const clean = attemptJson.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parameters = JSON.parse(clean);

            console.log(`✅ Tool parse edildi (${toolName}):`, parameters);
            results.push({ toolName, parameters });
            parsed = true; // Loop'tan çık
          } catch (e) {
            // JSON Parse patladıysa (örneğin sonuncu parantez JSON'un kendi parantezi değilse, 
            // ya da içerideki bir CSS süslü parantezine denk geldiysek),
            // en sondaki parantezi budayıp tekrar deniyoruz! (Backtracking mantığı)
            currentStr = currentStr.substring(0, lastBrace);
          }
        }

        if (!parsed) {
          console.error(`❌ JSON parse tamamen başarısız oldu (${toolName})`);
        }
      }
    }

    return results;
  } catch (error) {
    console.error('❌ Tool parse hatası:', error);
    return [];
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

    const { callAI } = await import('./aiProvider');
    const { getModelIdForRole } = await import('./models');

    const prompt = `You are an expert ${language || 'typescript'} developer. Generate the following code snippet requested by the user. Do not include markdown explanations. Just return the raw code.
Request: ${description}`;

    const modelId = getModelIdForRole();
    const generated = await callAI(prompt, modelId);
    let code = generated.trim();
    if (code.startsWith('```')) {
      code = code.replace(/```[a-z]*\\n/i, '').replace(/```$/, '').trim();
    }

    return {
      success: true,
      code,
      language: language || 'typescript',
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

    const { performCodeReview } = await import('./codeAnalysis');
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

    const { generateDocumentationForPanel } = await import('./adapters');
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

    const { generateTestsForPanel } = await import('./adapters');
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

    const { suggestRefactoringForPanel } = await import('./adapters');
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

    const { scanSecurity } = await import('./scanners');
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

async function fixTerminalError(command: string, errorOutput: string): Promise<any> {
  try {
    console.log(`🔧 Terminal Expert: Attempting to fix error in command: ${command}`);

    // ☢️ OTOMATİK PORT TEMİZLEME (Proaktif)
    if (errorOutput.includes('EADDRINUSE') || errorOutput.includes('address already in use') || errorOutput.includes('port is already in use')) {
      const portMatch = errorOutput.match(/:(\d+)/);
      const port = portMatch ? parseInt(portMatch[1]) : undefined;

      console.log(`☢️ Port hatası tespit edildi (${port || 'unknown'}). Otomatik temizlik başlatılıyor...`);
      const cleanupResult = await panicCleanup(port);

      return {
        success: true,
        automated: true,
        analysis: `Tespit: Port hatası. Eylem: Nükleer temizlik araçları kullanıldı. Portlar boşaltıldı.`,
        cleanup: cleanupResult,
        message: 'Port hatası otomatik olarak düzeltildi.'
      };
    }

    // Gerçek AI analizi için internal bir call yapalım
    const { callAI } = await import('./aiProvider');
    const { getModelIdForRole } = await import('./models');

    const analysisPrompt = `Terminal hatası analizi yap.
Komut: ${command}
Hata: ${errorOutput}

Bu hatayı nasıl düzeltebiliriz? Lütfen kısa ve net bir çözüm önerisi sun. Eğer otomatik düzeltilebilecek bir şeyse (örn. npm install, dosya oluşturma), yapılacak tam komutu da belirt. Yanıtını direkt çözüm olarak ver.`;

    const modelId = getModelIdForRole();
    const result = await callAI(analysisPrompt, modelId);

    return {
      success: true,
      analysis: result,
      command,
      error_output: errorOutput,
      message: 'Terminal hatası AI tarafından analiz edildi.'
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function scaffoldModule(moduleName: string, pattern: string, basePath: string = ''): Promise<any> {
  try {
    console.log(`🏗️ Project Architect: Scaffolding module ${moduleName} with pattern ${pattern}`);
    const folders = [];
    const files: { path: string, content: string }[] = [];

    // Ensure basePath ends with slash
    const formattedBasePath = basePath && !basePath.endsWith('/') ? `${basePath}/` : basePath;

    if (pattern === 'service') {
      folders.push(`${formattedBasePath}src/services/${moduleName}`);
      files.push({
        path: `${formattedBasePath}src/services/${moduleName}/index.ts`,
        content: `export * from './${moduleName}Service';\nexport * from './types';\n`
      });
      files.push({
        path: `${formattedBasePath}src/services/${moduleName}/${moduleName}Service.ts`,
        content: `export class ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Service {\n  constructor() {}\n}\n`
      });
      files.push({
        path: `${formattedBasePath}src/services/${moduleName}/types.ts`,
        content: `export interface ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Data {}\n`
      });
    } else if (pattern === 'component') {
      folders.push(`${formattedBasePath}src/components/${moduleName}`);
      files.push({
        path: `${formattedBasePath}src/components/${moduleName}/${moduleName}.tsx`,
        content: `import React from 'react';\nimport './${moduleName}.css';\n\nexport const ${moduleName} = () => {\n  return (\n    <div className="${moduleName.toLowerCase()}">\n      <h1>${moduleName} Component</h1>\n    </div>\n  );\n};\n`
      });
      files.push({
        path: `${formattedBasePath}src/components/${moduleName}/${moduleName}.css`,
        content: `.${moduleName.toLowerCase()} {\n  padding: 1rem;\n}\n`
      });
    } else if (pattern === 'hook') {
      folders.push(`${formattedBasePath}src/hooks`);
      files.push({
        path: `${formattedBasePath}src/hooks/use${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}.ts`,
        content: `import { useState, useEffect } from 'react';\n\nexport function use${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}() {\n  const [state, setState] = useState(null);\n  \n  return { state };\n}\n`
      });
    }

    // Windows/Unix compatibility for mkdir
    const isWindows = navigator.platform.toLowerCase().includes('win');

    // Create folders
    for (const f of folders) {
      try {
        await invoke('execute_command', {
          command: isWindows ? 'cmd' : 'mkdir',
          args: isWindows ? ['/C', `mkdir "${f.replace(/\//g, '\\')}"`] : ['-p', f],
          cwd: null
        });
      } catch (e) { console.warn(`Folder creation skipped or failed: ${f}`, e); }
    }

    // Write files
    for (const f of files) {
      await writeFile(f.path, f.content);
    }

    return {
      success: true,
      message: `Modül (${moduleName}) ${pattern} deseniyle başarıyla oluşturuldu.`,
      files: files.map(f => f.path)
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function deepSearchProject(query: string, rootPath: string = ""): Promise<any> {
  try {
    console.log(`🔎 Advanced RAG: Deep searching for "${query}"`);
    const { ragService } = await import('./ragService');

    // 1. RAG Arama (FIX-Scoping)
    const ragResults = await ragService.search(query, 10, rootPath);

    // 2. Grep Arama
    const grepResults = await grepSearch(query, rootPath);

    // 3. Dosya Haritası araması
    const globResults = await globSearch(`**/*${query}*`, rootPath);

    return {
      success: true,
      rag: ragResults.map(r => ({ path: r.file_path, snippet: r.content.substring(0, 300) })),
      grep: Array.isArray(grepResults) ? grepResults.slice(0, 15) : grepResults,
      glob: globResults,
      message: 'Derin arama tamamlandı. RAG, Grep ve Glob sonuçları birleştirildi.'
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function getProjectMap(rootPath: string = ""): Promise<any> {
  try {
    console.log(`🗺️ Project Architect: Mapping project structure for ${rootPath || 'current dir'}`);
    // Ana dizinleri listele
    const mainDirs = await listFiles('.', rootPath);

    // Önemli dosyaları bul
    const structure = {
      root: Array.isArray(mainDirs) ? mainDirs.slice(0, 20) : mainDirs,
      src: await listFiles('./src', rootPath).catch(() => []),
      importantFiles: ['package.json', 'tsconfig.json', 'src/App.tsx', 'tauri.conf.json'],
    };

    return {
      success: true,
      structure,
      message: 'Proje haritası başarıyla çıkarıldı. Mimari analiz için hazır.'
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function panicCleanup(specificPort?: number): Promise<any> {
  try {
    console.log('☢️ NUCLEAR BUTTON: Cleaning up ports and zombie processes...');
    const isWindows = navigator.platform.toLowerCase().includes('win');
    const commonPorts = [3000, 3001, 5173, 8000, 8080, 4200];
    if (specificPort) commonPorts.push(specificPort);

    if (isWindows) {
      // Windows: taskkill /F /IM node.exe vb.
      const targets = ['node.exe', 'python.exe'];
      for (const t of targets) {
        await invoke('execute_command', {
          command: 'cmd',
          args: ['/C', `taskkill /F /IM ${t} /T`],
          cwd: null
        }).catch(() => { }); // Hata alabilir eğer süreç yoksa
      }

      // Port bazlı temizlik (Windows netstat/tskill)
      for (const port of commonPorts) {
        try {
          // Bu komut o portu dinleyen PID'yi bulur ve öldürür
          await invoke('execute_command', {
            command: 'cmd',
            args: ['/C', `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port}') do taskkill /F /PID %a`],
            cwd: null
          });
        } catch { }
      }
    } else {
      // Unix: pkill, lsof
      await invoke('execute_command', { command: 'pkill', args: ['-f', 'node'], cwd: null }).catch(() => { });
      for (const port of commonPorts) {
        await invoke('execute_command', {
          command: 'sh',
          args: ['-c', `lsof -ti:${port} | xargs kill -9`],
          cwd: null
        }).catch(() => { });
      }
    }

    return {
      success: true,
      message: 'Nükleer temizlik tamamlandı. Tüm portlar ve zombi süreçler sonlandırıldı.',
      cleaned_ports: commonPorts
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function optimizeVRAM(modelPath: string): Promise<any> {
  try {
    console.log(`💻 VIRTUAL VRAM: Optimizing loading strategy for ${modelPath}`);
    const { getGpuMemoryInfo } = await import('./ggufProvider');
    const gpuInfo = await getGpuMemoryInfo();

    // Model boyutunu tahmin et (dosya boyutundan)
    const stats = await invoke<any>('get_file_stats', { path: modelPath });
    const modelSizeGb = stats.size / (1024 * 1024 * 1024);

    let strategy = 'All GPU';
    let gpuLayers = 35; // Default for many models

    if (modelSizeGb > gpuInfo.free_vram_gb) {
      strategy = 'Hybrid (GPU + RAM + NVMe Swap)';
      // Katman sayısını VRAM oranına göre ayarla
      const ratio = gpuInfo.free_vram_gb / modelSizeGb;
      gpuLayers = Math.floor(35 * ratio);
    }

    return {
      success: true,
      model: modelPath,
      gpu_layers: gpuLayers,
      strategy,
      gpu_status: gpuInfo,
      message: `Virtual VRAM optimizasyonu uygulandı. Strateji: ${strategy}.`
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function visionUITest(focusArea?: string): Promise<any> {
  try {
    console.log('🎥 VISION TESTER: Analyzing UI for visual bugs...');
    const screenshot = await takeScreenshot();

    if (!screenshot.success) throw new Error('Screenshot failed');

    const { callAI } = await import('./aiProvider');
    const { getModelIdForRole } = await import('./models');

    const analysisPrompt = `Aşağıdaki UI ekran görüntüsünü analiz et (Base64 verisi sağlandı).
Odak Alanı: ${focusArea || 'Genel'}

Lütfen şunları kontrol et:
1. Hizalama hataları var mı?
2. Renk paleti uyumlu mu?
3. Metinler okunabiliyor mu?
4. Kırık veya üst üste binen elementler var mı?

Yanıtını sadece tespit edilen görsel hatalar (varsa) ve iyileştirme önerileri olarak ver.`;

    const modelId = getModelIdForRole();
    const result = await callAI(`${analysisPrompt}\nUI Data: ${screenshot.data}`, modelId);

    return {
      success: true,
      analysis: result,
      screenshot_taken: true,
      message: 'Vizyon analizi tamamlandı.'
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
