import { IngestionLogger } from '../src/ingestion';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
    const logger = new IngestionLogger();
    const latestSession = logger.getLatestSession();

    if (!latestSession) {
        console.log('❌ No ingestion sessions found in database.');
        logger.close();
        return;
    }

    console.log(`📋 Extracting parse errors from session: ${latestSession}\n`);

    // Get files with parse errors
    const parseErrors = logger.getParseErrors(latestSession);

    if (parseErrors.length === 0) {
        console.log('✅ No parse errors found!');
        logger.close();
        return;
    }

    console.log(`Found ${parseErrors.length} files with parse errors\n`);

    // Create output directory
    const outputDir = './parse-errors-test';
    await fs.mkdir(outputDir, { recursive: true });

    let copied = 0;
    let failed = 0;

    for (const error of parseErrors) {
        try {
            const sourcePath = (error as any).file_path;
            const relativePath = (error as any).relative_path;

            // Create destination path preserving structure
            const destPath = path.join(outputDir, relativePath);
            const destDir = path.dirname(destPath);

            // Ensure directory exists
            await fs.mkdir(destDir, { recursive: true });

            // Copy file
            await fs.copyFile(sourcePath, destPath);
            console.log(`✅ Copied: ${relativePath}`);
            copied++;
        } catch (err) {
            console.error(`❌ Failed to copy ${(error as any).relative_path}: ${err}`);
            failed++;
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Copied: ${copied} files`);
    console.log(`   Failed: ${failed} files`);
    console.log(`   Output: ${outputDir}/`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Update SOURCE_PATH in .env to: ./parse-errors-test`);
    console.log(`   2. Run: npm run clean-ingest`);
    console.log(`   3. Review errors: npm run view-logs parse-errors`);

    logger.close();
}

main();
