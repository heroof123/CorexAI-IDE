export async function discoverMcpConfigs(_workspacePath: string = '.'): Promise<string[]> {
    // Burada workspace içindeki `mcp.json` veya `.mcp/config.json` gibi dosyaları
    // Rust tarafında taratıp geri döndürebiliriz.
    try {
        // Örnek: `scan_mcp_configs` adlı Rust komutu, sonrasında implementasyonu eklenebilir.
        // Şimdilik mocklayalım.
        return [];
    } catch (error) {
        console.error('Failed to discover MCP configs:', error);
        return [];
    }
}
