import { mcpServerManager } from './mcpServerManager';

export interface McpTool {
    name: string;
    description: string;
    inputSchema: any;
}

class McpToolBroker {
    private toolCache: Map<string, McpTool[]> = new Map();

    async fetchTools(serverName: string): Promise<McpTool[]> {
        try {
            const response = await mcpServerManager.sendRequest<{ tools: McpTool[] }>(serverName, 'tools/list');
            if (response && response.tools) {
                this.toolCache.set(serverName, response.tools);
                return response.tools;
            }
            return [];
        } catch (error) {
            console.error(`Failed to fetch tools from ${serverName}:`, error);
            return this.toolCache.get(serverName) || [];
        }
    }

    async callTool(serverName: string, toolName: string, args: any): Promise<any> {
        try {
            return await mcpServerManager.sendRequest(serverName, 'tools/call', {
                name: toolName,
                arguments: args
            });
        } catch (error) {
            console.error(`Failed to call tool ${toolName} on ${serverName}:`, error);
            throw error;
        }
    }

    getTools(serverName: string): McpTool[] {
        return this.toolCache.get(serverName) || [];
    }
}

export const mcpToolBroker = new McpToolBroker();
