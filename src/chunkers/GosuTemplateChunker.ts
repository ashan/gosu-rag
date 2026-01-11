import Parser from 'tree-sitter';
import * as path from 'path';
import { IChunker } from './IChunker';
import { Chunk, ChunkType, createChunk } from './types';
import { loadConfig } from '../config';

export class GosuTemplateChunker implements IChunker {
    private config = loadConfig();
    private sourceRoot: string;

    constructor(sourceRoot: string) {
        this.sourceRoot = sourceRoot;
    }

    async extractChunks(
        tree: Parser.Tree,
        filePath: string,
        sourceCode: string
    ): Promise<Chunk[]> {
        const chunks: Chunk[] = [];
        const relativePath = path.relative(this.sourceRoot, filePath);
        const lines = sourceCode.split('\n');

        // Traverse AST for template-specific nodes
        this.traverseNode(
            tree.rootNode,
            filePath,
            relativePath,
            sourceCode,
            lines,
            chunks
        );

        return chunks;
    }

    private traverseNode(
        node: Parser.SyntaxNode,
        absolutePath: string,
        relativePath: string,
        sourceCode: string,
        lines: string[],
        chunks: Chunk[]
    ): void {
        const nodeType = node.type;

        // Extract chunks for template-specific nodes
        if (this.isTemplateUnit(nodeType)) {
            const chunk = this.createChunkFromNode(
                node,
                absolutePath,
                relativePath,
                sourceCode,
                chunks.length // Pass current chunk count as index
            );
            if (chunk) {
                chunks.push(chunk);
            }
        }

        // Recurse into children
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) {
                this.traverseNode(
                    child,
                    absolutePath,
                    relativePath,
                    sourceCode,
                    lines,
                    chunks
                );
            }
        }
    }

    private isTemplateUnit(nodeType: string): boolean {
        return this.config.gosuTemplateSemanticUnits.includes(nodeType);
    }

    private createChunkFromNode(
        node: Parser.SyntaxNode,
        absolutePath: string,
        relativePath: string,
        sourceCode: string,
        chunkIndex: number
    ): Chunk | null {
        const startLine = node.startPosition.row;
        const endLine = node.endPosition.row;
        const content = this.getNodeText(node, sourceCode);

        if (!content.trim()) {
            return null;
        }

        const chunkType = this.mapNodeTypeToChunkType(node.type);

        return createChunk(content, {
            absolutePath,
            relativePath,
            chunkType,
            language: 'gosu_template',
            lineStart: startLine + 1,
            lineEnd: endLine + 1,
        }, chunkIndex);
    }

    private mapNodeTypeToChunkType(nodeType: string): ChunkType {
        const mapping: Record<string, ChunkType> = {
            directive: 'template_directive',
            scriptlet: 'template_block',
            expression: 'template_block',
            declaration: 'template_block',
        };
        return mapping[nodeType] || 'file';
    }

    private getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
        return sourceCode.slice(node.startIndex, node.endIndex);
    }

    getLanguage(): string {
        return 'gosu_template';
    }
}
