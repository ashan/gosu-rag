import Parser from 'tree-sitter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IParser, ParseResult } from './IParser';

// @ts-ignore - tree-sitter-gosu doesn't have type definitions
import Gosu from 'tree-sitter-gosu';

export class GosuParser implements IParser {
    private parser: Parser;

    constructor() {
        this.parser = new Parser();
        this.parser.setLanguage(Gosu as any);
    }

    async parse(filePath: string, sourceCode?: string): Promise<ParseResult> {
        const code = sourceCode ?? await fs.readFile(filePath, 'utf-8');
        const tree = this.parser.parse(code);

        return {
            tree,
            rootNode: tree.rootNode,
            hasError: tree.rootNode.hasError,
        };
    }

    getLanguageName(): string {
        return 'gosu';
    }

    getFileExtensions(): string[] {
        return ['.gs', '.gsx'];
    }
}
