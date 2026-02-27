// src/hooks/usePlugins.ts
import { useState, useEffect, useCallback } from "react";
import { pluginService } from "../services/pluginService";
import { CorexPlugin } from "../types/plugin";

export interface MarketplacePlugin {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    icon: string;
    category: "Theme" | "AI Tool" | "Utility";
    installed: boolean;
    active: boolean;
}

export function usePlugins() {
    const [installedPlugins, setInstalledPlugins] = useState<CorexPlugin[]>([]);
    const [loading, setLoading] = useState(true);
    const [marketplacePlugins, setMarketplacePlugins] = useState<MarketplacePlugin[]>([]);

    const refreshPlugins = useCallback(async () => {
        setLoading(true);
        await pluginService.loadPlugins();
        const plugins = pluginService.getPlugins();
        setInstalledPlugins(plugins);

        // Mock Marketplace Data
        const mockMarketplace: MarketplacePlugin[] = [
            {
                id: "cyber-neon",
                name: "Cyber Neon Theme",
                version: "1.0.0",
                description: "Futuristic neon theme for high-performance coding.",
                author: "Corex Team",
                icon: "🎨",
                category: "Theme",
                installed: plugins.some(p => p.manifest.id === "cyber-neon"),
                active: plugins.find(p => p.manifest.id === "cyber-neon")?.active || false
            },
            {
                id: "sql-assistant",
                name: "SQL Genius",
                version: "0.5.0",
                description: "AI-powered SQL query optimization and visualization.",
                author: "DataWiz",
                icon: "📊",
                category: "AI Tool",
                installed: false,
                active: false
            },
            {
                id: "git-visualizer",
                name: "Git Flow",
                version: "1.2.3",
                description: "Beautiful visual representation of your git history.",
                author: "GitMaster",
                icon: "🌿",
                category: "Utility",
                installed: false,
                active: false
            }
        ];
        setMarketplacePlugins(mockMarketplace);
        setLoading(false);
    }, []);

    useEffect(() => {
        refreshPlugins();
    }, [refreshPlugins]);

    const togglePlugin = async (id: string, active: boolean) => {
        if (active) {
            await pluginService.activatePlugin(id);
        } else {
            // Placeholder for deactivation logic
            console.log(`Deactivating plugin ${id} (Mock)`);
        }
        await refreshPlugins();
    };

    return {
        installedPlugins,
        marketplacePlugins,
        loading,
        refreshPlugins,
        togglePlugin
    };
}
