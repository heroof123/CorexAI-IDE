// src/services/pluginService.ts
import { invoke } from "@tauri-apps/api/core";
import { PluginManifest, CorexPlugin, PluginAPI } from "../types/plugin";

class PluginService {
    private plugins: Map<string, CorexPlugin> = new Map();
    private api: PluginAPI;

    constructor() {
        this.api = {
            version: "0.1.0-beta",
            registerTheme: (theme) => {
                console.log("🎨 Plugin registered a theme:", theme);
                // Dispatch event or update Global Theme Registry
                window.dispatchEvent(new CustomEvent('corex:register-theme', { detail: theme }));
            },
            registerCommand: (id, _callback) => {
                console.log("⌨️ Plugin registered a command:", id);
                // Store in command registry
            },
            showToast: (message, type) => {
                // Use existing toast system
                window.dispatchEvent(new CustomEvent('corex:show-toast', { detail: { message, type } }));
            },
            addSideBarItem: (item) => {
                console.log("📁 Plugin added sidebar item:", item);
            }
        };
    }

    /**
     * Scans the plugins directory and loads them
     */
    async loadPlugins() {
        try {
            // For Beta, we expect a "plugins" folder in the app data/home directory
            // We'll call a Tauri command to list directories
            const pluginPaths: string[] = await invoke("list_plugins");

            for (const path of pluginPaths) {
                await this.loadPlugin(path);
            }
        } catch (error) {
            console.error("❌ Failed to load plugins:", error);
        }
    }

    private async loadPlugin(path: string) {
        try {
            // Read manifest.json
            const manifestStr: string = await invoke("read_file", { path: `${path}/plugin.json` });
            const manifest: PluginManifest = JSON.parse(manifestStr);

            const plugin: CorexPlugin = {
                manifest,
                path,
                active: false
            };

            this.plugins.set(manifest.id, plugin);

            // Automatic activation for now
            await this.activatePlugin(manifest.id);
        } catch (error) {
            console.error(`❌ Failed to load plugin at ${path}:`, error);
        }
    }

    async activatePlugin(id: string) {
        const plugin = this.plugins.get(id);
        if (!plugin || plugin.active) return;

        try {
            // Read entry script
            const scriptBody: string = await invoke("read_file", { path: `${plugin.path}/${plugin.manifest.entry}` });

            // Create a sandbox-like environment (Beta: simple closure)
            // In production, use Web Workers or iframe sandbox
            const pluginModule = { exports: {} };
            const activate = new Function('corex', 'module', 'exports', scriptBody);

            activate(this.api, pluginModule, pluginModule.exports);

            plugin.active = true;
            console.log(`✅ Plugin Activated: ${plugin.manifest.name} (${id})`);
        } catch (error) {
            console.error(`❌ Failed to activate plugin ${id}:`, error);
        }
    }

    getPlugins() {
        return Array.from(this.plugins.values());
    }
}

export const pluginService = new PluginService();
