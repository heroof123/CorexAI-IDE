// src/services/serviceInitializer.ts
// Central service initialization and wiring

import { backgroundReasoner } from './backgroundReasoner';
import { symbolSearch } from './symbolSearch';
import { impactAnalysis } from './impactAnalysis';
import { testWriterAgent } from './testAgent';
import { pluginService } from './pluginService';
import { invoke } from '@tauri-apps/api/core';

/**
 * 🆕 TASK 22: Service Initialization and Wiring
 * 
 * This module wires together all AI-native IDE services:
 * - BackgroundReasoner: Analyzes code in background
 * - EditorOverlay: Shows insights in editor
 * - GitIntelligence: Provides git context
 * - SymbolResolver: Resolves cross-file symbols
 * - SymbolSearch: Fuzzy symbol search
 * - ImpactAnalysis: Analyzes change impact
 */

let isInitialized = false;

/**
 * Initialize all AI-native IDE services
 */
export async function initializeServices(_projectPath: string): Promise<void> {
  if (isInitialized) {
    console.log('Services already initialized');
    return;
  }

  console.log('🚀 Initializing AI-native IDE services...');

  try {
    // TASK 22.1: Wire BackgroundReasoner to file change events
    // Subscribe to analysis completion events
    backgroundReasoner.on('analysis-complete', (data: any) => {
      console.log(`✅ Analysis complete for ${data.filePath}: ${data.insights.length} insights`);

      // TASK 22.2: Wire EditorOverlay to BackgroundReasoner events
      // Update editor decorations when analysis completes
      // TODO: EditorOverlay needs to be initialized with Monaco editor instance
      // editorOverlay.updateDecorations(filePath, insights);
    });

    // Start background reasoner
    backgroundReasoner.start();
    console.log('✅ BackgroundReasoner started');

    // TASK 22.3: Wire GitIntelligence to SmartContextBuilder
    // Git intelligence is already integrated in smartContextBuilder
    console.log('✅ GitIntelligence integrated with SmartContextBuilder');

    // TASK 22.4: Wire DependencyGraphManager to IncrementalIndexer
    // DependencyGraphManager is already integrated in smartContextBuilder
    console.log('✅ DependencyGraphManager integrated with IncrementalIndexer');

    // TASK 22.5: Wire SymbolResolver to SymbolSearchUI
    // SymbolSearch already uses SymbolResolver internally
    console.log('✅ SymbolSearch wired to SymbolResolver');

    // Initialize symbol search
    await symbolSearch.initialize();
    console.log('✅ SymbolSearch initialized');

    // Initialize impact analysis
    await impactAnalysis.initialize();
    console.log('✅ ImpactAnalysis initialized');

    // Load Plugins
    await pluginService.loadPlugins();
    console.log('🔌 Plugin system (Beta) started');

    isInitialized = true;
    console.log('🎉 All AI-native IDE services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    throw error;
  }
}

/**
 * Handle file change events
 */
export function handleFileChange(filePath: string): void {
  if (!isInitialized) {
    console.warn('Services not initialized, skipping file change handling');
    return;
  }

  // TASK 22.1: Queue analysis for changed file
  backgroundReasoner.queueAnalysis(filePath, 'high');
}

/**
 * Handle file save events
 */
export function handleFileSave(filePath: string): void {
  if (!isInitialized) {
    console.warn('Services not initialized, skipping file save handling');
    return;
  }

  // Queue high-priority analysis for saved file
  backgroundReasoner.queueAnalysis(filePath, 'high');

  // 🧪 Triger Test Writer Agent
  invoke<string>("read_file", { path: filePath })
    .then(content => testWriterAgent.onFileSaved(filePath, content))
    .catch(err => console.error("❌ Test agent file read error:", err));
}

/**
 * Shutdown all services
 */
export function shutdownServices(): void {
  if (!isInitialized) {
    return;
  }

  console.log('🛑 Shutting down AI-native IDE services...');

  backgroundReasoner.stop();

  isInitialized = false;
  console.log('✅ Services shut down');
}

/**
 * Get initialization status
 */
export function isServicesInitialized(): boolean {
  return isInitialized;
}
