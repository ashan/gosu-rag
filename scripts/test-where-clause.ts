import { ChromaClient } from 'chromadb';
import { OpenAIEmbeddingProvider } from '../src/embeddings';

async function main() {
    const client = new ChromaClient({ path: 'http://localhost:8000' });
    const collection = await client.getCollection({ name: 'guidewire-code' });

    const embedder = new OpenAIEmbeddingProvider();
    const [embedding] = await embedder.embed(["uses"]);

    console.log('Test 1: Query without where clause');
    const noWhere = await collection.query({
        queryEmbeddings: [embedding],
        nResults: 2,
    });
    console.log(`Results: ${noWhere.ids?.[0]?.length || 0}`);
    if (noWhere.metadatas?.[0]?.[0]) {
        console.log(`First result chunkType:`, noWhere.metadatas[0][0].chunkType);
    }

    console.log('\nTest 2: Query WITH where clause { chunkType: "file" }');
    const withWhere = await collection.query({
        queryEmbeddings: [embedding],
        nResults: 2,
        where: { chunkType: "file" }
    });
    console.log(`Results: ${withWhere.ids?.[0]?.length || 0}`);

    console.log('\nTest 3: Try with exact equality operator');
    const withOperator = await collection.query({
        queryEmbeddings: [embedding],
        nResults: 2,
        where: { chunkType: { "$eq": "file" } }
    });
    console.log(`Results: ${withOperator.ids?.[0]?.length || 0}`);
}

main().catch(console.error);
