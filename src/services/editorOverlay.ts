// src/services/editorOverlay.ts
// Editor Reasoning Overlay - Monaco decorations for AI insights

import * as monaco from "monaco-editor";
import type { CodeInsight } from "../types/ai-native";
import { backgroundReasoner } from "./backgroundReasoner";
import { smartCodeLensProvider } from "./codeLensProvider";
import { SymbolResolver } from "./symbolResolver";
import { registerAICodeActionProvider } from "./editor/aiCodeActionProvider";
import { registerAdvancedInlineCompletions } from "./editor/advancedInlineCompletions";

/**
 * Editor Overlay
 * Displays AI insights as Monaco editor decorations
 */
export class EditorOverlay {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private decorations: string[] = [];
  private dismissedInsights: Set<string> = new Set();
  private symbolResolver: SymbolResolver = new SymbolResolver();

  constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    this.editor = editor;
    this.loadDismissedInsights();
    this.registerHoverProvider();
    this.registerCodeActionProvider();
    this.registerCodeLensProvider();
    this.registerInlineCompletionProvider();
  }

  /**
   * 🆕 TASK 12.1, 12.2: Update decorations from insights
   */
  updateDecorations(insights: CodeInsight[]): void {
    const decorationOptions: monaco.editor.IModelDeltaDecoration[] = [];

    insights.forEach(insight => {
      // 🆕 TASK 12.6: Check if dismissed
      const insightKey = this.getInsightKey(insight);
      if (this.dismissedInsights.has(insightKey)) {
        return;
      }

      const range = new monaco.Range(
        insight.line,
        insight.column,
        insight.line,
        insight.column + 1
      );

      const options = this.getDecorationOptions(insight);

      decorationOptions.push({
        range,
        options,
      });
    });

    // 🆕 TASK 20.1: Update decorations within 500ms
    this.decorations = this.editor.deltaDecorations(this.decorations, decorationOptions);

    console.log(`🎨 Updated ${decorationOptions.length} decorations`);
  }

  /**
   * 🆕 TASK 12.1: Get decoration options based on insight
   */
  private getDecorationOptions(insight: CodeInsight): monaco.editor.IModelDecorationOptions {
    const baseOptions: monaco.editor.IModelDecorationOptions = {
      isWholeLine: false,
      glyphMarginClassName: this.getGlyphClass(insight),
      hoverMessage: {
        value: this.formatHoverMessage(insight),
        isTrusted: true,
      },
      minimap: {
        color: this.getMinimapColor(insight),
        position: monaco.editor.MinimapPosition.Inline,
      },
    };

    // 🆕 TASK 12.2, 12.4: Add underline for errors/warnings
    if (insight.severity === "error") {
      baseOptions.className = "corex-error-decoration";
      baseOptions.inlineClassName = "corex-error-inline";
    } else if (insight.severity === "warning") {
      baseOptions.className = "corex-warning-decoration";
      baseOptions.inlineClassName = "corex-warning-inline";
    } else {
      baseOptions.className = "corex-info-decoration";
    }

    return baseOptions;
  }

  /**
   * Get glyph margin icon class
   */
  private getGlyphClass(insight: CodeInsight): string {
    switch (insight.severity) {
      case "error":
        return "corex-glyph-error";
      case "warning":
        return "corex-glyph-warning";
      case "info":
        return "corex-glyph-lightbulb";
      default:
        return "";
    }
  }

  /**
   * Get minimap color
   */
  private getMinimapColor(insight: CodeInsight): string {
    switch (insight.severity) {
      case "error":
        return "#ff0000";
      case "warning":
        return "#ffa500";
      case "info":
        return "#00bfff";
      default:
        return "#808080";
    }
  }

  /**
   * Format hover message
   */
  private formatHoverMessage(insight: CodeInsight): string {
    const icon = insight.severity === "error" ? "❌" : insight.severity === "warning" ? "⚠️" : "ℹ️";

    return `${icon} **${insight.category}**: ${insight.message}\n\n[Dismiss](command:corex.dismissInsight?${this.getInsightKey(insight)})`;
  }

  /**
   * 🆕 TASK 12.8: Register hover provider for symbol information
   */
  private registerHoverProvider(): void {
    monaco.languages.registerHoverProvider("typescript", {
      provideHover: async (model, position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        // Get symbol information from semantic brain
        const symbolInfo = await this.getSymbolInfo(word.word);
        if (!symbolInfo) return null;

        const contents: monaco.IMarkdownString[] = [
          { value: `**${symbolInfo.name}** (${symbolInfo.kind})`, isTrusted: true },
          { value: `\`\`\`typescript\n${symbolInfo.signature}\n\`\`\``, isTrusted: true },
        ];

        if (symbolInfo.documentation) {
          contents.push({ value: symbolInfo.documentation, isTrusted: true });
        }

        // Add usage count
        const usageCount = symbolInfo.references?.length || 0;
        contents.push({ value: `📊 Used ${usageCount} times`, isTrusted: true });

        return {
          contents,
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn
          ),
        };
      },
    });
  }

  /**
   * Get symbol information using SymbolResolver
   */
  private async getSymbolInfo(symbolName: string): Promise<any | null> {
    try {
      // Resolve symbol definition
      const definition = this.symbolResolver.resolveDefinition(symbolName);
      if (definition) {
        return {
          name: symbolName,
          definition,
          references: this.symbolResolver.findReferences(symbolName),
        };
      }

      return null;
    } catch (error) {
      console.error("Failed to get symbol info:", error);
      return null;
    }
  }

  /**
   * 🆕 TASK 12.10: Register code action provider for quick fixes
   * Delegetes to aiCodeActionProvider (Modül 4.2)
   */
  private registerCodeActionProvider(): void {
    if ((window as any).__corexCodeActionRegistered) return;
    (window as any).__corexCodeActionRegistered = true;

    // Yalnızca bir kez global olarak kaydetmek daha verimli olur
    // ama bu class birden fazla editör için yaratılıyorsa guard ekledik.
    registerAICodeActionProvider();
    console.log("💎 AI Code Action Provider registered (Modül 4.2)");
  }

  /**
   * 🆕 Register Smart Code Lens Provider
   */
  private registerCodeLensProvider(): void {
    if ((window as any).__corexCodeLensRegistered) return;
    (window as any).__corexCodeLensRegistered = true;

    const languages = ["typescript", "javascript", "typescriptreact", "javascriptreact"];
    languages.forEach(lang => {
      monaco.languages.registerCodeLensProvider(lang, smartCodeLensProvider);
    });
    console.log("💎 Smart Code Lens Provider registered for:", languages.join(", "));
  }

  /**
   * 🔮 Register Predictive Inline Completion Provider (Ghost Text)
   * Delegates to advancedInlineCompletions (Modül 4.1)
   */
  private registerInlineCompletionProvider(): void {
    if ((window as any).__corexInlineCompletionsRegistered) return;
    (window as any).__corexInlineCompletionsRegistered = true;

    registerAdvancedInlineCompletions();
  }

  /**
   * 🆕 TASK 12.6: Dismiss insight
   */
  dismissInsight(insight: CodeInsight): void {
    const key = this.getInsightKey(insight);
    this.dismissedInsights.add(key);
    this.saveDismissedInsights();

    // 🆕 TASK 20.3: Remove decoration immediately
    this.updateDecorations(backgroundReasoner.getInsights(insight.file_path));

    console.log(`🚫 Dismissed insight: ${key}`);
  }

  /**
   * Get unique key for insight
   */
  private getInsightKey(insight: CodeInsight): string {
    return `${insight.file_path}:${insight.line}:${insight.message}`;
  }

  /**
   * 🆕 TASK 12.6: Load dismissed insights from localStorage
   */
  private loadDismissedInsights(): void {
    try {
      const stored = localStorage.getItem("corex-dismissed-insights");
      if (stored) {
        this.dismissedInsights = new Set(JSON.parse(stored));
      }
    } catch (error) {
      console.warn("Failed to load dismissed insights:", error);
    }
  }

  /**
   * 🆕 TASK 12.6: Save dismissed insights to localStorage
   */
  private saveDismissedInsights(): void {
    try {
      const array = Array.from(this.dismissedInsights);
      localStorage.setItem("corex-dismissed-insights", JSON.stringify(array));
    } catch (error) {
      console.warn("Failed to save dismissed insights:", error);
    }
  }

  /**
   * Clear all decorations
   */
  clearDecorations(): void {
    this.decorations = this.editor.deltaDecorations(this.decorations, []);
    console.log("🗑️ Cleared all decorations");
  }

  /**
   * Clear dismissed insights
   */
  clearDismissed(): void {
    this.dismissedInsights.clear();
    this.saveDismissedInsights();
    console.log("🗑️ Cleared dismissed insights");
  }
}
