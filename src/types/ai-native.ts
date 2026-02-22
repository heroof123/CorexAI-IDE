// src/types/ai-native.ts
// Type definitions for AI-Native IDE features

// ============================================================================
// Vector Database Types
// ============================================================================

export interface CodeChunk {
  id: string;
  file_path: string;
  content: string;
  embedding: number[];
  symbol_name?: string;
  chunk_type: string;
  timestamp: number;
}

// ============================================================================
// RAG Pipeline Types
// ============================================================================

export type QueryIntent =
  | { type: 'Refactor'; symbol: string }
  | { type: 'Explain'; symbol: string }
  | { type: 'Debug'; file: string }
  | { type: 'Test'; symbol: string }
  | { type: 'General' };

export interface ContextSource {
  source_type: 'vector_db' | 'symbol_resolver' | 'git' | 'dependency_graph';
  file_path: string;
  relevance_score: number;
  reason: string;
}

export interface RAGContext {
  context: string;
  sources: ContextSource[];
  intent: QueryIntent;
  token_count: number;
}

// ============================================================================
// Tree-sitter Parser Types
// ============================================================================

export interface Symbol {
  name: string;
  kind: string;
  line: number;
  column: number;
  signature?: string;
  documentation?: string;
  is_exported: boolean;
}

export interface FileAnalysis {
  file_path: string;
  symbols: Symbol[];
  imports: string[];
  importsDetail?: Array<{
    moduleName: string;
    importedSymbols: string[];
    isDefault: boolean;
    line: number;
  }>;
  exports: string[];
  linesOfCode: number;
  complexity: number;
  dependencies: string[];
  dependents: string[];
}

// ============================================================================
// Semantic Brain Types (Enhanced)
// ============================================================================

export interface LanguageParser {
  language: string;
  extensions: string[];
  parse(content: string, filePath: string): FileAnalysis;
}

export interface ParserRegistry {
  registerParser(parser: LanguageParser): void;
  getParser(fileExtension: string): LanguageParser | null;
  parseFile(filePath: string, content: string): FileAnalysis;
}

// ============================================================================
// Symbol Resolution Types
// ============================================================================

export interface SymbolDefinition {
  symbol: string;
  file_path: string;
  line: number;
  column: number;
  kind: string;
  signature?: string;
  documentation?: string;
}

export interface SymbolReference {
  symbol: string;
  file_path: string;
  line: number;
  column: number;
  context: string;
}

export interface SymbolIndex {
  definitions: Map<string, SymbolDefinition[]>;
  references: Map<string, SymbolReference[]>;
  exports: Map<string, SymbolDefinition[]>;
  imports: Map<string, string[]>;
}

// ============================================================================
// Dependency Graph Types
// ============================================================================

export interface DependencyNode {
  file_path: string;
  symbols: string[];
  imports: string[];
  exports: string[];
  last_modified: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  symbols: string[];
  edge_type: 'import' | 'reference';
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, DependencyEdge[]>;
  impact_scores: Map<string, number>;
}

// ============================================================================
// Background Reasoning Types
// ============================================================================

export type InsightType =
  | 'complexity_warning'
  | 'bug_detection'
  | 'refactoring_suggestion'
  | 'performance_issue'
  | 'security_concern';

export interface CodeInsight {
  id: string;
  file_path: string;
  line: number;
  column: number;
  type: InsightType;
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
  timestamp: number;
  category?: string; // For backward compatibility with backgroundReasoner
}

export interface AnalysisTask {
  id: string;
  file_path: string;
  priority: 'high' | 'medium' | 'low';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  created_at: number;
}

// ============================================================================
// Git Intelligence Types
// ============================================================================

export interface GitCommit {
  hash: string;
  author: string;
  date: number;
  message: string;
  files_changed: string[];
}

export interface FileHistory {
  file_path: string;
  commits: GitCommit[];
  hotspot_score: number;
}

export interface SymbolHistory {
  symbol: string;
  created_in: string;
  modified_in: string[];
  last_modified: number;
}

// ============================================================================
// Editor Overlay Types
// ============================================================================

export interface EditorDecoration {
  line: number;
  column: number;
  type: InsightType;
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
}

export interface HoverInfo {
  symbol: string;
  definition?: SymbolDefinition;
  references_count: number;
  documentation?: string;
  type_info?: string;
}

// ============================================================================
// Context Quality Types
// ============================================================================

export interface ContextQualityMetrics {
  quality_score: number;
  file_count: number;
  symbol_count: number;
  dependency_depth: number;
  semantic_coverage: number;
  suggestions: string[];
}

// ============================================================================
// Smart Chunking Types
// ============================================================================

export interface ChunkingStrategy {
  max_tokens: number;
  preserve_symbols: boolean;
  include_documentation: boolean;
  prioritize_by_usage: boolean;
}

export interface ChunkedContent {
  chunks: string[];
  metadata: {
    total_tokens: number;
    truncated: boolean;
    symbols_included: string[];
  };
}
