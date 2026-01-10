# Guidewire RAG Ingestion Platform

Production-grade RAG (Retrieval-Augmented Generation) system for Guidewire Gosu codebases. Enables natural language queries over your codebase and provides context for AI code generation.

## Features

- 🌳 **Tree-sitter parsing** for Gosu (`.gs`, `.gsx`) and Gosu Templates (`.gst`)
- 🧩 **Semantic chunking** at package, class, method, and template levels
- 🔍 **Hybrid retrieval** with vector similarity + metadata filtering
- 📦 **ChromaDB vector store** with Docker Compose deployment
- 🔄 **Incremental ingestion** with content-hash change detection
- 🤖 **AI-agent ready** with structured context formatting

## Quick Start

### Prerequisites

- Node.js v20+ or v22 (LTS)
- Docker & Docker Compose
- OpenAI API key

### Installation

```bash
git clone <your-repo-url>
cd gosu-chroma-rag
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Configure your `.env`:
```env
# Required
SOURCE_PATH=./gsrc
OPENAI_API_KEY=your-openai-api-key-here

# Optional (defaults provided)
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
EMBEDDING_MODEL=text-embedding-3-small
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

### Start ChromaDB

```bash
docker compose up -d
```

Verify it's running:
```bash
npm run inspect-chroma
```

### Ingest Your Codebase

```bash
npm run ingest
```

This will:
- Discover all `.gs`, `.gsx`, and `.gst` files
- Parse into ASTs
- Extract semantic chunks
- Generate embeddings
- Store in ChromaDB

**Incremental updates:** Re-run `npm run ingest` anytime - only changed files will be re-processed.

### Query the Knowledge Base

```bash
npm run query -- "How do I create a new claim?"
```

## Architecture

```
src/
├── config/          # Environment configuration (Zod validation)
├── parsers/         # Tree-sitter integration (Gosu, Templates)
├── chunkers/        # Semantic AST-based chunking
├── embeddings/      # OpenAI embedding provider
├── vectorstore/     # ChromaDB adapter
├── ingestion/       # Pipeline orchestration & hash tracking
├── query/           # Retrieval & result formatting
└── cli/             # Command-line interface
```

## Usage

### Programmatic API

```typescript
import {
  ChromaAdapter,
  OpenAIEmbeddingProvider,
  IngestionPipeline,
  QueryService,
} from './src';

// Initialize
const embeddings = new OpenAIEmbeddingProvider();
const vectorStore = new ChromaAdapter();
await vectorStore.connect();

// Ingest
const pipeline = new IngestionPipeline(embeddings, vectorStore);
await pipeline.ingest('./your/gosu/code');

// Query
const queryService = new QueryService(embeddings, vectorStore);
const results = await queryService.query('error handling patterns', {
  topK: 5,
  package: 'com.example',
  language: 'gosu',
});

console.log(queryService.formatForHuman(results));
```

### Filtering Results

```typescript
const results = await queryService.query('database queries', {
  topK: 10,
  package: 'com.guidewire.pl',     // Filter by package
  className: 'ClaimEntity',        // Filter by class
  chunkType: 'method',             // Filter by chunk type
  language: 'gosu',                // Filter by language
  minScore: 0.7,                   // Minimum similarity (0-1)
});
```

## Chunk Types

- `package` - Package declarations
- `class` - Class definitions
- `interface` - Interface definitions
- `enum` - Enum definitions
- `function` - Top-level functions
- `method` - Class methods
- `property` - Properties
- `template_directive` - Template directives (`<%@ %>`)
- `template_block` - Template scriptlets/expressions

## Extending the System

### Adding a New Vector Store

1. Implement `IVectorStore` interface:
```typescript
export class MyVectorStore implements IVectorStore {
  async connect() { /* ... */ }
  async upsert(chunks, embeddings) { /* ... */ }
  async query(embedding, topK, filters) { /* ... */ }
  async healthCheck() { /* ... */ }
  getCollectionName() { /* ... */ }
}
```

2. Use in pipeline:
```typescript
const vectorStore = new MyVectorStore();
const pipeline = new IngestionPipeline(embeddings, vectorStore);
```

### Adding a New Embedding Provider

1. Implement `IEmbeddingProvider`:
```typescript
export class MyEmbeddings implements IEmbeddingProvider {
  async embed(texts: string[]) { /* ... */ }
  getDimension() { /* ... */ }
  getProviderName() { /* ... */ }
  getModelName() { /* ... */ }
}
```

## Troubleshooting

### ChromaDB not accessible
```bash
# Check if running
docker ps | grep chroma

# Restart
docker compose down
docker compose up -d
```

### Parser errors
The system logs parse errors but continues processing. Check:
- File encoding (should be UTF-8)
- Syntax errors in source files

### Out of memory during ingestion
Adjust batch size in `.env`:
```env
EMBEDDING_BATCH_SIZE=50  # Reduce from default 100
```

## Development

```bash
# Build
npm run build

# Inspect ChromaDB
npm run inspect-chroma

# View logs
docker compose logs -f chroma
```

## License

MIT
