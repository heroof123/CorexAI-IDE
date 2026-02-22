// src/services/parserRegistry.ts
// Multi-Language Parser Registry with Tree-sitter backend integration

import { invoke } from '@tauri-apps/api/core';
import type { FileAnalysis } from '../types/ai-native';

// ============================================================================
// Language Parser Interface
// ============================================================================

export interface LanguageParser {
  language: string;
  extensions: string[];
  parse(filePath: string, content: string): Promise<FileAnalysis>;
}

// ============================================================================
// Parser Registry
// ============================================================================

export class ParserRegistry {
  private parsers: Map<string, LanguageParser> = new Map();
  private extensionMap: Map<string, LanguageParser> = new Map();

  constructor() {
    // Register default parsers
    this.registerParser(new TypeScriptParser());
    this.registerParser(new PythonParser());
    this.registerParser(new RustParser());
    this.registerParser(new GoParser());
  }

  /**
   * Register a language parser
   */
  registerParser(parser: LanguageParser): void {
    this.parsers.set(parser.language, parser);

    // Map extensions to parser
    for (const ext of parser.extensions) {
      this.extensionMap.set(ext, parser);
    }

    console.log(`✅ Registered parser: ${parser.language} (${parser.extensions.join(', ')})`);
  }

  /**
   * Get parser for file extension
   */
  getParser(fileExtension: string): LanguageParser | null {
    // Remove leading dot if present
    const ext = fileExtension.startsWith('.') ? fileExtension.slice(1) : fileExtension;
    return this.extensionMap.get(ext) || null;
  }

  /**
   * Parse file using appropriate parser
   */
  async parseFile(filePath: string, content: string): Promise<FileAnalysis> {
    // Extract extension
    const ext = filePath.split('.').pop() || '';
    const parser = this.getParser(ext);

    if (!parser) {
      console.warn(`⚠️ No parser found for extension: ${ext}, using fallback`);
      return this.fallbackParse(filePath);
    }

    try {
      return await parser.parse(filePath, content);
    } catch (error) {
      console.error(`❌ Parser error for ${filePath}:`, error);
      return this.fallbackParse(filePath);
    }
  }

  /**
   * Fallback parser for unsupported languages
   */
  private fallbackParse(filePath: string): FileAnalysis {
    return {
      file_path: filePath,
      symbols: [],
      imports: [],
      exports: [],
      linesOfCode: 0,
      complexity: 0,
      dependencies: [],
      dependents: [],
    };
  }

  /**
   * Get all supported extensions
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }

  /**
   * Get all registered languages
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.parsers.keys());
  }
}

// ============================================================================
// TypeScript/JavaScript Parser (Tree-sitter backend)
// ============================================================================

export class TypeScriptParser implements LanguageParser {
  language = 'typescript';
  extensions = ['ts', 'tsx', 'js', 'jsx'];

  async parse(filePath: string, content: string): Promise<FileAnalysis> {
    try {
      // Call Rust tree-sitter backend
      const analysis = await invoke<FileAnalysis>('parse_file_ast', {
        filePath,
        content,
      });

      return analysis;
    } catch (error) {
      console.error('❌ TypeScript parser error:', error);
      throw error;
    }
  }
}

// ============================================================================
// Python Parser (Tree-sitter backend)
// ============================================================================

export class PythonParser implements LanguageParser {
  language = 'python';
  extensions = ['py'];

  async parse(filePath: string, content: string): Promise<FileAnalysis> {
    try {
      // Call Rust tree-sitter backend
      const analysis = await invoke<FileAnalysis>('parse_file_ast', {
        filePath,
        content,
      });

      return analysis;
    } catch (error) {
      console.error('❌ Python parser error:', error);
      throw error;
    }
  }
}

// ============================================================================
// Rust Parser (Tree-sitter backend)
// ============================================================================

export class RustParser implements LanguageParser {
  language = 'rust';
  extensions = ['rs'];

  async parse(filePath: string, content: string): Promise<FileAnalysis> {
    try {
      // Call Rust tree-sitter backend
      const analysis = await invoke<FileAnalysis>('parse_file_ast', {
        filePath,
        content,
      });

      return analysis;
    } catch (error) {
      console.error('❌ Rust parser error:', error);
      throw error;
    }
  }
}

// ============================================================================
// Go Parser (Tree-sitter backend)
// ============================================================================

export class GoParser implements LanguageParser {
  language = 'go';
  extensions = ['go'];

  async parse(filePath: string, content: string): Promise<FileAnalysis> {
    try {
      // Call Rust tree-sitter backend
      const analysis = await invoke<FileAnalysis>('parse_file_ast', {
        filePath,
        content,
      });

      return analysis;
    } catch (error) {
      console.error('❌ Go parser error:', error);
      throw error;
    }
  }
}

// ============================================================================
// Global Parser Registry Instance
// ============================================================================

export const parserRegistry = new ParserRegistry();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse file with automatic parser selection
 */
export async function parseFileAuto(
  filePath: string,
  content: string
): Promise<FileAnalysis> {
  return await parserRegistry.parseFile(filePath, content);
}

/**
 * Check if file extension is supported
 */
export function isLanguageSupported(fileExtension: string): boolean {
  return parserRegistry.getParser(fileExtension) !== null;
}

/**
 * Get language name from file extension
 */
export function getLanguageFromExtension(fileExtension: string): string | null {
  const parser = parserRegistry.getParser(fileExtension);
  return parser?.language || null;
}
