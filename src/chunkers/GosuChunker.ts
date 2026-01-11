import Parser from 'tree-sitter';
import * as path from 'path';
import { IChunker } from './IChunker';
import { Chunk, ChunkType, createChunk } from './types';
import { loadConfig } from '../config';

export class GosuChunker implements IChunker {
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

        // Extract package declaration
        const packageName = this.extractPackage(tree.rootNode);

        // Traverse the AST for semantic units
        this.traverseNode(
            tree.rootNode,
            filePath,
            relativePath,
            packageName,
            sourceCode,
            lines,
            chunks
        );

        return chunks;
    }

    private extractPackage(node: Parser.SyntaxNode): string | undefined {
        // Look for package_declaration node
        const packageNode = this.findChild(node, 'package_declaration');
        if (packageNode) {
            return this.getNodeText(packageNode, '');
        }
        return undefined;
    }

    private traverseNode(
        node: Parser.SyntaxNode,
        absolutePath: string,
        relativePath: string,
        packageName: string | undefined,
        sourceCode: string,
        lines: string[],
        chunks: Chunk[]
    ): void {
        const nodeType = node.type;

        // Extract chunks for semantic units
        if (this.isSemanticUnit(nodeType)) {
            const chunk = this.createChunkFromNode(
                node,
                absolutePath,
                relativePath,
                packageName,
                sourceCode,
                lines,
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
                    packageName,
                    sourceCode,
                    lines,
                    chunks
                );
            }
        }
    }

    private isSemanticUnit(nodeType: string): boolean {
        return this.config.gosuSemanticUnits.includes(nodeType);
    }

    private createChunkFromNode(
        node: Parser.SyntaxNode,
        absolutePath: string,
        relativePath: string,
        packageName: string | undefined,
        sourceCode: string,
        lines: string[],
        chunkIndex: number
    ): Chunk | null {
        const startLine = node.startPosition.row;
        const endLine = node.endPosition.row;
        const content = this.getNodeText(node, sourceCode);

        if (!content.trim()) {
            return null;
        }

        // Extract class/function name
        const name = this.extractName(node);

        // Determine chunk type
        const chunkType = this.mapNodeTypeToChunkType(node.type);

        return createChunk(content, {
            absolutePath,
            relativePath,
            package: packageName,
            className: this.isClassLevel(node.type) ? name : undefined,
            methodName: this.isMethodLevel(node.type) ? name : undefined,
            chunkType,
            language: 'gosu',
            lineStart: startLine + 1, // 1-indexed
            lineEnd: endLine + 1,
        }, chunkIndex);
    }

    private extractName(node: Parser.SyntaxNode): string | undefined {
        // Look for identifier child
        const identifierNode = this.findChild(node, 'identifier');
        if (identifierNode) {
            return identifierNode.text;
        }
        return undefined;
    }

    private mapNodeTypeToChunkType(nodeType: string): ChunkType {
        const mapping: Record<string, ChunkType> = {
            class_declaration: 'class',
            interface_declaration: 'interface',
            enum_declaration: 'enum',
            enhancement_declaration: 'class', // Treat enhancements like classes
            function_declaration: 'function',
            property_declaration: 'property',
        };
        return mapping[nodeType] || 'file';
    }

    private isClassLevel(nodeType: string): boolean {
        return ['class_declaration', 'interface_declaration', 'enum_declaration', 'enhancement_declaration'].includes(nodeType);
    }

    private isMethodLevel(nodeType: string): boolean {
        return ['function_declaration', 'property_declaration'].includes(nodeType);
    }

    private getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
        return sourceCode.slice(node.startIndex, node.endIndex);
    }

    private findChild(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child && child.type === type) {
                return child;
            }
        }
        return null;
    }

    getLanguage(): string {
        return 'gosu';
    }
}
