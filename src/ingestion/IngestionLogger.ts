import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export enum IngestionStatus {
    SUCCESS = 'success',
    SKIPPED = 'skipped',
    PARSE_ERROR = 'parse_error',
    CHUNK_ERROR = 'chunk_error',
    EMBEDDING_ERROR = 'embedding_error',
    STORAGE_ERROR = 'storage_error',
    RATE_LIMIT = 'rate_limit',
    TOKEN_LIMIT = 'token_limit',
    UNKNOWN_ERROR = 'unknown_error',
}

export interface IngestionLogEntry {
    id?: number;
    timestamp: string;
    sessionId: string;
    filePath: string;
    relativePath: string;
    status: IngestionStatus;
    chunkCount?: number;
    errorMessage?: string;
    errorDetails?: string; // JSON string for structured error data
    lineNumber?: number;
    columnNumber?: number;
    duration?: number; // milliseconds
}

export class IngestionLogger {
    private db: Database.Database;
    private sessionId: string;

    constructor(dbPath: string = './ingestion.db') {
        this.db = new Database(dbPath);
        this.sessionId = new Date().toISOString().replace(/[:.]/g, '-');
        this.initDatabase();
    }

    private initDatabase(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS ingestion_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        session_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        status TEXT NOT NULL,
        chunk_count INTEGER,
        error_message TEXT,
        error_details TEXT,
        line_number INTEGER,
        column_number INTEGER,
        duration INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_session ON ingestion_logs(session_id);
      CREATE INDEX IF NOT EXISTS idx_status ON ingestion_logs(status);
      CREATE INDEX IF NOT EXISTS idx_file ON ingestion_logs(file_path);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON ingestion_logs(timestamp);
    `);
    }

    log(entry: IngestionLogEntry): void {
        const stmt = this.db.prepare(`
      INSERT INTO ingestion_logs (
        timestamp, session_id, file_path, relative_path, status,
        chunk_count, error_message, error_details, line_number, column_number, duration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            entry.timestamp || new Date().toISOString(),
            entry.sessionId || this.sessionId,
            entry.filePath,
            entry.relativePath,
            entry.status,
            entry.chunkCount,
            entry.errorMessage,
            entry.errorDetails,
            entry.lineNumber,
            entry.columnNumber,
            entry.duration
        );
    }

    getSessionSummary(sessionId?: string): any {
        const sid = sessionId || this.sessionId;
        const stmt = this.db.prepare(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(chunk_count) as total_chunks
      FROM ingestion_logs
      WHERE session_id = ?
      GROUP BY status
    `);

        return stmt.all(sid);
    }

    getErrors(sessionId?: string, limit: number = 100): IngestionLogEntry[] {
        const sid = sessionId || this.sessionId;
        const stmt = this.db.prepare(`
      SELECT * FROM ingestion_logs
      WHERE session_id = ? AND status != 'success' AND status != 'skipped'
      ORDER BY timestamp DESC
      LIMIT ?
    `);

        return stmt.all(sid, limit) as IngestionLogEntry[];
    }

    getParseErrors(sessionId?: string): IngestionLogEntry[] {
        const sid = sessionId || this.sessionId;
        const stmt = this.db.prepare(`
      SELECT * FROM ingestion_logs
      WHERE session_id = ? AND status = 'parse_error'
      ORDER BY file_path
    `);

        return stmt.all(sid) as IngestionLogEntry[];
    }

    exportToJSON(sessionId?: string, outputPath?: string): void {
        const sid = sessionId || this.sessionId;
        const stmt = this.db.prepare(`
      SELECT * FROM ingestion_logs
      WHERE session_id = ?
      ORDER BY timestamp
    `);

        const logs = stmt.all(sid);
        const output = outputPath || `ingestion-report-${sid}.json`;

        fs.writeFileSync(output, JSON.stringify({
            sessionId: sid,
            timestamp: new Date().toISOString(),
            summary: this.getSessionSummary(sid),
            logs,
        }, null, 2));

        console.log(`📊 Report exported to: ${output}`);
    }

    close(): void {
        this.db.close();
    }

    getSessionId(): string {
        return this.sessionId;
    }
}

/**
 * Categorize error type from error message
 */
export function categorizeError(error: Error | string): IngestionStatus {
    const message = typeof error === 'string' ? error : error.message;
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('maximum context length') || lowerMessage.includes('token')) {
        return IngestionStatus.TOKEN_LIMIT;
    }
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
        return IngestionStatus.RATE_LIMIT;
    }
    if (lowerMessage.includes('parse') || lowerMessage.includes('syntax')) {
        return IngestionStatus.PARSE_ERROR;
    }
    if (lowerMessage.includes('chunk')) {
        return IngestionStatus.CHUNK_ERROR;
    }
    if (lowerMessage.includes('embed')) {
        return IngestionStatus.EMBEDDING_ERROR;
    }
    if (lowerMessage.includes('chroma') || lowerMessage.includes('upsert')) {
        return IngestionStatus.STORAGE_ERROR;
    }

    return IngestionStatus.UNKNOWN_ERROR;
}
