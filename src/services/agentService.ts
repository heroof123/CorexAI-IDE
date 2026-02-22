import { Message } from "../types";

export interface ErrorPattern {
  regex: RegExp;
  language: string;
  type: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  { regex: /Error: (.*?)(?:\n|$)/i, language: "generic", type: "error" },
  { regex: /SyntaxError: (.*?)(?:\n|$)/i, language: "javascript", type: "syntax" },
  { regex: /failed to compile/i, language: "web", type: "build" },
  { regex: /error\[E\d+\]: (.*?)(?:\n|$)/i, language: "rust", type: "compiler" },
];

export class AgentService {
  private static instance: AgentService;
  private chatCallbacks: Set<(msg: Omit<Message, "id">) => void> = new Set();
  private isHealing: boolean = false;

  private constructor() { }

  public static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  public registerChatCallback(callback: (msg: Omit<Message, "id">) => void): void {
    this.chatCallbacks.add(callback);
  }

  public unregisterChatCallback(callback: (msg: Omit<Message, "id">) => void): void {
    this.chatCallbacks.delete(callback);
  }

  /**
   * Watch terminal output for errors
   */
  public async analyzeTerminalOutput(lines: string[]) {
    if (this.isHealing || lines.length === 0) return;

    const lastLine = lines[lines.length - 1];
    const context = lines.slice(-10).join("\n");

    for (const pattern of ERROR_PATTERNS) {
      const match = lastLine.match(pattern.regex);
      if (match) {
        console.log("避 Agent detected error:", match[0]);
        this.handleErrorDetected(match[0], context, pattern);
        break;
      }
    }
  }

  private async handleErrorDetected(errorLine: string, context: string, pattern: ErrorPattern) {
    this.chatCallbacks.forEach(callback => {
      try {
        callback({
          role: "system",
          content: `🤖 **Otonom Ajan Bir ${pattern.type.toUpperCase()} Hatası Tespit Etti!**\n\nTerminalde şu hata oluştu:\n\`\`\`\n${errorLine}\n\`\`\`\n\nBağlam:\n\`\`\`text\n${context}\n\`\`\`\n\n[✨ OTOMATİK DÜZELT](command:corex.applyAutofix?${encodeURIComponent(context)})`,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error("AgentService callback error:", err);
      }
    });

    // Reset healing state after some time or after fix
    setTimeout(() => {
      this.isHealing = false;
    }, 10000);
  }

  /**
   * 🧹 Proactively suggest refactoring for complex code
   */
  public proposeRefactoring(filePath: string, symbol: any, complexity: number) {
    this.chatCallbacks.forEach(callback => {
      try {
        callback({
          role: "system",
          content: `🧹 **Refactoring Önerisi: \`${symbol.name}\`**\n\nBu fonksiyonun karmaşıklığı oldukça yüksek (**${complexity}**). Kodu daha okunabilir ve sürdürülebilir hale getirmek için parçalara bölmemi ister misin?\n\n[Refactor Uygula](command:corex.applyRefactor?${encodeURIComponent(JSON.stringify({ filePath, symbol }))})`,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error("AgentService callback error:", err);
      }
    });

    // Award XP for clean code awareness
  }

  /**
   * 🤖 Apply the suggested fix for an error
   */
  public async applyAutofix(error: string) {
    console.log("🛠️ Agent applying auto-fix for:", error);

    try {
      // This will be called via command from UI
      this.chatCallbacks.forEach(callback => {
        try {
          callback({
            role: "system",
            content: "⏳ **Düzeltme uygulanıyor...** AI projeyi analiz ediyor.",
            timestamp: Date.now(),
          });
        } catch (err) {
          console.error("AgentService callback error:", err);
        }
      });

      // In a real scenario, this would trigger a specialized agent prompt
      // For now, we'll emit an event that the UI can catch to show excitement
      const event = new CustomEvent("corex-autofix-start", { detail: { error } });
      window.dispatchEvent(event);
    } catch (err) {
      console.error("❌ Auto-fix failed:", err);
    }
  }
}

export const agentService = AgentService.getInstance();
