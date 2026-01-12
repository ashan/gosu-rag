import { ChromaClient } from 'chromadb';

async function main() {
    const client = new ChromaClient({ path: 'http://localhost:8000' });
    const collection = await client.getCollection({ name: 'guidewire-code' });

    // Get first 3 items with metadata
    const results = await collection.get({ limit: 3 });

    console.log('Sample chunks from ChromaDB:\n');
    for (let i = 0; i < Math.min(3, results.ids.length); i++) {
        console.log(`\nChunk ${i + 1}:`);
        console.log(`  chunkType:`, results.metadatas?.[i]?.chunkType);
        console.log(`  className:`, results.metadatas?.[i]?.className);
        console.log(`  relativePath:`, results.metadatas?.[i]?.relativePath);
        console.log(`  Document:`, results.documents?.[i]?.substring(0, 60));
    }

    // Try a filtered query
    console.log('\n\n=== Testing filtered query ===');
    const filtered = await collection.query({
        queryTexts: ["uses"],
        nResults: 2,
        where: { chunkType: "file" }
    });
    console.log('Results with chunkType=file filter:', filtered.ids?.[0]?.length || 0);
}

main().catch(console.error);
