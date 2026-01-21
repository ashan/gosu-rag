import { GoogleGenerativeAI } from '@google/generative-ai';
import { IEmbeddingProvider } from './IEmbeddingProvider';
import { loadConfig } from '../config';

export class GoogleEmbeddingProvider implements IEmbeddingProvider {
    private client: GoogleGenerativeAI;
    private config = loadConfig();
    private model: string;
    private dimension: number;

    constructor() {
        if (!this.config.googleApiKey) {
            throw new Error('GOOGLE_API_KEY is required for Google embedding provider');
        }

        this.client = new GoogleGenerativeAI(this.config.googleApiKey);
        this.model = this.config.embeddingModel || 'text-embedding-004';

        // Google text-embedding-004 has 768 dimensions
        this.dimension = 768;
    }

    async embed(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) {
            return [];
        }

        const embedModel = this.client.getGenerativeModel({ model: this.model });
        const batchSize = this.config.embeddingBatchSize;
        const allEmbeddings: number[][] = [];

        // Process in batches
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);

            // Embed each text in the batch
            const batchEmbeddings = await this.retryWithBackoff(async () => {
                const results: number[][] = [];
                for (const text of batch) {
                    const result = await embedModel.embedContent(text);
                    results.push(result.embedding.values);
                }
                return results;
            }, `batch ${i / batchSize + 1}`);

            allEmbeddings.push(...batchEmbeddings);

            // Simple rate limiting between batches
            if (i + batchSize < texts.length) {
                await this.sleep(200);
            }
        }

        return allEmbeddings;
    }

    /**
     * Retry a function with exponential backoff for rate limit errors
     */
    private async retryWithBackoff<T>(
        fn: () => Promise<T>,
        context: string,
        maxRetries: number = 10
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;

                const isRateLimit =
                    error?.status === 429 ||
                    error?.message?.includes('429') ||
                    error?.message?.includes('Rate limit') ||
                    error?.message?.includes('quota');

                if (!isRateLimit || attempt === maxRetries) {
                    throw error;
                }

                const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000);
                console.warn(`⏳ Rate limit hit for ${context}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);

                await this.sleep(backoffMs);
            }
        }

        throw lastError!;
    }

    getDimension(): number {
        return this.dimension;
    }

    getProviderName(): string {
        return 'google';
    }

    getModelName(): string {
        return this.model;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
