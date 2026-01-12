#!/usr/bin/env node

import { ChromaAdapter } from '../vectorstore';
import { OpenAIEmbeddingProvider } from '../embeddings';
import { IngestionPipeline } from '../ingestion';
import { QueryService } from '../query';

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        console.error('Usage: npm run [ingest|query] [args]');
        console.error('\nCommands:');
        console.error('  ingest [path]  - Ingest codebase from path (file or directory, default: SOURCE_PATH from .env)');
        console.error('  query <text>   - Query the knowledge base');
        console.error('  inspect        - Inspect ChromaDB collections');
        console.error('\nExamples:');
        console.error('  npm run ingest                    # Ingest from SOURCE_PATH');
        console.error('  npm run ingest ./gsrc             # Ingest entire directory');
        console.error('  npm run ingest ./gsrc/MyFile.gs   # Ingest single file');
        process.exit(1);
    }

    try {
        switch (command) {
            case 'ingest':
                await runIngest(args[1]);
                break;
            case 'query':
                await runQuery(args.slice(1).join(' '));
                break;
            case 'inspect':
                console.log('Use: npm run inspect-chroma');
                break;
            default:
                console.error(`Unknown command: ${command}`);
                process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

async function runIngest(sourcePath?: string) {
    console.log('🚀 RAG Ingestion Pipeline\n');

    // Initialize components
    const embeddingProvider = new OpenAIEmbeddingProvider();
    const vectorStore = new ChromaAdapter();

    await vectorStore.connect();

    // Check health
    const isHealthy = await vectorStore.healthCheck();
    if (!isHealthy) {
        throw new Error('ChromaDB is not accessible. Make sure it is running (docker compose up -d)');
    }

    // Run ingestion
    const pipeline = new IngestionPipeline(embeddingProvider, vectorStore);
    await pipeline.ingest(sourcePath);
}

async function runQuery(queryText: string) {
    if (!queryText) {
        console.error('Please provide a query text');
        process.exit(1);
    }

    console.log(`🔍 Query: "${queryText}"\n`);

    // Initialize components
    const embeddingProvider = new OpenAIEmbeddingProvider();
    const vectorStore = new ChromaAdapter();

    await vectorStore.connect();

    const queryService = new QueryService(embeddingProvider, vectorStore);
    const results = await queryService.query(queryText, { topK: 5 });

    console.log(queryService.formatForHuman(results));
}

main();
