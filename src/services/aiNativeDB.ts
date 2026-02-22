// src/services/aiNativeDB.ts
// IndexedDB schema extensions for AI-Native IDE features

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type {
  FileAnalysis as AINativeFileAnalysis,
  SymbolIndex,
  DependencyGraph as AINativeDependencyGraph,
  CodeInsight,
  FileHistory,
  SymbolHistory,
} from '../types/ai-native';

// Re-export for convenience, but use semanticBrain's FileAnalysis for actual operations
import type { FileAnalysis } from './semanticBrain';

// Convert semanticBrain FileAnalysis to AI-Native FileAnalysis
function convertToAINative(analysis: FileAnalysis): AINativeFileAnalysis {
  return {
    file_path: analysis.filePath,
    symbols: analysis.symbols.map(s => ({
      name: s.name,
      kind: s.kind,
      line: s.line,
      column: s.column,
      signature: s.signature,
      documentation: s.documentation,
      is_exported: s.isExported,
    })),
    imports: analysis.imports.map(i => i.moduleName),
    importsDetail: analysis.imports.map(i => ({
      moduleName: i.moduleName,
      importedSymbols: i.importedSymbols || [],
      isDefault: i.isDefault || false,
      line: i.line || 0,
    })),
    exports: analysis.exports.map(e => e.symbolName),
    linesOfCode: analysis.linesOfCode || 0,
    complexity: analysis.complexity,
    dependencies: analysis.dependencies,
    dependents: analysis.dependents,
  };
}

// Convert AI-Native FileAnalysis to semanticBrain FileAnalysis
function convertFromAINative(analysis: AINativeFileAnalysis): FileAnalysis {
  return {
    filePath: analysis.file_path,
    symbols: analysis.symbols.map(s => ({
      name: s.name,
      kind: s.kind as any,
      filePath: analysis.file_path,
      line: s.line,
      column: s.column,
      signature: s.signature,
      documentation: s.documentation,
      isExported: s.is_exported,
      dependencies: [],
    })),
    imports: analysis.importsDetail
      ? analysis.importsDetail.map(i => ({
        moduleName: i.moduleName,
        importedSymbols: i.importedSymbols,
        isDefault: i.isDefault,
        line: i.line,
      }))
      : analysis.imports.map((moduleName, index) => ({
        moduleName,
        importedSymbols: [],
        isDefault: false,
        line: index,
      })),
    exports: analysis.exports.map((symbolName, index) => ({
      symbolName,
      isDefault: false,
      line: index,
    })),
    complexity: analysis.complexity,
    dependencies: analysis.dependencies,
    dependents: analysis.dependents,
    linesOfCode: analysis.linesOfCode || 0,
  };
}

interface AINativeDB extends DBSchema {
  // File analysis cache (AST, symbols, complexity)
  file_analysis: {
    key: string; // file_path
    value: {
      file_path: string;
      analysis: AINativeFileAnalysis;
      content_hash: string;
      timestamp: number;
    };
    indexes: { 'by-timestamp': number };
  };

  // Symbol index (definitions, references, exports)
  symbol_index: {
    key: string; // project_path
    value: {
      project_path: string;
      index: SymbolIndex;
      timestamp: number;
    };
  };

  // Dependency graph
  dependency_graph: {
    key: string; // project_path
    value: {
      project_path: string;
      graph: AINativeDependencyGraph;
      timestamp: number;
    };
  };

  // Code insights (background analysis results)
  code_insights: {
    key: string; // insight_id
    value: CodeInsight;
    indexes: {
      'by-file': string;
      'by-timestamp': number;
      'by-type': string;
    };
  };

  // Git history cache
  file_history: {
    key: string; // file_path
    value: FileHistory;
    indexes: { 'by-hotspot': number };
  };

  // Symbol history
  symbol_history: {
    key: string; // symbol_name
    value: SymbolHistory;
    indexes: { 'by-modified': number };
  };

  // Dismissed insights (user preferences)
  dismissed_insights: {
    key: string; // insight_id
    value: {
      insight_id: string;
      dismissed_at: number;
    };
  };
}

let aiDB: IDBPDatabase<AINativeDB> | null = null;

export async function initAINativeDB(): Promise<IDBPDatabase<AINativeDB>> {
  if (aiDB) return aiDB;

  aiDB = await openDB<AINativeDB>('ai-native-ide-db', 1, {
    upgrade(db) {
      // File analysis store
      if (!db.objectStoreNames.contains('file_analysis')) {
        const store = db.createObjectStore('file_analysis', { keyPath: 'file_path' });
        store.createIndex('by-timestamp', 'timestamp');
      }

      // Symbol index store
      if (!db.objectStoreNames.contains('symbol_index')) {
        db.createObjectStore('symbol_index', { keyPath: 'project_path' });
      }

      // Dependency graph store
      if (!db.objectStoreNames.contains('dependency_graph')) {
        db.createObjectStore('dependency_graph', { keyPath: 'project_path' });
      }

      // Code insights store
      if (!db.objectStoreNames.contains('code_insights')) {
        const store = db.createObjectStore('code_insights', { keyPath: 'id' });
        store.createIndex('by-file', 'file_path');
        store.createIndex('by-timestamp', 'timestamp');
        store.createIndex('by-type', 'type');
      }

      // File history store
      if (!db.objectStoreNames.contains('file_history')) {
        const store = db.createObjectStore('file_history', { keyPath: 'file_path' });
        store.createIndex('by-hotspot', 'hotspot_score');
      }

      // Symbol history store
      if (!db.objectStoreNames.contains('symbol_history')) {
        const store = db.createObjectStore('symbol_history', { keyPath: 'symbol' });
        store.createIndex('by-modified', 'last_modified');
      }

      // Dismissed insights store
      if (!db.objectStoreNames.contains('dismissed_insights')) {
        db.createObjectStore('dismissed_insights', { keyPath: 'insight_id' });
      }
    },
  });

  console.log('🧠 AI-Native IndexedDB initialized');
  return aiDB;
}

// ============================================================================
// File Analysis Operations
// ============================================================================

export async function saveFileAnalysis(
  filePath: string,
  analysis: FileAnalysis,
  contentHash: string
): Promise<void> {
  const db = await initAINativeDB();
  await db.put('file_analysis', {
    file_path: filePath,
    analysis: convertToAINative(analysis),
    content_hash: contentHash,
    timestamp: Date.now(),
  });
}

export async function getFileAnalysis(filePath: string): Promise<FileAnalysis | null> {
  const db = await initAINativeDB();
  const result = await db.get('file_analysis', filePath);
  return result ? convertFromAINative(result.analysis) : null;
}

export async function getFileAnalysisWithHash(
  filePath: string
): Promise<{ analysis: FileAnalysis; contentHash: string } | null> {
  const db = await initAINativeDB();
  const result = await db.get('file_analysis', filePath);
  if (!result) return null;
  return {
    analysis: convertFromAINative(result.analysis),
    contentHash: result.content_hash,
  };
}

export async function deleteFileAnalysis(filePath: string): Promise<void> {
  const db = await initAINativeDB();
  await db.delete('file_analysis', filePath);
}

// ============================================================================
// Symbol Index Operations
// ============================================================================

export async function saveSymbolIndex(
  projectPath: string,
  index: SymbolIndex
): Promise<void> {
  const db = await initAINativeDB();
  await db.put('symbol_index', {
    project_path: projectPath,
    index,
    timestamp: Date.now(),
  });
}

export async function getSymbolIndex(projectPath: string): Promise<SymbolIndex | null> {
  const db = await initAINativeDB();
  const result = await db.get('symbol_index', projectPath);
  return result?.index || null;
}

// ============================================================================
// Dependency Graph Operations
// ============================================================================

export async function saveDependencyGraph(
  projectPath: string,
  graph: AINativeDependencyGraph
): Promise<void> {
  const db = await initAINativeDB();
  await db.put('dependency_graph', {
    project_path: projectPath,
    graph,
    timestamp: Date.now(),
  });
}

export async function getDependencyGraph(
  projectPath: string
): Promise<AINativeDependencyGraph | null> {
  const db = await initAINativeDB();
  const result = await db.get('dependency_graph', projectPath);
  return result?.graph || null;
}

// ============================================================================
// Code Insights Operations
// ============================================================================

export async function saveCodeInsight(insight: CodeInsight): Promise<void> {
  const db = await initAINativeDB();
  await db.put('code_insights', insight);
}

export async function saveCodeInsights(_filePath: string, insights: CodeInsight[]): Promise<void> {
  const db = await initAINativeDB();
  const tx = db.transaction('code_insights', 'readwrite');

  for (const insight of insights) {
    await tx.store.put(insight);
  }

  await tx.done;

  // FIX-35: Auto-expiry old insights (3 days)
  try {
    await clearOldInsights(3 * 24 * 60 * 60 * 1000);
  } catch (err) {
    console.warn("⚠️ Failed to prune old insights:", err);
  }
}

export async function getCodeInsights(filePath: string): Promise<CodeInsight[]> {
  const db = await initAINativeDB();
  const index = db.transaction('code_insights').store.index('by-file');
  return await index.getAll(filePath);
}

export async function getAllCodeInsights(): Promise<CodeInsight[]> {
  const db = await initAINativeDB();
  return await db.getAll('code_insights');
}

export async function deleteCodeInsight(insightId: string): Promise<void> {
  const db = await initAINativeDB();
  await db.delete('code_insights', insightId);
}

// Multi-delete support (FIX-23)
export async function deleteCodeInsights(insightIds: string[]): Promise<void> {
  const db = await initAINativeDB();
  const tx = db.transaction('code_insights', 'readwrite');
  await Promise.all(insightIds.map(id => tx.store.delete(id)));
  await tx.done;
}

export async function clearOldInsights(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const db = await initAINativeDB();
  const cutoff = Date.now() - maxAge;
  const tx = db.transaction('code_insights', 'readwrite');
  const index = tx.store.index('by-timestamp');

  let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}

// ============================================================================
// Git History Operations
// ============================================================================

export async function saveFileHistory(history: FileHistory): Promise<void> {
  const db = await initAINativeDB();
  await db.put('file_history', history);
}

export async function getFileHistory(filePath: string): Promise<FileHistory | null> {
  const db = await initAINativeDB();
  const result = await db.get('file_history', filePath);
  return result || null;
}

export async function getHotspots(limit: number = 10): Promise<FileHistory[]> {
  const db = await initAINativeDB();
  const index = db.transaction('file_history').store.index('by-hotspot');
  const results = await index.getAll();
  return results.sort((a, b) => b.hotspot_score - a.hotspot_score).slice(0, limit);
}

// ============================================================================
// Symbol History Operations
// ============================================================================

export async function saveSymbolHistory(history: SymbolHistory): Promise<void> {
  const db = await initAINativeDB();
  await db.put('symbol_history', history);
}

export async function getSymbolHistory(symbol: string): Promise<SymbolHistory | null> {
  const db = await initAINativeDB();
  const result = await db.get('symbol_history', symbol);
  return result || null;
}

// ============================================================================
// Dismissed Insights Operations
// ============================================================================

export async function dismissInsight(insightId: string): Promise<void> {
  const db = await initAINativeDB();
  await db.put('dismissed_insights', {
    insight_id: insightId,
    dismissed_at: Date.now(),
  });
}

export async function isInsightDismissed(insightId: string): Promise<boolean> {
  const db = await initAINativeDB();
  const result = await db.get('dismissed_insights', insightId);
  return !!result;
}

// ============================================================================
// Utility Operations
// ============================================================================

export async function clearAllAINativeData(): Promise<void> {
  const db = await initAINativeDB();
  await db.clear('file_analysis');
  await db.clear('symbol_index');
  await db.clear('dependency_graph');
  await db.clear('code_insights');
  await db.clear('file_history');
  await db.clear('symbol_history');
  await db.clear('dismissed_insights');
  console.log('🗑️ All AI-Native data cleared');
}

export async function getAINativeStorageSize(): Promise<Record<string, number>> {
  const db = await initAINativeDB();
  const stores = ['file_analysis', 'symbol_index', 'dependency_graph', 'code_insights', 'file_history', 'symbol_history', 'dismissed_insights'];
  const result: Record<string, number> = {};

  for (const store of stores) {
    result[store] = await db.count(store as any);
  }

  return result;
}
