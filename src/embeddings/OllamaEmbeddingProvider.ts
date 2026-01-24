import { IEmbeddingProvider } from './IEmbeddingProvider';
import { loadConfig } from '../config';

/**
 * Ollama local embedding provider using mxbai-embed-large or similar models.
 * Dramatically faster than API-based providers (50-100x).
 */
export class OllamaEmbeddingProvider implements IEmbeddingProvider {
    private config = loadConfig();
    private host: string;
    private model: string;
    private dimension: number;

    constructor() {
        this.host = process.env.OLLAMA_HOST || 'http://localhost:11434';
        this.model = this.config.embeddingModel || 'mxbai-embed-large';

        // Dimension depends on model
        // mxbai-embed-large: 1024
        // nomic-embed-text: 768
        // all-minilm: 384
        this.dimension = this.getModelDimension(this.model);
    }

    async embed(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) {
            return [];
        }

        const embeddings: number[][] = [];
        const batchSize = this.config.embeddingBatchSize || 100;

        // Process in batches - Ollama handles one text at a time via API
        // but we can parallelize requests
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);

            // Parallel embedding within batch
            const batchEmbeddings = await Promise.all(
                batch.map(text => this.embedSingle(text))
            );

            embeddings.push(...batchEmbeddings);
        }

        return embeddings;
    }

    /**
     * Embed a single text using Ollama API
     */
    private async embedSingle(text: string): Promise<number[]> {
        const response = await fetch(`${this.host}/api/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.model,
                prompt: text,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama embedding failed: ${response.status} - ${error}`);
        }

        const data = await response.json() as { embedding: number[] };
        return data.embedding;
    }

    /**
     * Get dimension for known models
     */
    private getModelDimension(model: string): number {
        const dimensions: Record<string, number> = {
            'mxbai-embed-large': 1024,
            'nomic-embed-text': 768,
            'all-minilm': 384,
            'snowflake-arctic-embed': 1024,
        };
        return dimensions[model] || 1024; // Default to 1024
    }

    getDimension(): number {
        return this.dimension;
    }

    getProviderName(): string {
        return 'ollama';
    }

    getModelName(): string {
        return this.model;
    }
}
