import { ChromaClient, Collection } from 'chromadb';
import { IVectorStore, QueryFilter, QueryResult } from './IVectorStore';
import { Chunk } from '../chunkers';
import { loadConfig } from '../config';

export class ChromaAdapter implements IVectorStore {
    private client: ChromaClient;
    private collection: Collection | null = null;
    private config = loadConfig();

    constructor() {
        this.client = new ChromaClient({
            path: `http://${this.config.chromaHost}:${this.config.chromaPort}`,
        });
    }

    async connect(): Promise<void> {
        try {
            // Get or create collection
            this.collection = await this.client.getOrCreateCollection({
                name: this.config.chromaCollection,
                metadata: {
                    description: 'Guidewire Gosu codebase embeddings',
                },
            });
            console.log(`Connected to ChromaDB collection: ${this.config.chromaCollection}`);
        } catch (error) {
            console.error('Failed to connect to ChromaDB:', error);
            throw error;
        }
    }

    async upsert(chunks: Chunk[], embeddings: number[][]): Promise<void> {
        if (!this.collection) {
            throw new Error('Not connected to ChromaDB. Call connect() first.');
        }

        if (chunks.length !== embeddings.length) {
            throw new Error('Chunks and embeddings length mismatch');
        }

        // Prepare data for ChromaDB
        const ids = chunks.map(chunk => chunk.id);
        const documents = chunks.map(chunk => chunk.content);
        const metadatas = chunks.map(chunk => ({
            absolutePath: chunk.metadata.absolutePath,
            relativePath: chunk.metadata.relativePath,
            package: chunk.metadata.package || '',
            className: chunk.metadata.className || '',
            methodName: chunk.metadata.methodName || '',
            chunkType: chunk.metadata.chunkType,
            language: chunk.metadata.language,
            lineStart: chunk.metadata.lineStart,
            lineEnd: chunk.metadata.lineEnd,
            contentHash: chunk.metadata.contentHash,
        }));

        await this.collection.upsert({
            ids,
            embeddings,
            documents,
            metadatas,
        });
    }

    async query(
        embedding: number[],
        topK: number,
        filters?: QueryFilter
    ): Promise<QueryResult[]> {
        if (!this.collection) {
            throw new Error('Not connected to ChromaDB. Call connect() first.');
        }

        // Build where clause for filtering
        const where: Record<string, any> = {};
        if (filters) {
            if (filters.package) where.package = filters.package;
            if (filters.className) where.className = filters.className;
            if (filters.chunkType) where.chunkType = filters.chunkType;
            if (filters.language) where.language = filters.language;
            if (filters.relativePath) where.relativePath = { "$contains": filters.relativePath };
        }

        const results = await this.collection.query({
            queryEmbeddings: [embedding],
            nResults: topK,
            where: Object.keys(where).length > 0 ? where : undefined,
        });

        // Transform results to QueryResult format
        const queryResults: QueryResult[] = [];

        if (results.ids && results.ids[0]) {
            for (let i = 0; i < results.ids[0].length; i++) {
                const metadata = results.metadatas?.[0]?.[i];
                const document = results.documents?.[0]?.[i];
                const distance = results.distances?.[0]?.[i] ?? 0;

                if (metadata && document) {
                    const chunk: Chunk = {
                        id: results.ids[0][i],
                        content: document,
                        metadata: {
                            absolutePath: (metadata.absolutePath as string) || '',
                            relativePath: (metadata.relativePath as string) || '',
                            package: (metadata.package as string) || undefined,
                            className: (metadata.className as string) || undefined,
                            methodName: (metadata.methodName as string) || undefined,
                            chunkType: metadata.chunkType as any,
                            language: (metadata.language as string) || '',
                            lineStart: Number(metadata.lineStart) || 0,
                            lineEnd: Number(metadata.lineEnd) || 0,
                            contentHash: (metadata.contentHash as string) || '',
                        },
                    };

                    // ChromaDB returns squared Euclidean distance
                    // Convert to similarity score: smaller distance = higher similarity
                    // Use 1 / (1 + distance) to normalize to [0, 1] range
                    const similarityScore = 1 / (1 + distance);

                    queryResults.push({
                        chunk,
                        score: similarityScore,
                        distance,
                    });

                }
            }
        }

        return queryResults;
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.client.heartbeat();
            return true;
        } catch {
            return false;
        }
    }

    getCollectionName(): string {
        return this.config.chromaCollection;
    }
}
