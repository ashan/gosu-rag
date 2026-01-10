import { IngestionLogger } from '../src/ingestion';

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const logger = new IngestionLogger();

    if (!command) {
        console.log('Usage: npm run view-logs [command] [options]');
        console.log('\nCommands:');
        console.log('  summary              - Show summary of latest session');
        console.log('  errors               - Show all errors from latest session');
        console.log('  parse-errors         - Show only parse errors');
        console.log('  export [session-id]  - Export to JSON');
        console.log('  sessions             - List all sessions');
        process.exit(1);
    }

    switch (command) {
        case 'summary':
            showSummary(logger);
            break;
        case 'errors':
            showErrors(logger);
            break;
        case 'parse-errors':
            showParseErrors(logger);
            break;
        case 'export':
            logger.exportToJSON(args[1]);
            break;
        case 'sessions':
            listSessions(logger);
            break;
        default:
            console.error(`Unknown command: ${command}`);
            process.exit(1);
    }

    logger.close();
}

function showSummary(logger: IngestionLogger) {
    const latestSession = logger.getLatestSession();

    if (!latestSession) {
        console.log('No ingestion sessions found in database.');
        return;
    }

    console.log('📊 Ingestion Summary\n');
    console.log(`Session: ${latestSession}\n`);

    const summary = logger.getSessionSummary(latestSession);

    let totalFiles = 0;
    let totalChunks = 0;

    summary.forEach((row: any) => {
        totalFiles += row.count;
        totalChunks += row.total_chunks || 0;

        const icon = row.status === 'success' ? '✅' :
            row.status === 'skipped' ? '⏭️' : '❌';

        console.log(`${icon} ${row.status.padEnd(20)} ${String(row.count).padStart(6)} files    ${String(row.total_chunks || 0).padStart(8)} chunks`);
    });

    console.log(`\n   ${'TOTAL'.padEnd(20)} ${String(totalFiles).padStart(6)} files    ${String(totalChunks).padStart(8)} chunks`);
}

function showErrors(logger: IngestionLogger) {
    const latestSession = logger.getLatestSession();

    if (!latestSession) {
        console.log('No ingestion sessions found in database.');
        return;
    }

    const errors = logger.getErrors(latestSession);

    console.log(`\n❌ Errors (${errors.length} total)\n`);

    errors.forEach((log: any, i: number) => {
        console.log(`${i + 1}. ${log.relative_path}`);
        console.log(`   Status: ${log.status}`);
        console.log(`   Error: ${log.error_message}`);
        if (log.line_number) {
            console.log(`   Location: Line ${log.line_number}${log.column_number ? `:${log.column_number}` : ''}`);
        }
        console.log();
    });
}

function showParseErrors(logger: IngestionLogger) {
    const latestSession = logger.getLatestSession();

    if (!latestSession) {
        console.log('No ingestion sessions found in database.');
        return;
    }

    const errors = logger.getParseErrors(latestSession);

    console.log(`\n🔍 Parse Errors (${errors.length} total)\n`);

    errors.forEach((log: any, i: number) => {
        console.log(`${i + 1}. ${log.relative_path}`);
        if (log.line_number) {
            console.log(`   Location: Line ${log.line_number}${log.column_number ? `:${log.column_number}` : ''}`);
        }
        if (log.error_details) {
            console.log(`   Details: ${log.error_details.substring(0, 200)}`);
        }
        console.log();
    });
}

function listSessions(logger: IngestionLogger) {
    // This would require querying for all sessions
    console.log('📋 Sessions feature - to be implemented');
    console.log(`Latest session: ${logger.getLatestSession()}`);
}

main();
