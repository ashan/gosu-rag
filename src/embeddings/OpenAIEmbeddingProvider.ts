import OpenAI from 'openai';
import { IEmbeddingProvider } from './IEmbeddingProvider';
import { loadConfig } from '../config';

export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
    private client: OpenAI;
    private config = loadConfig();
    private dimension: number;

    constructor() {
        if (!this.config.openaiApiKey) {
            throw new Error('OPENAI_API_KEY is required for OpenAI embedding provider');
        }

        this.client = new OpenAI({
            apiKey: this.config.openaiApiKey,
        });

        // Dimension depends on model
        // text-embedding-3-small: 1536
        // text-embedding-3-large: 3072
        // text-embedding-ada-002: 1536
        this.dimension = this.config.embeddingModel.includes('large') ? 3072 : 1536;
    }

    async embed(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) {
            return [];
        }

        const batchSize = this.config.embeddingBatchSize;
        const allEmbeddings: number[][] = [];

        // Process in batches with rate limiting
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);

            try {
                const response = await this.client.embeddings.create({
                    model: this.config.embeddingModel,
                    input: batch,
                });

                const embeddings = response.data.map(item => item.embedding);
                allEmbeddings.push(...embeddings);

                // Simple rate limiting: wait between batches
                if (i + batchSize < texts.length) {
                    await this.sleep(200); // 200ms between batches
                }
            } catch (error) {
                console.error(`Error embedding batch ${i / batchSize + 1}:`, error);
                throw error;
            }
        }

        return allEmbeddings;
    }

    getDimension(): number {
        return this.dimension;
    }

    getProviderName(): string {
        return 'openai';
    }

    getModelName(): string {
        return this.config.embeddingModel;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
