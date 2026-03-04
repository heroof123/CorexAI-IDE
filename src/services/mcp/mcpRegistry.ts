import { McpServerConfig, mcpServerManager } from './mcpServerManager';

export interface RegisteredMcpServer extends McpServerConfig {
    isEnabled: boolean;
    status: 'stopped' | 'running' | 'error';
}

class McpRegistry {
    private servers: Map<string, RegisteredMcpServer> = new Map();
    private listeners = new Set<(servers: RegisteredMcpServer[]) => void>();

    async register(config: McpServerConfig) {
        if (!this.servers.has(config.name)) {
            this.servers.set(config.name, {
                ...config,
                isEnabled: true,
                status: 'stopped'
            });
            this.notifyListeners();
        }
    }

    async deregister(name: string) {
        if (this.servers.has(name)) {
            await this.stopServer(name);
            this.servers.delete(name);
            this.notifyListeners();
        }
    }

    async startServer(name: string) {
        const server = this.servers.get(name);
        if (server && server.status !== 'running') {
            const success = await mcpServerManager.startServer(server);
            if (success) {
                server.status = 'running';
                this.notifyListeners();
            } else {
                server.status = 'error';
                this.notifyListeners();
            }
        }
    }

    async stopServer(name: string) {
        const server = this.servers.get(name);
        if (server && server.status === 'running') {
            const success = await mcpServerManager.stopServer(name);
            if (success) {
                server.status = 'stopped';
                this.notifyListeners();
            }
        }
    }

    getServers(): RegisteredMcpServer[] {
        return Array.from(this.servers.values());
    }

    subscribe(listener: (servers: RegisteredMcpServer[]) => void) {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    private notifyListeners() {
        const servers = this.getServers();
        this.listeners.forEach(l => l(servers));
    }
}

export const mcpRegistry = new McpRegistry();
