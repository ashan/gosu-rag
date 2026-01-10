import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileDiscoveryOptions {
    /**
     * Root directory to start discovery
     */
    rootPath: string;

    /**
     * File extensions to include (e.g., ['.gs', '.gsx', '.gst'])
     */
    extensions: string[];

    /**
     * Directories to exclude (default: node_modules, .git, dist, build)
     */
    excludeDirs?: string[];

    /**
     * Maximum depth to traverse (-1 for unlimited)
     */
    maxDepth?: number;
}

export class FileDiscovery {
    private static readonly DEFAULT_EXCLUDE_DIRS = [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.idea',
        '.vscode',
    ];

    /**
     * Discover all files matching the given extensions recursively
     */
    static async discoverFiles(options: FileDiscoveryOptions): Promise<string[]> {
        const {
            rootPath,
            extensions,
            excludeDirs = this.DEFAULT_EXCLUDE_DIRS,
            maxDepth = -1,
        } = options;

        const files: string[] = [];
        await this.walkDirectory(rootPath, rootPath, extensions, excludeDirs, maxDepth, 0, files);
        return files;
    }

    private static async walkDirectory(
        rootPath: string,
        currentPath: string,
        extensions: string[],
        excludeDirs: string[],
        maxDepth: number,
        currentDepth: number,
        files: string[]
    ): Promise<void> {
        // Check depth limit
        if (maxDepth >= 0 && currentDepth > maxDepth) {
            return;
        }

        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);

            if (entry.isDirectory()) {
                // Skip excluded directories
                if (excludeDirs.includes(entry.name)) {
                    continue;
                }

                // Recurse into subdirectory
                await this.walkDirectory(
                    rootPath,
                    fullPath,
                    extensions,
                    excludeDirs,
                    maxDepth,
                    currentDepth + 1,
                    files
                );
            } else if (entry.isFile()) {
                // Check if file has matching extension
                const ext = path.extname(entry.name);
                if (extensions.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    }

    /**
     * Get file count by extension
     */
    static async getFileStats(files: string[]): Promise<Map<string, number>> {
        const stats = new Map<string, number>();

        for (const file of files) {
            const ext = path.extname(file);
            stats.set(ext, (stats.get(ext) || 0) + 1);
        }

        return stats;
    }
}
