import * as path from 'path';
import { FileDiscovery, ParserFactory } from '../parsers';
import { GosuChunker, GosuTemplateChunker, Chunk } from '../chunkers';
import { IEmbeddingProvider } from '../embeddings';
import { IVectorStore } from '../vectorstore';
import { HashTracker } from './HashTracker';
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
    private progressCallback?: (progress: IngestionProgress) => void;

    constructor(
        embeddingProvider: IEmbeddingProvider,
        vectorStore: IVectorStore,
        hashTracker?: HashTracker
    ) {
        this.embeddingProvider = embeddingProvider;
        this.vectorStore = vectorStore;
        this.hashTracker = hashTracker || new HashTracker();
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

        // Process files
        for (const filePath of files) {
            progress.currentFile = filePath;
            this.reportProgress(progress);

            try {
                // Check if file changed
                const hasChanged = await this.hashTracker.hasFileChanged(filePath);
                if (!hasChanged) {
                    progress.skippedFiles++;
                    console.log(`⏭️  Skipped (unchanged): ${path.relative(sourceRoot, filePath)}`);
                    continue;
                }

                // Process file
                const chunks = await this.processFile(filePath, sourceRoot);
                if (chunks.length > 0) {
                    progress.totalChunks += chunks.length;
                    await this.hashTracker.updateFile(filePath, chunks.length);
                }

                progress.processedFiles++;
                console.log(`✅ Processed: ${path.relative(sourceRoot, filePath)} (${chunks.length} chunks)`);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                progress.errors.push({ file: filePath, error: errorMsg });
                console.error(`❌ Error processing ${filePath}:`, errorMsg);
            }
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

        // Generate embeddings
        const texts = chunks.map(chunk => chunk.content);
        const embeddings = await this.embeddingProvider.embed(texts);

        // Upsert to vector store
        await this.vectorStore.upsert(chunks, embeddings);

        return chunks;
    }

    private reportProgress(progress: IngestionProgress): void {
        if (this.progressCallback) {
            this.progressCallback(progress);
        }
    }
}
