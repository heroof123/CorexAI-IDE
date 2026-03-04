export interface SamplingMessage {
    role: 'user' | 'assistant';
    content: {
        type: 'text' | 'image';
        text?: string;
    };
}

export interface CreateMessageRequest {
    messages: SamplingMessage[];
    systemPrompt?: string;
    includeContext?: 'none' | 'thisServer' | 'allServers';
    temperature?: number;
    maxTokens: number;
}

export interface CreateMessageResult {
    content: {
        type: 'text';
        text: string;
    };
    model: string;
    stopReason: string;
    role: 'user' | 'assistant';
}

class McpSamplingService {
    /**
     * MCP sunucusundan gelen örnekleme isteklerini temsil eder (Draft).
     * Gerçek dünya senaryosunda bu özellik eklendiğinde Local AI (LLaMA vs)
     * modellerine ya da uzak apilere yönlendirilecektir.
     */
    async handleCreateMessageRequest(request: CreateMessageRequest): Promise<CreateMessageResult> {

        console.log("Sampling isteği alındı:", request);

        return {
            content: {
                type: 'text',
                text: "Mock sampling cevabı"
            },
            model: "CorexAI-local",
            stopReason: "stop",
            role: "assistant"
        };
    }
}

export const mcpSamplingService = new McpSamplingService();
