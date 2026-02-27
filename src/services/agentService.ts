import { Message } from "../types";
import { getAutonomyConfig } from "./autonomy";

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
  private activeRole: 'Architect' | 'Developer' | 'QA' | 'CorexA' = 'CorexA';

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

  public getActiveRole() {
    return this.activeRole;
  }

  public setActiveRole(role: 'Architect' | 'Developer' | 'QA' | 'CorexA') {
    this.activeRole = role;
    console.log(`🤖 Agent Role Changed to: ${role}`);
  }

  public async analyzeTerminalOutput(lines: string[]) {
    if (this.isHealing || lines.length === 0) return;

    const context = lines.slice(-10).join("\n");

    for (const pattern of ERROR_PATTERNS) {
      const match = context.match(pattern.regex);
      if (match) {
        console.log("避 Autonomous Agent detected error in terminal context:", match[0]);
        this.handleErrorDetected(match[0], context, pattern);
        return; // Stop if error found
      }
    }

    // ✨ Detect Success Patterns
    if (context.includes("Build finished") || context.includes("Tests passed")) {
      console.log("🎉 Agent detected success in terminal!");
      const config = getAutonomyConfig();
      if (config.level >= 4) {
        this.chatCallbacks.forEach(callback => {
          callback({
            role: "system",
            content: `🎉 **Harika Haber!** Build/Test başarıyla tamamlandı. Otonom planın bir sonraki aşamasına geçmeye hazırım.`,
            timestamp: Date.now(),
          });
        });
      }
    }
  }

  /**
   * 🚨 Analyze code problems detected by UI
   */
  public async analyzeProblems(problems: any[]) {
    if (this.isHealing || problems.length === 0) return;

    const criticalProblems = problems.filter(p => p.severity === "error");
    if (criticalProblems.length > 0) {
      const p = criticalProblems[0];
      console.log("避 Agent detected critical code problem:", p.message);

      const config = getAutonomyConfig();
      if (config.level >= 4) {
        // High autonomy: Proactively suggest fix
        this.chatCallbacks.forEach(callback => {
          callback({
            role: "system",
            content: `🚨 **Kritik Hata Tespit Edildi: \`${p.file}\`**\n\nAI bu hatayı otomatik olarak analiz edip düzeltmeye hazır.\n\n[✨ OTOMATIK DÜZELT](command:corex.applyAutofix?${encodeURIComponent(p.message)})`,
            timestamp: Date.now(),
          });
        });
      }
    }
  }

  private async handleErrorDetected(errorLine: string, context: string, pattern: ErrorPattern) {
    const config = getAutonomyConfig();

    this.chatCallbacks.forEach(callback => {
      try {
        const autoFixCmd = `[✨ OTOMATİK DÜZELT](command:corex.applyAutofix?${encodeURIComponent(context)})`;
        const message = `🤖 **Otonom Ajan Bir ${pattern.type.toUpperCase()} Hatası Tespit Etti!**\n\nTerminalde şu hata oluştu:\n\`\`\`\n${errorLine}\n\`\`\`\n\n${config.level >= 4 ? "**Otonom Mod Aktif:** Analiz başlatılıyor..." : "Bağlam:\n\`\`\`text\n${context}\n\`\`\`\n\n" + autoFixCmd}`;

        callback({
          role: "system",
          content: message,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error("AgentService callback error:", err);
      }
    });

    // If level 5, we could even auto-invoke here
    if (config.level === 5) {
      console.log("🚀 Level 5 Autonomy: Triggering auto-fix immediately...");
      this.applyAutofix(context);
    }

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

  /**
   * 🚀 Automatically apply a suggestion (Level 5 Only)
   */
  public async applyAutonomousSuggestion(suggestion: any) {
    const config = getAutonomyConfig();
    if (config.level < 5) return;

    console.log("🚀 Level 5: Applying autonomous suggestion:", suggestion.id);
    this.chatCallbacks.forEach(callback => {
      callback({
        role: "system",
        content: `🚀 **Otonom Uygulama:** \`${suggestion.description}\` değişikliği otonom olarak (Level 5) uygulandı.`,
        timestamp: Date.now(),
      });
    });

    // Invoke the apply trigger (simulate user click on accept)
    const event = new CustomEvent("corex-apply-action", { detail: { actionId: suggestion.id } });
    window.dispatchEvent(event);
  }
}

export const agentService = AgentService.getInstance();
