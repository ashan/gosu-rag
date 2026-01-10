import Parser from 'tree-sitter';
import * as fs from 'fs/promises';
import { IParser, ParseResult } from './IParser';

// @ts-ignore - tree-sitter-gosu-template doesn't have type definitions
import GosuTemplate from 'tree-sitter-gosu-template';

export class GosuTemplateParser implements IParser {
    private parser: Parser;

    constructor() {
        this.parser = new Parser();
        this.parser.setLanguage(GosuTemplate as any);
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
        return 'gosu_template';
    }

    getFileExtensions(): string[] {
        return ['.gst'];
    }
}
