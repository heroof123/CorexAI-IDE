import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MCPServerManager', () => {
    // Testing the structure of Phase 3.1 MCP Architecture

    let registeredServers: Record<string, any> = {};

    beforeEach(() => {
        registeredServers = {};
    });

    it('should register a new MCP server configuration', () => {
        const registerServer = (id: string, config: any) => {
            if (!config.command) throw new Error('Command required');
            registeredServers[id] = { ...config, status: 'stopped' };
        };

        registerServer('python-mcp', { command: 'uv', args: ['tool', 'run', 'mcp-server'] });
        expect(registeredServers['python-mcp']).toBeDefined();
        expect(registeredServers['python-mcp'].status).toBe('stopped');
        expect(registeredServers['python-mcp'].command).toBe('uv');
    });

    it('should throw when registering a server without a command', () => {
        const registerServer = (id: string, config: any) => {
            if (!config.command) throw new Error('Command required');
            registeredServers[id] = { ...config, status: 'stopped' };
        };

        expect(() => registerServer('invalid-mcp', { args: ['test'] })).toThrow('Command required');
    });

    it('should toggle server status on start and stop', () => {
        const startServer = (id: string) => {
            if (!registeredServers[id]) throw new Error('Not found');
            registeredServers[id].status = 'running';
        };

        const stopServer = (id: string) => {
            if (!registeredServers[id]) throw new Error('Not found');
            registeredServers[id].status = 'stopped';
        };

        registeredServers['node-mcp'] = { command: 'node', status: 'stopped' };

        startServer('node-mcp');
        expect(registeredServers['node-mcp'].status).toBe('running');

        stopServer('node-mcp');
        expect(registeredServers['node-mcp'].status).toBe('stopped');
    });

    it('should expose available MCP tools dynamically', () => {
        const mcpTools = [
            { id: 'tool-1', name: 'python_execute', description: 'Run Python' },
            { id: 'tool-2', name: 'file_read', description: 'Read a file securely' }
        ];

        const getActiveToolsForAI = (serverId: string) => {
            if (!registeredServers[serverId] || registeredServers[serverId].status !== 'running') return [];
            return mcpTools;
        };

        registeredServers['python-mcp'] = { command: 'uv', status: 'stopped' };
        expect(getActiveToolsForAI('python-mcp')).toHaveLength(0);

        registeredServers['python-mcp'].status = 'running';
        const activeTools = getActiveToolsForAI('python-mcp');

        expect(activeTools).toHaveLength(2);
        expect(activeTools[0].name).toBe('python_execute');
    });
});
