import { Chunk, ChunkMetadata } from './types';

/**
 * Split an oversized chunk into smaller sub-chunks with overlap
 */
export function splitOversizedChunk(
    chunk: Chunk,
    maxSize: number,
    overlapSize: number
): Chunk[] {
    if (chunk.content.length <= maxSize) {
        return [chunk];
    }

    const subChunks: Chunk[] = [];
    const content = chunk.content;
    let startPos = 0;
    let subChunkIndex = 0;

    while (startPos < content.length) {
        // Calculate end position for this sub-chunk
        const endPos = Math.min(startPos + maxSize, content.length);
        const subContent = content.substring(startPos, endPos);

        // Create sub-chunk with modified metadata
        const subChunk: Chunk = {
            id: `${chunk.id}_sub${subChunkIndex}`,
            content: subContent,
            metadata: {
                ...chunk.metadata,
                // Update line ranges for the sub-chunk (approximate)
                lineStart: chunk.metadata.lineStart + Math.floor(startPos / 100), // rough estimate
                lineEnd: chunk.metadata.lineEnd,
            },
        };

        subChunks.push(subChunk);
        subChunkIndex++;

        // Move start position with overlap
        if (endPos >= content.length) {
            break;
        }
        startPos = endPos - overlapSize;
    }

    return subChunks;
}

/**
 * Split multiple oversized chunks
 */
export function splitOversizedChunks(
    chunks: Chunk[],
    maxSize: number,
    overlapSize: number
): { validChunks: Chunk[]; splitCount: number } {
    const allChunks: Chunk[] = [];
    let splitCount = 0;

    for (const chunk of chunks) {
        if (chunk.content.length > maxSize) {
            const subChunks = splitOversizedChunk(chunk, maxSize, overlapSize);
            allChunks.push(...subChunks);
            splitCount += subChunks.length - 1; // Count extra chunks created
        } else {
            allChunks.push(chunk);
        }
    }

    return { validChunks: allChunks, splitCount };
}
