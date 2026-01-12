import { Chunk } from '../chunkers';

export interface QueryFilter {
    package?: string;
    className?: string;
    chunkType?: string;
    language?: string;
    relativePath?: string;
}

export interface QueryResult {
    chunk: Chunk;
    score: number;
    distance: number;
}

export interface IVectorStore {
    /**
     * Connect to the vector database
     */
    connect(): Promise<void>;

    /**
     * Insert or update chunks in the vector store
     * @param chunks - Array of chunks to upsert
     * @param embeddings - Corresponding embeddings for each chunk
     */
    upsert(chunks: Chunk[], embeddings: number[][]): Promise<void>;

    /**
     * Query the vector store for similar chunks
     * @param embedding - Query embedding vector
     * @param topK - Number of results to return
     * @param filters - Optional metadata filters
     */
    query(
        embedding: number[],
        topK: number,
        filters?: QueryFilter
    ): Promise<QueryResult[]>;

    /**
     * Check if the vector store is healthy and accessible
     */
    healthCheck(): Promise<boolean>;

    /**
     * Get the collection/index name
     */
    getCollectionName(): string;
}
