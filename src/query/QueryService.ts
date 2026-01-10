import { IEmbeddingProvider } from '../embeddings';
import { IVectorStore, QueryFilter, QueryResult } from '../vectorstore';
import { Chunk } from '../chunkers';

export interface RetrievalOptions {
    /** Number of results to return */
    topK?: number;

    /** Filter by package */
    package?: string;

    /** Filter by class name */
    className?: string;

    /** Filter by chunk type */
    chunkType?: string;

    /** Filter by language */
    language?: string;

    /** Minimum similarity score (0-1) */
    minScore?: number;
}

export interface RetrievalResult {
    chunk: Chunk;
    score: number;
    distance: number;
}

export class QueryService {
    private embeddingProvider: IEmbeddingProvider;
    private vectorStore: IVectorStore;

    constructor(
        embeddingProvider: IEmbeddingProvider,
        vectorStore: IVectorStore
    ) {
        this.embeddingProvider = embeddingProvider;
        this.vectorStore = vectorStore;
    }

    /**
     * Query the knowledge base with natural language
     */
    async query(
        queryText: string,
        options: RetrievalOptions = {}
    ): Promise<RetrievalResult[]> {
        const {
            topK = 10,
            package: pkg,
            className,
            chunkType,
            language,
            minScore = 0,
        } = options;

        // Generate embedding for query
        const embeddings = await this.embeddingProvider.embed([queryText]);
        const queryEmbedding = embeddings[0];

        // Build filters
        const filters: QueryFilter = {};
        if (pkg) filters.package = pkg;
        if (className) filters.className = className;
        if (chunkType) filters.chunkType = chunkType;
        if (language) filters.language = language;

        // Query vector store
        const results = await this.vectorStore.query(
            queryEmbedding,
            topK,
            Object.keys(filters).length > 0 ? filters : undefined
        );

        // Filter by minimum score
        return results.filter(result => result.score >= minScore);
    }

    /**
     * Format results for human-readable console output
     */
    formatForHuman(results: RetrievalResult[]): string {
        if (results.length === 0) {
            return 'No results found.';
        }

        let output = `\n📊 Found ${results.length} results:\n\n`;

        results.forEach((result, index) => {
            const { chunk, score } = result;
            const { metadata } = chunk;

            output += `\n${index + 1}. Score: ${(score * 100).toFixed(1)}%\n`;
            output += `   📁 ${metadata.relativePath}\n`;

            if (metadata.package) {
                output += `   📦 Package: ${metadata.package}\n`;
            }
            if (metadata.className) {
                output += `   🏷️  Class: ${metadata.className}\n`;
            }
            if (metadata.methodName) {
                output += `   🔧 Method: ${metadata.methodName}\n`;
            }

            output += `   📝 Type: ${metadata.chunkType}\n`;
            output += `   📍 Lines: ${metadata.lineStart}-${metadata.lineEnd}\n`;

            // Show snippet of content
            const snippet = chunk.content.slice(0, 200).replace(/\n/g, ' ');
            output += `   💬 "${snippet}${chunk.content.length > 200 ? '...' : ''}"\n`;
        });

        return output;
    }

    /**
     * Format results for AI agent consumption
     */
    formatForAgent(results: RetrievalResult[]): string {
        if (results.length === 0) {
            return 'No relevant code found in the knowledge base.';
        }

        let output = '# Retrieved Code Context\n\n';
        output += `Found ${results.length} relevant code chunks:\n\n`;

        output += '---\n\n';

        results.forEach((result, index) => {
            const { chunk } = result;
            const { metadata } = chunk;

            output += `## Result ${index + 1}\n\n`;

            // Metadata
            output += '**Location:**\n';
            output += `- File: \`${metadata.relativePath}\`\n`;
            output += `- Lines: ${metadata.lineStart}-${metadata.lineEnd}\n`;

            if (metadata.package) output += `- Package: \`${metadata.package}\`\n`;
            if (metadata.className) output += `- Class: \`${metadata.className}\`\n`;
            if (metadata.methodName) output += `- Method: \`${metadata.methodName}\`\n`;

            output += `- Type: ${metadata.chunkType}\n`;
            output += `- Language: ${metadata.language}\n\n`;

            // Code content
            output += '**Code:**\n';
            output += '```' + (metadata.language === 'gosu_template' ? 'gosu-template' : 'gosu') + '\n';
            output += chunk.content;
            output += '\n```\n\n';

            output += '---\n\n';
        });

        output += '\n**Note:** Use this retrieved context to inform your code generation. ';
        output += 'Ensure your code aligns with the patterns, naming conventions, and structures shown above.\n';

        return output;
    }
}
