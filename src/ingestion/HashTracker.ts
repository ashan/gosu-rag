import * as fs from 'fs/promises';
import * as crypto from 'crypto';

export interface FileHashRecord {
    path: string;
    hash: string;
    lastModified: number;
    chunkCount: number;
}

export interface HashCache {
    version: string;
    files: Map<string, FileHashRecord>;
}

export class HashTracker {
    private cache: HashCache;
    private cacheFilePath: string;

    constructor(cacheFilePath: string = '.rag-cache.json') {
        this.cacheFilePath = cacheFilePath;
        this.cache = {
            version: '1.0',
            files: new Map(),
        };
    }

    /**
     * Load the hash cache from disk
     */
    async load(): Promise<void> {
        try {
            const content = await fs.readFile(this.cacheFilePath, 'utf-8');
            const data = JSON.parse(content);
            this.cache.version = data.version;
            this.cache.files = new Map(Object.entries(data.files));
        } catch (error) {
            // Cache doesn't exist yet, start fresh
            this.cache.files = new Map();
        }
    }

    /**
     * Save the hash cache to disk
     */
    async save(): Promise<void> {
        const data = {
            version: this.cache.version,
            files: Object.fromEntries(this.cache.files),
        };
        await fs.writeFile(this.cacheFilePath, JSON.stringify(data, null, 2));
    }

    /**
     * Check if a file has changed since last ingestion
     */
    async hasFileChanged(filePath: string): Promise<boolean> {
        const stats = await fs.stat(filePath);
        const record = this.cache.files.get(filePath);

        if (!record) {
            return true; // New file
        }

        // Check if file modified time is newer than cached
        return stats.mtimeMs > record.lastModified;
    }

    /**
     * Calculate file hash
     */
    async calculateFileHash(filePath: string): Promise<string> {
        const content = await fs.readFile(filePath, 'utf-8');
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Update cache record for a file
     */
    async updateFile(filePath: string, chunkCount: number): Promise<void> {
        const stats = await fs.stat(filePath);
        const hash = await this.calculateFileHash(filePath);

        this.cache.files.set(filePath, {
            path: filePath,
            hash,
            lastModified: stats.mtimeMs,
            chunkCount,
        });
    }

    /**
     * Get cached record for a file
     */
    getRecord(filePath: string): FileHashRecord | undefined {
        return this.cache.files.get(filePath);
    }

    /**
     * Remove file from cache (for deletions)
     */
    removeFile(filePath: string): void {
        this.cache.files.delete(filePath);
    }

    /**
     * Get all cached file paths
     */
    getCachedFiles(): string[] {
        return Array.from(this.cache.files.keys());
    }
}
