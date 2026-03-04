import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface McpServerConfig {
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
}

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: any;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: any;
    error?: any;
}

export class McpServerManager {
    private responseCallbacks = new Map<string | number, { resolve: (val: any) => void, reject: (err: any) => void }>();
    private unlistenFns = new Map<string, UnlistenFn>();

    async startServer(config: McpServerConfig): Promise<boolean> {
        try {
            await invoke('start_mcp_server', { config });

            // Listen for stdio responses
            const unlisten = await listen<string>(`mcp-response-${config.name}`, (event) => {
                this.handleResponse(event.payload);
            });
            this.unlistenFns.set(config.name, unlisten);
            return true;
        } catch (error) {
            console.error(`Failed to start MCP server ${config.name}:`, error);
            return false;
        }
    }

    async stopServer(serverName: string): Promise<boolean> {
        try {
            await invoke('stop_mcp_server', { serverName });

            const unlisten = this.unlistenFns.get(serverName);
            if (unlisten) {
                unlisten();
                this.unlistenFns.delete(serverName);
            }
            return true;
        } catch (error) {
            console.error(`Failed to stop MCP server ${serverName}:`, error);
            return false;
        }
    }

    async listServers(): Promise<McpServerConfig[]> {
        try {
            return await invoke<McpServerConfig[]>('list_mcp_servers');
        } catch (error) {
            console.error('Failed to list MCP servers:', error);
            return [];
        }
    }

    async sendRequest<T = any>(serverName: string, method: string, params?: any): Promise<T> {
        const id = crypto.randomUUID();
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };

        return new Promise((resolve, reject) => {
            this.responseCallbacks.set(id, { resolve, reject });

            // Timeout to prevent hanging
            setTimeout(() => {
                if (this.responseCallbacks.has(id)) {
                    this.responseCallbacks.delete(id);
                    reject(new Error(`MCP Request timeout: ${method}`));
                }
            }, 30000);

            invoke('send_mcp_request', {
                serverName,
                request: JSON.stringify(request)
            }).catch(reject);
        });
    }

    private handleResponse(payload: string) {
        try {
            const response = JSON.parse(payload) as JsonRpcResponse;
            if (response && response.id && this.responseCallbacks.has(response.id)) {
                const callbacks = this.responseCallbacks.get(response.id)!;
                this.responseCallbacks.delete(response.id);

                if (response.error) {
                    callbacks.reject(response.error);
                } else {
                    callbacks.resolve(response.result);
                }
            } else if (response && (response as any).method) {
                // Bu bir notification veya yetkilendirme isteği olabilir
                // TODO: İleride sunucudan gelen bildirimleri (ör. tool logları) ele almak için eklenebilir.
            }
        } catch (e) {
            // Sadece log mesajları buraya düşebilir. Normal console payloadları
            console.log("MCP Log:", payload);
        }
    }
}

export const mcpServerManager = new McpServerManager();
