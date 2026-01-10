import * as crypto from 'crypto';

export type ChunkType =
    | 'package'
    | 'class'
    | 'interface'
    | 'enum'
    | 'function'
    | 'method'
    | 'property'
    | 'template_directive'
    | 'template_block'
    | 'file';

export interface ChunkMetadata {
    /** Absolute file path */
    absolutePath: string;

    /** Relative file path from source root */
    relativePath: string;

    /** Package or namespace */
    package?: string;

    /** Class or template name */
    className?: string;

    /** Method or function name */
    methodName?: string;

    /** Type of chunk */
    chunkType: ChunkType;

    /** Language (gosu, gosu_template) */
    language: string;

    /** Line range in source file */
    lineStart: number;
    lineEnd: number;

    /** Content hash (SHA-256) for change detection */
    contentHash: string;
}

export interface Chunk {
    /** Unique identifier for the chunk */
    id: string;

    /** Source code content */
    content: string;

    /** Metadata for retrieval and filtering */
    metadata: ChunkMetadata;
}

/**
 * Generate a unique chunk ID from metadata
 */
export function generateChunkId(metadata: ChunkMetadata): string {
    const parts = [
        metadata.relativePath,
        metadata.package,
        metadata.className,
        metadata.methodName,
        metadata.lineStart,
        metadata.lineEnd,
    ].filter(Boolean);

    return crypto
        .createHash('md5')
        .update(parts.join(':'))
        .digest('hex');
}

/**
 * Generate content hash for a chunk
 */
export function generateContentHash(content: string): string {
    return crypto
        .createHash('sha256')
        .update(content)
        .digest('hex');
}

/**
 * Create a chunk with auto-generated ID and hash
 */
export function createChunk(
    content: string,
    metadata: Omit<ChunkMetadata, 'contentHash'>
): Chunk {
    const contentHash = generateContentHash(content);
    const fullMetadata: ChunkMetadata = { ...metadata, contentHash };

    return {
        id: generateChunkId(fullMetadata),
        content,
        metadata: fullMetadata,
    };
}
