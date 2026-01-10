import { IParser } from './IParser';
import { GosuParser } from './GosuParser';
import { GosuTemplateParser } from './GosuTemplateParser';

export class ParserFactory {
    private static parsers: Map<string, IParser> = new Map();

    static {
        // Register parsers
        const gosuParser = new GosuParser();
        const templateParser = new GosuTemplateParser();

        gosuParser.getFileExtensions().forEach(ext => {
            this.parsers.set(ext, gosuParser);
        });

        templateParser.getFileExtensions().forEach(ext => {
            this.parsers.set(ext, templateParser);
        });
    }

    /**
     * Get parser for a given file extension
     * @param extension - File extension (e.g., '.gs', '.gst')
     * @returns Parser instance or undefined
     */
    static getParser(extension: string): IParser | undefined {
        return this.parsers.get(extension);
    }

    /**
     * Get parser for a given file path
     * @param filePath - Full file path
     * @returns Parser instance or undefined
     */
    static getParserForFile(filePath: string): IParser | undefined {
        const ext = filePath.substring(filePath.lastIndexOf('.'));
        return this.getParser(ext);
    }

    /**
     * Get all supported file extensions
     */
    static getSupportedExtensions(): string[] {
        return Array.from(this.parsers.keys());
    }
}
