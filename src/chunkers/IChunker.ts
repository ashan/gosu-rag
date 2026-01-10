import Parser from 'tree-sitter';
import { Chunk } from './types';

export interface IChunker {
    /**
     * Extract semantic chunks from an AST
     * @param tree - Parsed tree from tree-sitter
     * @param filePath - Absolute path to source file
     * @param sourceCode - Original source code
     * @returns Array of chunks
     */
    extractChunks(
        tree: Parser.Tree,
        filePath: string,
        sourceCode: string
    ): Promise<Chunk[]>;

    /**
     * Get the language this chunker handles
     */
    getLanguage(): string;
}
