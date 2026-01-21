#!/usr/bin/env node

import { ChromaAdapter } from '../vectorstore';
import { createEmbeddingProvider } from '../embeddings';
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
        console.error('\nQuery Filters:');
        console.error('  --chunk-type <type>    - Filter by chunk type (function, class, file, etc.)');
        console.error('  --class-name <name>    - Filter by class name');
        console.error('  --package <pkg>        - Filter by package name');
        console.error('  --file <path>          - Filter by relative file path');
        console.error('  --top-k <n>            - Number of results (default: 5)');
        console.error('\nExamples:');
        console.error('  npm run ingest                              # Ingest from SOURCE_PATH');
        console.error('  npm run ingest ./gsrc                       # Ingest entire directory');
        console.error('  npm run ingest ./gsrc/MyFile.gs             # Ingest single file');
        console.error('  npm run query "policy location"             # Simple query');
        console.error('  npm run query "uses gw" --chunk-type file   # Query imports only');
        console.error('  npm run query "validate" --class-name Account --top-k 10');
        process.exit(1);
    }

    try {
        switch (command) {
            case 'ingest':
                await runIngest(args[1]);
                break;
            case 'query':
                // Extract query text (everything between 'query' and first flag)
                let queryText = '';
                for (let i = 1; i < args.length; i++) {
                    if (args[i].startsWith('--')) {
                        break; // Stop at first flag
                    }
                    queryText += (queryText ? ' ' : '') + args[i];
                }
                await runQuery(queryText);
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
    const embeddingProvider = createEmbeddingProvider();
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

    // Parse flags from remaining arguments
    const args = process.argv.slice(2);
    const filters: any = {};
    let topK = 5;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const flagName = arg.slice(2);
            const flagValue = args[i + 1];

            switch (flagName) {
                case 'chunk-type':
                case 'chunkType':
                    filters.chunkType = flagValue;
                    i++;
                    break;
                case 'class-name':
                case 'className':
                    filters.className = flagValue;
                    i++;
                    break;
                case 'package':
                    filters.package = flagValue;
                    i++;
                    break;
                case 'file':
                    filters.relativePath = flagValue;
                    i++;
                    break;
                case 'top-k':
                case 'topK':
                case 'limit':
                    topK = parseInt(flagValue) || 5;
                    i++;
                    break;
            }
        }
    }

    console.log(`🔍 Query: "${queryText}"`);
    if (Object.keys(filters).length > 0) {
        console.log(`🔎 Filters:`, filters);
    }
    console.log();

    // Initialize components
    const embeddingProvider = createEmbeddingProvider();
    const vectorStore = new ChromaAdapter();

    await vectorStore.connect();

    const queryService = new QueryService(embeddingProvider, vectorStore);
    const results = await queryService.query(queryText, { topK, ...filters });

    console.log(queryService.formatForHuman(results));
}

main();
