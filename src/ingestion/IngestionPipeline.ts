import * as path from 'path';
import { FileDiscovery, ParserFactory } from '../parsers';
import { GosuChunker, GosuTemplateChunker, Chunk } from '../chunkers';
import { IEmbeddingProvider } from '../embeddings';
import { IVectorStore } from '../vectorstore';
import { HashTracker } from './HashTracker';
import { IngestionLogger, IngestionStatus, categorizeError } from './IngestionLogger';
import { loadConfig } from '../config';

export interface IngestionProgress {
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    totalChunks: number;
    currentFile?: string;
    errors: Array<{ file: string; error: string }>;
}

export interface IngestionResult {
    filesProcessed: number;
    filesSkipped: number;
    chunksCreated: number;
    errors: number;
    duration: number;
}

export class IngestionPipeline {
    private config = loadConfig();
    private hashTracker: HashTracker;
    private embeddingProvider: IEmbeddingProvider;
    private vectorStore: IVectorStore;
    private logger: IngestionLogger;
    private progressCallback?: (progress: IngestionProgress) => void;

    constructor(
        embeddingProvider: IEmbeddingProvider,
        vectorStore: IVectorStore,
        hashTracker?: HashTracker,
        logger?: IngestionLogger
    ) {
        this.embeddingProvider = embeddingProvider;
        this.vectorStore = vectorStore;
        this.hashTracker = hashTracker || new HashTracker();
        this.logger = logger || new IngestionLogger();
    }

    /**
     * Set progress callback for real-time updates
     */
    onProgress(callback: (progress: IngestionProgress) => void): void {
        this.progressCallback = callback;
    }

    /**
     * Run the full ingestion pipeline
     */
    async ingest(sourcePath?: string): Promise<IngestionResult> {
        const startTime = Date.now();
        const sourceRoot = sourcePath || this.config.sourcePath;

        console.log(`🚀 Starting ingestion from: ${sourceRoot}\n`);

        // Load hash cache
        await this.hashTracker.load();

        // Discover files
        console.log('📂 Discovering files...');
        const files = await FileDiscovery.discoverFiles({
            rootPath: sourceRoot,
            extensions: ['.gs', '.gsx', '.gst'],
        });
        console.log(`Found ${files.length} files\n`);

        const progress: IngestionProgress = {
            totalFiles: files.length,
            processedFiles: 0,
            skippedFiles: 0,
            totalChunks: 0,
            errors: [],
        };

        // Process files in parallel batches
        const concurrency = this.config.embeddingConcurrency || 5;
        const batchSize = 50; // Process 50 files at a time

        console.log(`⚡ Processing with concurrency: ${concurrency}\n`);

        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(files.length / batchSize);

            console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} files)`);

            // Process batch concurrently
            const results = await Promise.allSettled(
                batch.map(async (filePath) => {
                    try {
                        // Check if file changed
                        const hasChanged = await this.hashTracker.hasFileChanged(filePath);
                        if (!hasChanged) {
                            return { status: 'skipped' as const, filePath };
                        }

                        // Process file
                        const chunks = await this.processFile(filePath, sourceRoot);
                        if (chunks.length > 0) {
                            await this.hashTracker.updateFile(filePath, chunks.length);
                        }

                        return { status: 'processed' as const, filePath, chunkCount: chunks.length };
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        return { status: 'error' as const, filePath, error: errorMsg };
                    }
                })
            );

            // Update progress
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    const value = result.value;
                    if (value.status === 'skipped') {
                        progress.skippedFiles++;
                        console.log(`⏭️  ${path.relative(sourceRoot, value.filePath)}`);
                    } else if (value.status === 'processed') {
                        progress.processedFiles++;
                        progress.totalChunks += value.chunkCount || 0;
                        console.log(`✅ ${path.relative(sourceRoot, value.filePath)} (${value.chunkCount} chunks)`);
                    } else if (value.status === 'error') {
                        progress.errors.push({ file: value.filePath, error: value.error });
                        console.error(`❌ ${path.relative(sourceRoot, value.filePath)}: ${value.error}`);
                    }
                } else {
                    console.error(`❌ Batch error: ${result.reason}`);
                }
            }

            console.log(`   Progress: ${progress.processedFiles + progress.skippedFiles}/${files.length}\n`);
        }

        // Save hash cache
        await this.hashTracker.save();

        const duration = Date.now() - startTime;
        const result: IngestionResult = {
            filesProcessed: progress.processedFiles,
            filesSkipped: progress.skippedFiles,
            chunksCreated: progress.totalChunks,
            errors: progress.errors.length,
            duration,
        };

        console.log(`\n✅ Ingestion complete in ${(duration / 1000).toFixed(2)}s`);
        console.log(`   Processed: ${result.filesProcessed} files`);
        console.log(`   Skipped: ${result.filesSkipped} files`);
        console.log(`   Chunks: ${result.chunksCreated}`);
        console.log(`   Errors: ${result.errors}`);

        return result;
    }

    /**
     * Process a single file
     */
    private async processFile(filePath: string, sourceRoot: string): Promise<Chunk[]> {
        // Get parser
        const parser = ParserFactory.getParserForFile(filePath);
        if (!parser) {
            throw new Error(`No parser found for file: ${filePath}`);
        }

        // Parse file
        const parseResult = await parser.parse(filePath);
        if (parseResult.hasError) {
            console.warn(`⚠️  Parse errors in: ${filePath}`);
        }

        // Get chunker
        const ext = path.extname(filePath);
        const chunker = ext === '.gst'
            ? new GosuTemplateChunker(sourceRoot)
            : new GosuChunker(sourceRoot);

        // Extract chunks
        const sourceCode = await require('fs/promises').readFile(filePath, 'utf-8');
        const chunks = await chunker.extractChunks(
            parseResult.tree,
            filePath,
            sourceCode
        );

        if (chunks.length === 0) {
            return [];
        }

        // Filter out chunks that are too large (>8000 tokens ≈ 32000 chars)
        const MAX_CHUNK_SIZE = 30000; // Conservative limit
        const validChunks = chunks.filter(chunk => chunk.content.length <= MAX_CHUNK_SIZE);

        if (validChunks.length < chunks.length) {
            const skipped = chunks.length - validChunks.length;
            console.warn(`⚠️  Skipped ${skipped} oversized chunk(s) in ${path.basename(filePath)}`);
        }

        if (validChunks.length === 0) {
            return [];
        }

        // Generate embeddings
        const texts = validChunks.map(chunk => chunk.content);
        const embeddings = await this.embeddingProvider.embed(texts);

        // Upsert to vector store
        await this.vectorStore.upsert(validChunks, embeddings);

        return validChunks;
    }

    private reportProgress(progress: IngestionProgress): void {
        if (this.progressCallback) {
            this.progressCallback(progress);
        }
    }
}
