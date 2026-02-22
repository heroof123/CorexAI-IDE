// src/types/plugin.ts

export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    entry: string; // main.js
    icon?: string;
    permissions: string[];
}

export interface CorexPlugin {
    manifest: PluginManifest;
    path: string;
    active: boolean;
    instance?: any;
}

export interface PluginAPI {
    version: string;
    registerTheme: (theme: any) => void;
    registerCommand: (id: string, callback: () => void) => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
    // UI hooks
    addSideBarItem: (item: any) => void;
}
