import Parser from 'tree-sitter';

export interface ParseResult {
    tree: Parser.Tree;
    rootNode: Parser.SyntaxNode;
    hasError: boolean;
}

export interface IParser {
    /**
     * Parse a source file and return the AST
     * @param filePath - Absolute path to the file
     * @param sourceCode - Optional source code (if not provided, read from filePath)
     * @returns Parse result with tree and root node
     */
    parse(filePath: string, sourceCode?: string): Promise<ParseResult>;

    /**
     * Get the language name this parser handles
     */
    getLanguageName(): string;

    /**
     * Get file extensions this parser handles
     */
    getFileExtensions(): string[];
}
