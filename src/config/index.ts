import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
    // Source Configuration
    sourcePath: z.string().default('./gsrc'),

    // Chunking Configuration
    chunkSize: z.coerce.number().positive().default(1000),
    chunkOverlap: z.coerce.number().nonnegative().default(200),

    // Embeddings Configuration
    embeddingProvider: z.enum(['openai', 'ollama']).default('openai'),
    embeddingModel: z.string().default('text-embedding-3-small'),
    embeddingBatchSize: z.coerce.number().positive().default(100),
    embeddingConcurrency: z.coerce.number().positive().default(5),
    openaiApiKey: z.string().optional(),

    // Vector Store Configuration
    vectorStore: z.enum(['chroma']).default('chroma'),
    chromaHost: z.string().default('localhost'),
    chromaPort: z.coerce.number().positive().default(8000),
    chromaCollection: z.string().default('guidewire-code'),

    // Logging
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
    const raw = {
        sourcePath: process.env.SOURCE_PATH,
        chunkSize: process.env.CHUNK_SIZE,
        chunkOverlap: process.env.CHUNK_OVERLAP,
        embeddingProvider: process.env.EMBEDDING_PROVIDER,
        embeddingModel: process.env.EMBEDDING_MODEL,
        embeddingBatchSize: process.env.EMBEDDING_BATCH_SIZE,
        embeddingConcurrency: process.env.EMBEDDING_CONCURRENCY,
        openaiApiKey: process.env.OPENAI_API_KEY,
        vectorStore: process.env.VECTOR_STORE,
        chromaHost: process.env.CHROMA_HOST,
        chromaPort: process.env.CHROMA_PORT,
        chromaCollection: process.env.CHROMA_COLLECTION,
        logLevel: process.env.LOG_LEVEL,
    };

    try {
        return configSchema.parse(raw);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('Configuration validation failed:');
            error.issues.forEach((err) => {
                console.error(`  - ${err.path.join('.')}: ${err.message}`);
            });
            process.exit(1);
        }
        throw error;
    }
}
