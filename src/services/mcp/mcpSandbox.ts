/**
 * Sandbox izolasyonu için kullanılan soyutlama servisi.
 * MCP istemcileri (özellikle 3. parti eklentilerden gelenler) 
 * bu sandbox üzerinden filtreleyerek execute edilir.
 */

export class McpSandbox {
    private permissions: Set<string> = new Set();

    grantPermission(permission: string) {
        this.permissions.add(permission);
    }

    revokePermission(permission: string) {
        this.permissions.delete(permission);
    }

    hasPermission(permission: string): boolean {
        return this.permissions.has(permission);
    }

    /**
     * Sadece izin verilen çağrıları sunucuya iletir
     */
    enforceSandbox(method: string): boolean {
        // İleride detaylı permission routing uygulanacak
        const isBannedMethod = ['unsafe_exec', 'shell_eval'].includes(method);
        return !isBannedMethod;
    }
}

export const mcpSandbox = new McpSandbox();
