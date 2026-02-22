// services/editOrchestrator.ts
// Edit Orchestrator - Cursor's core: Chat → Edit pipeline
// Transforms chat into code edits

import { planningAgent, Plan, PlanningContext } from "./planningAgent";
import { smartContextBuilder } from "./smartContextBuilder";
import { sendToAI } from "./ai";
import { FileIndex, CodeAction } from "../types/index";
import { createEmbedding } from "./embedding";

export interface EditRequest {
  userInput: string;
  currentFile?: string;
  currentContent?: string;
  openFiles: string[];
  recentFiles: string[];
  projectFiles: FileIndex[];
}

export interface EditResult {
  plan: Plan;
  actions: CodeAction[];
  explanation: string;
  contextUsed: string[];
}

/**
 * Edit Orchestrator
 * Transforms user chat into code edits (Cursor-style)
 * 
 * Pipeline:
 * 1. Hidden Planning (user doesn't see)
 * 2. Context Selection (smart)
 * 3. Code Generation (with plan)
 * 4. Diff Creation (show to user)
 */
export class EditOrchestrator {
  /**
   * Process user request and generate edits
   * This is the main Cursor-like pipeline
   */
  async processRequest(request: EditRequest): Promise<EditResult> {
    console.log("🎯 Edit Orchestrator: Processing request...");

    // STEP 1: Hidden Planning (Cursor's secret)
    const plan = await this.createHiddenPlan(request);
    console.log("📋 Plan:", plan);

    // Validate plan
    if (!planningAgent.validatePlan(plan)) {
      console.warn("⚠️ Invalid plan, using fallback");
      return this.createFallbackResult(request, plan);
    }

    // STEP 2: Smart Context Selection
    const context = await this.selectContext(request, plan);
    console.log("📚 Context selected:", context.length, "files");

    // STEP 3: Generate Code/Edits
    const actions = await this.generateEdits(request, plan, context);
    console.log("✏️ Generated", actions.length, "actions");

    // STEP 4: Create Explanation
    const explanation = this.createExplanation(plan, actions);

    return {
      plan,
      actions,
      explanation,
      contextUsed: context.map((c) => c.path),
    };
  }

  /**
   * STEP 1: Create hidden plan (user doesn't see this)
   */
  private async createHiddenPlan(request: EditRequest): Promise<Plan> {
    const planningContext: PlanningContext = {
      userInput: request.userInput,
      currentFile: request.currentFile,
      openFiles: request.openFiles,
      recentFiles: request.recentFiles,
      projectFiles: request.projectFiles,
    };

    let plan = await planningAgent.createPlan(planningContext);

    // Enhance plan with dependencies
    plan = await planningAgent.enhancePlan(plan, request.projectFiles);

    return plan;
  }

  /**
   * STEP 2: Select relevant context based on plan
   */
  private async selectContext(
    request: EditRequest,
    _plan: Plan
  ): Promise<Array<{ path: string; content: string; score: number }>> {
    // Create query embedding
    const queryEmbedding = await createEmbedding(request.userInput);

    // Use smart context builder with correct signature
    const context = await smartContextBuilder.buildContext(
      request.userInput,
      queryEmbedding,
      request.projectFiles,
      request.currentFile,
      {
        maxFiles: 5,
      }
    );

    return context;
  }

  /**
   * STEP 3: Generate code edits based on plan and context
   */
  private async generateEdits(
    request: EditRequest,
    plan: Plan,
    context: Array<{ path: string; content: string; score: number }>
  ): Promise<CodeAction[]> {
    const actions: CodeAction[] = [];

    // Build prompt for code generation
    const prompt = this.buildEditPrompt(request, plan, context);

    try {
      // Generate code with AI
      const response = await sendToAI(prompt, false);

      // Parse code actions from response
      const parsedActions = this.parseCodeActions(response, plan);

      actions.push(...parsedActions);
    } catch (error) {
      console.error("❌ Edit generation failed:", error);
    }

    return actions;
  }

  /**
   * Build prompt for edit generation
   */
  private buildEditPrompt(
    request: EditRequest,
    plan: Plan,
    context: Array<{ path: string; content: string; score: number }>
  ): string {
    let prompt = `You are a code editor AI. Generate precise code edits.

USER REQUEST: "${request.userInput}"

PLAN:
- Intent: ${plan.intent}
- Target files: ${plan.targetFiles.join(", ")}
- Steps: ${plan.steps.join(" → ")}

`;

    // Add context files
    if (context.length > 0) {
      prompt += `\nRELEVANT CONTEXT:\n`;
      for (const ctx of context.slice(0, 3)) {
        prompt += `\n--- ${ctx.path} ---\n${ctx.content.substring(0, 500)}...\n`;
      }
    }

    // Add current file if editing
    if (plan.intent === "edit_file" && request.currentFile && request.currentContent) {
      prompt += `\n--- CURRENT FILE: ${request.currentFile} ---\n${request.currentContent}\n`;
    }

    prompt += `\nTASK: Generate code edits in this format:

ACTION: create | modify | delete
FILE: path/to/file.ts
CONTENT:
\`\`\`typescript
// code here
\`\`\`

RULES:
1. Be precise and minimal
2. Only change what's necessary
3. Maintain code style
4. Add comments if complex
5. Return multiple actions if needed

Generate the edits now:`;

    return prompt;
  }

  /**
   * Parse code actions from AI response (FIX-21)
   */
  private parseCodeActions(response: string, plan: Plan): CodeAction[] {
    const actions: CodeAction[] = [];

    // 1. Flexible regex - allows more variations (FIX-21)
    const actionPattern = /ACTION\s*:\s*(create|modify|delete)\s*[\r\n]+FILE\s*:\s*(.+?)\s*[\r\n]+CONTENT\s*:?\s*[\r\n]*```(?:\w+)?[\r\n]+([\s\S]*?)```/gi;

    let match;
    while ((match = actionPattern.exec(response)) !== null) {
      actions.push({
        id: `action-${Date.now()}-${actions.length}`,
        type: match[1].toLowerCase() as "create" | "modify" | "delete",
        filePath: match[2].trim(),
        content: match[3].trim(),
        oldContent: "",
        description: `${match[1]} ${match[2]}`,
      });
    }

    // 2. JSON Fallback (FIX-21)
    if (actions.length === 0) {
      const jsonMatch = response.match(/\[\s*\{[\s\S]*?\}\s*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          for (const item of parsed) {
            if (item.type && item.filePath) {
              actions.push({
                id: `action-json-${Date.now()}-${actions.length}`,
                type: item.type,
                filePath: item.filePath,
                content: item.content || "",
                oldContent: "",
                description: `${item.type} ${item.filePath}`,
              });
            }
          }
        } catch { /* parse error */ }
      }
    }

    // 3. Fallback: match code blocks with target files (FIX-21)
    if (actions.length === 0 && plan.targetFiles.length > 0) {
      const codeBlockPattern = /```(?:\w+)?\n([\s\S]*?)```/g;
      const codeBlocks: string[] = [];
      while ((match = codeBlockPattern.exec(response)) !== null) {
        codeBlocks.push(match[1].trim());
      }

      for (let i = 0; i < Math.min(plan.targetFiles.length, codeBlocks.length); i++) {
        actions.push({
          id: `action-fb-${Date.now()}-${i}`,
          type: plan.intent === "create_file" ? "create" : "modify",
          filePath: plan.targetFiles[i],
          content: codeBlocks[i],
          oldContent: "",
          description: `Fallback ${plan.intent} ${plan.targetFiles[i]}`,
        });
      }
    }

    return actions;
  }

  /**
   * STEP 4: Create explanation for user
   */
  private createExplanation(plan: Plan, actions: CodeAction[]): string {
    let explanation = `📋 Plan: ${plan.reasoning}\n\n`;

    if (actions.length > 0) {
      explanation += `✏️ Changes:\n`;
      for (const action of actions) {
        explanation += `- ${action.type} ${action.filePath}\n`;
      }
    } else {
      explanation += `ℹ️ No code changes needed. This is an explanation request.`;
    }

    return explanation;
  }

  /**
   * Create fallback result when planning fails
   */
  private createFallbackResult(_request: EditRequest, plan: Plan): EditResult {
    return {
      plan,
      actions: [],
      explanation: "Unable to generate edits. Please try rephrasing your request.",
      contextUsed: [],
    };
  }

  /**
   * Quick check: Does this request need editing?
   */
  needsEditing(userInput: string): boolean {
    const editKeywords = [
      "düzenle",
      "değiştir",
      "oluştur",
      "yeni",
      "ekle",
      "sil",
      "refactor",
      "edit",
      "change",
      "create",
      "new",
      "add",
      "delete",
      "remove",
      "fix",
      "bug",
    ];

    const lower = userInput.toLowerCase();
    return editKeywords.some((keyword) => lower.includes(keyword));
  }
}

// Singleton instance
export const editOrchestrator = new EditOrchestrator();
