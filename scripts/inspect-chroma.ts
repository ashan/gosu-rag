import { ChromaClient } from 'chromadb';

async function inspectChroma() {
    console.log('🔍 Inspecting ChromaDB...\n');

    const client = new ChromaClient({
        path: 'http://localhost:8000',
    });

    try {
        // Test connection
        await client.heartbeat();
        console.log('✅ ChromaDB is running\n');

        // List all collections
        const collections = await client.listCollections();
        console.log(`📚 Collections (${collections.length}):`);

        if (collections.length === 0) {
            console.log('  (no collections yet)\n');
        } else {
            for (const collection of collections) {
                console.log(`\n  📁 ${collection.name}`);
                if (collection.metadata) {
                    console.log(`     Metadata:`, JSON.stringify(collection.metadata, null, 2).split('\n').join('\n     '));
                }

                // Get collection details
                const coll = await client.getCollection({ name: collection.name });
                const count = await coll.count();
                console.log(`     Documents: ${count}`);

                // Peek at first few items if any exist
                if (count > 0) {
                    const peek = await coll.peek({ limit: 3 });
                    console.log(`\n     Sample IDs:`, peek.ids.slice(0, 3));
                    if (peek.metadatas && peek.metadatas.length > 0) {
                        console.log(`     Sample metadata:`, JSON.stringify(peek.metadatas[0], null, 2).split('\n').join('\n     '));
                    }
                }
            }
        }

        console.log('\n✅ Inspection complete');
    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

inspectChroma();
