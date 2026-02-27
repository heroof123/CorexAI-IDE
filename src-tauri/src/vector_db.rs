// src-tauri/src/vector_db.rs
// Vector Database Integration using LanceDB for semantic code search

use lancedb::{Connection, Table};
use lancedb::query::{QueryBase, ExecutableQuery};
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::sync::Arc;
use tokio::sync::Mutex;
use arrow_array::{RecordBatch, RecordBatchIterator, StringArray, Float32Array, UInt64Array, FixedSizeListArray, Array};
use arrow_schema::{Schema, Field, DataType};
use futures_util::StreamExt;
use std::sync::Arc as StdArc;
use fastembed::{TextEmbedding, InitOptions};

/// Represents a code chunk stored in the vector database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeChunk {
    /// Unique identifier: file_path:start_line:end_line
    pub id: String,
    /// Path to the source file
    pub file_path: String,
    /// Content of the code chunk
    pub content: String,
    /// Vector embedding (384 dimensions for BGE-small-en-v1.5)
    pub embedding: Vec<f32>,
    /// Optional symbol name (function, class, etc.)
    pub symbol_name: Option<String>,
    /// Type of chunk: Function, Class, Module, etc.
    pub chunk_type: String,
    /// Unix timestamp when the chunk was indexed
    pub timestamp: u64,
}

impl CodeChunk {
    /// Convert Vec<CodeChunk> to Arrow RecordBatch
    fn to_record_batch(chunks: Vec<CodeChunk>) -> Result<RecordBatch, Box<dyn Error>> {
        if chunks.is_empty() {
            return Err("Cannot create RecordBatch from empty chunks".into());
        }

        let embedding_dim = chunks[0].embedding.len();
        
        // Extract fields
        let ids: Vec<String> = chunks.iter().map(|c| c.id.clone()).collect();
        let file_paths: Vec<String> = chunks.iter().map(|c| c.file_path.clone()).collect();
        let contents: Vec<String> = chunks.iter().map(|c| c.content.clone()).collect();
        let symbol_names: Vec<Option<String>> = chunks.iter().map(|c| c.symbol_name.clone()).collect();
        let chunk_types: Vec<String> = chunks.iter().map(|c| c.chunk_type.clone()).collect();
        let timestamps: Vec<u64> = chunks.iter().map(|c| c.timestamp).collect();

        // Create Arrow arrays
        let id_array = StringArray::from(ids);
        let file_path_array = StringArray::from(file_paths);
        let content_array = StringArray::from(contents);
        let flat_embeddings: Vec<f32> = chunks.iter().flat_map(|c| c.embedding.clone()).collect();
        let value_array = Float32Array::from(flat_embeddings);
        
        // Wrap flat array into FixedSizeListArray
        let embedding_field = StdArc::new(Field::new("item", DataType::Float32, true));
        let embedding_array = FixedSizeListArray::try_new(
            embedding_field,
            embedding_dim as i32,
            StdArc::new(value_array),
            None,
        ).map_err(|e| format!("Failed to create FixedSizeListArray: {}", e))?;

        let symbol_name_array = StringArray::from(
            symbol_names.iter().map(|s| s.as_deref()).collect::<Vec<_>>()
        );
        let chunk_type_array = StringArray::from(chunk_types);
        let timestamp_array = UInt64Array::from(timestamps);

        // Define schema
        let schema = StdArc::new(Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("file_path", DataType::Utf8, false),
            Field::new("content", DataType::Utf8, false),
            Field::new("embedding", DataType::FixedSizeList(
                StdArc::new(Field::new("item", DataType::Float32, true)),
                embedding_dim as i32
            ), false),
            Field::new("symbol_name", DataType::Utf8, true),
            Field::new("chunk_type", DataType::Utf8, false),
            Field::new("timestamp", DataType::UInt64, false),
        ]));

        // Create RecordBatch
        let batch = RecordBatch::try_new(
            schema,
            vec![
                StdArc::new(id_array),
                StdArc::new(file_path_array),
                StdArc::new(content_array),
                StdArc::new(embedding_array),
                StdArc::new(symbol_name_array),
                StdArc::new(chunk_type_array),
                StdArc::new(timestamp_array),
            ],
        )?;

        Ok(batch)
    }
}

/// Vector database interface for semantic code search
pub struct VectorDB {
    connection: Arc<Mutex<Connection>>,
    table_name: String,
    embedding_model: Arc<Mutex<TextEmbedding>>,
}

impl VectorDB {
    /// Initialize the vector database in embedded mode
    pub async fn init(db_path: &str) -> Result<Self, Box<dyn Error>> {
        let connection = lancedb::connect(db_path).execute().await?;
        
        let table_name = "code_chunks".to_string();
        
        // Initialize the embedding model (BGE-Small-EN-v1.5 is small and fast for offline usage)
        let model = TextEmbedding::try_new(InitOptions::default())
            .map_err(|e| format!("Failed to load embedding model: {}", e))?;
        
        Ok(Self {
            connection: Arc::new(Mutex::new(connection)),
            table_name,
            embedding_model: Arc::new(Mutex::new(model)),
        })
    }
    
    /// Get or create the code_chunks table
    async fn get_table(&self) -> Result<Table, Box<dyn Error>> {
        let conn = self.connection.lock().await;
        
        match conn.open_table(&self.table_name).execute().await {
            Ok(table) => Ok(table),
            Err(_) => {
                Err("Table does not exist. Use upsert to create it.".into())
            }
        }
    }
    
    /// Generate embedding for a given text
    pub async fn generate_embedding(&self, text: &str) -> Result<Vec<f32>, Box<dyn Error>> {
        let mut model = self.embedding_model.lock().await;
        let embeddings: Vec<Vec<f32>> = model.embed(vec![text], None)
            .map_err(|e| format!("Embedding generation error: {}", e))?;
        
        if let Some(first) = embeddings.into_iter().next() {
            Ok(first)
        } else {
            Err("No embeddings returned".into())
        }
    }

    /// Generate embeddings for multiple texts
    pub async fn generate_embeddings(&self, texts: Vec<&str>) -> Result<Vec<Vec<f32>>, Box<dyn Error>> {
        let mut model = self.embedding_model.lock().await;
        let embeddings: Vec<Vec<f32>> = model.embed(texts, None)
            .map_err(|e| format!("Embedding generation error: {}", e))?;
        Ok(embeddings)
    }

    /// Insert or update code chunks in the vector database
    /// NOTE: embeddings should be generated prior to this step or within it
    pub async fn upsert(&self, chunks: Vec<CodeChunk>) -> Result<(), Box<dyn Error>> {
        // Filter out empty or too small chunks (FIX-41)
        let mut valid_chunks: Vec<CodeChunk> = chunks.into_iter()
            .filter(|c| c.content.trim().len() > 10)
            .collect();

        if valid_chunks.is_empty() {
            return Ok(());
        }
        
        // Make sure all valid chunks have embeddings
        let mut texts_to_embed = Vec::new();
        let mut chunk_indices_to_embed = Vec::new();
        
        for (idx, chunk) in valid_chunks.iter().enumerate() {
            if chunk.embedding.is_empty() {
                texts_to_embed.push(chunk.content.as_str());
                chunk_indices_to_embed.push(idx);
            }
        }
        
        if !texts_to_embed.is_empty() {
            let generated_embeddings = self.generate_embeddings(texts_to_embed).await?;
            for (i, embedding) in generated_embeddings.into_iter().enumerate() {
                valid_chunks[chunk_indices_to_embed[i]].embedding = embedding;
            }
        }

        let conn = self.connection.lock().await;

        // Split into batches of 1000 to prevent memory issues and improve write performance (FIX-26)
        for chunk_slice in valid_chunks.chunks(1000) {
            let batch_data = chunk_slice.to_vec();
            let batch = CodeChunk::to_record_batch(batch_data)?;
            let schema = batch.schema();
            let reader = RecordBatchIterator::new(vec![Ok(batch)].into_iter(), schema);
            
            match conn.open_table(&self.table_name).execute().await {
                Ok(table) => {
                    table.add(Box::new(reader)).execute().await?;
                }
                Err(_) => {
                    conn.create_table(&self.table_name, Box::new(reader))
                        .execute()
                        .await?;
                }
            }
        }
        
        Ok(())
    }
    
    /// Query the vector database for similar code chunks
    pub async fn query(
        &self,
        query_embedding: Vec<f32>,
        top_k: usize,
    ) -> Result<Vec<CodeChunk>, Box<dyn Error>> {
        let table = self.get_table().await?;
        
        // Perform vector similarity search
        let query = table.vector_search(query_embedding)?;
        let mut stream = query.limit(top_k).execute().await?;
        let mut chunks = Vec::new();
        
        while let Some(batch_result) = stream.next().await {
            let batch = batch_result?;
            
            let ids = batch.column_by_name("id").and_then(|c| c.as_any().downcast_ref::<StringArray>()).ok_or_else(|| "ID column not found".to_string())?;
            let file_paths = batch.column_by_name("file_path").and_then(|c| c.as_any().downcast_ref::<StringArray>()).ok_or_else(|| "File path column not found".to_string())?;
            let contents = batch.column_by_name("content").and_then(|c| c.as_any().downcast_ref::<StringArray>()).ok_or_else(|| "Content column not found".to_string())?;
            let embeddings = batch.column_by_name("embedding").and_then(|c| c.as_any().downcast_ref::<FixedSizeListArray>()).ok_or_else(|| "Embedding column not found".to_string())?;
            let symbol_names = batch.column_by_name("symbol_name").and_then(|c| c.as_any().downcast_ref::<StringArray>()).ok_or_else(|| "Symbol name column not found".to_string())?;
            let chunk_types = batch.column_by_name("chunk_type").and_then(|c| c.as_any().downcast_ref::<StringArray>()).ok_or_else(|| "Chunk type column not found".to_string())?;
            let timestamps = batch.column_by_name("timestamp").and_then(|c| c.as_any().downcast_ref::<UInt64Array>()).ok_or_else(|| "Timestamp column not found".to_string())?;
            
            // Extract _distance column (added by LanceDB during vector search)
            let distances = batch.column_by_name("_distance")
                .and_then(|c| c.as_any().downcast_ref::<Float32Array>());

            for i in 0..batch.num_rows() {
                // Filter by distance (threshold = 0.7) (FIX-30)
                if let Some(dist_array) = distances {
                    if dist_array.value(i) > 0.7 { continue; }
                }

                let embedding_list = embeddings.value(i);
                let embedding_data = embedding_list.as_any().downcast_ref::<Float32Array>().ok_or_else(|| "Embedding values not found".to_string())?;
                let embedding_vec: Vec<f32> = (0..embedding_data.len()).map(|j| embedding_data.value(j)).collect();
                
                chunks.push(CodeChunk {
                    id: ids.value(i).to_string(),
                    file_path: file_paths.value(i).to_string(),
                    content: contents.value(i).to_string(),
                    embedding: embedding_vec,
                    symbol_name: if symbol_names.is_null(i) { None } else { Some(symbol_names.value(i).to_string()) },
                    chunk_type: chunk_types.value(i).to_string(),
                    timestamp: timestamps.value(i),
                });
            }
        }
        
        Ok(chunks)
    }
    
    /// Delete all chunks associated with a file
    pub async fn delete_file(&self, file_path: &str) -> Result<(), Box<dyn Error>> {
        let table = self.get_table().await?;
        
        // SQL string escape: double quotes for single quotes
        let safe_path = file_path.replace('\'', "''");
        
        // Block dangerous chars
        if file_path.contains(';') || file_path.contains("--") {
            return Err(format!("Geçersiz dosya yolu: {}", file_path).into());
        }
        
        table
            .delete(&format!("file_path = '{}'", safe_path))
            .await?;
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};
    
    fn create_test_chunk(id: &str, content: &str) -> CodeChunk {
        CodeChunk {
            id: id.to_string(),
            file_path: "test.rs".to_string(),
            content: content.to_string(),
            embedding: vec![0.1; 384],
            symbol_name: Some("test_function".to_string()),
            chunk_type: "Function".to_string(),
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }
    
    #[tokio::test]
    async fn test_vector_db_init() {
        let temp_dir = std::env::temp_dir().join("test_lancedb");
        let db = VectorDB::init(temp_dir.to_str().unwrap()).await;
        assert!(db.is_ok());
    }
}
