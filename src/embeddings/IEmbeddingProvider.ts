export interface IEmbeddingProvider {
    /**
     * Generate embeddings for a batch of texts
     * @param texts - Array of text strings to embed
     * @returns Array of embedding vectors
     */
    embed(texts: string[]): Promise<number[][]>;

    /**
     * Get the embedding dimension size
     */
    getDimension(): number;

    /**
     * Get the provider name
     */
    getProviderName(): string;

    /**
     * Get the model name
     */
    getModelName(): string;
}
