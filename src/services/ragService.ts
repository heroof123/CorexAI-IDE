import { invoke } from "@tauri-apps/api/core";


export interface CodeChunk {
    id: string;
    file_path: string;
    content: string;
    embedding: number[];
    symbol_name?: string;
    chunk_type: string;
    timestamp: number;
}

export interface RAGService {
    init: (dbPath: string) => Promise<void>;
    indexFile: (filePath: string) => Promise<void>;
    indexCommit: (commit: any) => Promise<void>;
    search: (query: string, topK?: number) => Promise<CodeChunk[]>;
    deleteIndex: (filePath: string) => Promise<void>;
}

export const ragService: RAGService = {
    /**
     * Initialize the vector database connection
     */
    init: async (dbPath: string): Promise<void> => {
        try {
            await invoke("init_vector_db", { dbPath });
            console.log("✅ Vector DB initialized at:", dbPath);
        } catch (error) {
            console.error("❌ Failed to init Vector DB:", error);
            throw error;
        }
    },

    /**
     * Index a file into the vector database
     * (Backend handles chunking and embedding generation locally)
     */
    indexFile: async (filePath: string): Promise<void> => {
        try {
            // Read content first or let backend handle it? 
            // In our new command vector_index_file, we pass content.
            const content = await invoke<string>("read_file_content", { path: filePath });
            await invoke("vector_index_file", {
                path: filePath,
                content,
                chunkType: 'Code'
            });
            console.log("✅ File indexed:", filePath);
        } catch (error) {
            console.error("❌ Failed to index file:", filePath, error);
            throw error;
        }
    },

    /**
     * Index a git commit into the vector database
     */
    indexCommit: async (commit: any): Promise<void> => {
        try {
            await invoke("vector_index_file", {
                path: commit.hash.substring(0, 7),
                content: `Commit: ${commit.message}\nAuthor: ${commit.author}\nDate: ${new Date(commit.timestamp).toLocaleDateString()}`,
                chunkType: 'Commit'
            });
            console.log("✅ Commit indexed:", commit.hash);
        } catch (error) {
            console.error("❌ Failed to index commit:", commit.hash, error);
        }
    },

    /**
     * Search for similar code chunks using the new native semantic search
     */
    search: async (query: string, topK: number = 5): Promise<CodeChunk[]> => {
        try {
            const response = await invoke<{ results: CodeChunk[] }>("semantic_search", { query, limit: topK });
            return response.results;
        } catch (error) {
            console.error("❌ Vector search failed:", error);
            return [];
        }
    },

    /**
     * Remove a file from the index
     */
    deleteIndex: async (filePath: string): Promise<void> => {
        try {
            await invoke("delete_file_index", { filePath });
            console.log("✅ File index deleted:", filePath);
        } catch (error) {
            console.error("❌ Failed to delete file index:", error);
            throw error;
        }
    }
};
