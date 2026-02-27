import { invoke } from "@tauri-apps/api/core";
import { AGENT_ROLES } from "../prompts/roles";

export interface AgentResponse {
    role: string;
    content: string;
    verdict?: "Pass" | "Request Changes";
}

export interface SwarmResult {
    architectPlan: string;
    implementation: string;
    qaReport: string;
    finalVerdict: "Pass" | "Request Changes";
}

export const agentSwarm = {
    /**
     * Run the full multi-agent workflow for a complex task
     */
    async executeTask(userTask: string, providerConfig: any): Promise<SwarmResult> {
        console.log("🚀 Starting Swarm Workflow for task:", userTask);

        // 1. Architect Stage
        console.log("🏛️ Step 1: Architecting...");
        const architectResponse = await this.callAgent(
            userTask,
            AGENT_ROLES.ARCHITECT.systemPrompt,
            providerConfig
        );

        // 2. Developer Stage
        console.log("💻 Step 2: Implementing...");
        const developerInput = `Task: ${userTask}\n\nArchitect's Plan: ${architectResponse}`;
        const developerResponse = await this.callAgent(
            developerInput,
            AGENT_ROLES.DEVELOPER.systemPrompt,
            providerConfig
        );

        // 3. QA Stage
        console.log("🧪 Step 3: Quality Assurance...");
        const qaInput = `Original Task: ${userTask}\n\nArchitect's Plan: ${architectResponse}\n\nImplementation:\n${developerResponse}`;
        const qaResponse = await this.callAgent(
            qaInput,
            AGENT_ROLES.QA.systemPrompt,
            providerConfig
        );

        // Basic heuristic to detect verdict from QA text
        const finalVerdict = qaResponse.toLowerCase().includes("request changes") ? "Request Changes" : "Pass";

        return {
            architectPlan: architectResponse,
            implementation: developerResponse,
            qaReport: qaResponse,
            finalVerdict
        };
    },

    /**
     * Helper to call a dynamic AI model with a specific system prompt
     */
    async callAgent(message: string, systemPrompt: string, providerConfig: any): Promise<string> {
        try {
            // Inject system prompt into context
            const conversationHistory = [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ];

            const response = await invoke<string>("chat_with_dynamic_ai", {
                message,
                conversationHistory,
                providerConfig
            });

            return response;
        } catch (error) {
            console.error("❌ Agent call failed:", error);
            throw error;
        }
    }
};
