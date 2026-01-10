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

        // Process in batches with rate limiting and retry logic
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);

            // Retry with exponential backoff
            const embeddings = await this.retryWithBackoff(async () => {
                const response = await this.client.embeddings.create({
                    model: this.config.embeddingModel,
                    input: batch,
                });

                return response.data.map(item => item.embedding);
            }, `batch ${i / batchSize + 1}`);

            allEmbeddings.push(...embeddings);

            // Simple rate limiting: wait between batches
            if (i + batchSize < texts.length) {
                await this.sleep(200); // 200ms between batches
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
        maxRetries: number = 5
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;

                // Check if it's a rate limit error (429)
                const isRateLimit =
                    error?.status === 429 ||
                    error?.message?.includes('429') ||
                    error?.message?.includes('Rate limit');

                if (!isRateLimit || attempt === maxRetries) {
                    // Not a rate limit error, or max retries reached
                    throw error;
                }

                // Extract wait time from error message if available
                const waitTimeMatch = error?.message?.match(/try again in (\d+)ms/i);
                const suggestedWait = waitTimeMatch ? parseInt(waitTimeMatch[1]) : null;

                // Calculate backoff: use suggested wait time or exponential backoff
                const backoffMs = suggestedWait || Math.min(1000 * Math.pow(2, attempt), 30000);

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
        return 'openai';
    }

    getModelName(): string {
        return this.config.embeddingModel;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
