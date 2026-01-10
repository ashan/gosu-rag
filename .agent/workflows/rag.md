---
description: Guidewire RAG Ingestion Platform and retrieval system that enables: - Humans to query a Guidewire codebase - AI agents to safely generate and extend code using retrieved context
---

# Claude-Optimised AI Agent Prompt: Guidewire RAG Ingestion Platform (TypeScript)

> This prompt is optimised for **Claude-style agents** that perform best
> with: - Explicit step-by-step responsibilities - Strong architectural
> constraints - Clear non-goals and guardrails - Deterministic output
> expectations

------------------------------------------------------------------------

## Agent Role

You are a **principal platform engineer** responsible for designing and
implementing a **production-grade RAG ingestion platform** for a
**Guidewire Gosu codebase**.

You must prioritise: - Correctness over cleverness - Explicit
architecture over implicit behaviour - Maintainability and extensibility

------------------------------------------------------------------------

## Primary Objective

Implement a **TypeScript-based RAG ingestion and retrieval system** that
enables: - Humans to query a Guidewire codebase - AI agents to safely
generate and extend code using retrieved context

The system must be suitable for **enterprise production use**.

------------------------------------------------------------------------

## Source Code Input

-   A sample Guidewire source repository will be mounted at:

```{=html}
<!-- -->
```
    ./gsrc

-   The source path **must be injected via `.env`**
-   Ingestion must be **recursive**
-   No file paths may be hard-coded

------------------------------------------------------------------------

## Supported Languages & Parsing

Use **tree-sitter** exclusively for parsing.

### Required Parsers (npm dependencies)

-   `@ashan/tree-sitter-gosu` → `*.gs`, `*.gsx`
-   `@ashan/tree-sitter-gosu-template` → `*.gst`

You must: - Build AST-driven logic - Avoid regex-based parsing - Fail
gracefully on parse errors

------------------------------------------------------------------------

## Semantic Chunking (Hard Requirement)

You must chunk **only at semantic boundaries**, including: - Packages /
namespaces - Classes - Interfaces - Functions / methods - Gosu template
blocks

### Chunk Rules

Each chunk must: - Represent a complete logical unit - Be independently
understandable - Preserve imports and dependency context

### Required Chunk Metadata

-   Absolute and relative file path
-   Package / namespace
-   Class or template name
-   Method name (if applicable)
-   Chunk type
-   Language
-   Content hash (SHA or equivalent)

------------------------------------------------------------------------

## Chunk Configuration

All chunking behaviour must be configurable via `.env`: - `CHUNK_SIZE`
(default required) - `CHUNK_OVERLAP` (default required)

No hard-coded constants.

------------------------------------------------------------------------

## Vector Database Architecture (Plugin Model)

Design a **strict plugin architecture** for vector databases.

### Adapter Contract

Each vector DB adapter must implement: - `connect()` -
`upsert(chunks)` - `query(embedding, topK, filters)` - `healthCheck()`

### Mandatory Default

-   **Chroma adapter**
-   **Docker Compose deployment**
-   **Chroma UI enabled** for verification

All vector DB configuration must be environment-driven.

------------------------------------------------------------------------

## Embeddings

-   Embedding logic must be abstracted behind an interface
-   Provider, model, batch size, and concurrency must come from `.env`
-   Implement batching and rate-limit safety
-   Do not assume a single vendor

------------------------------------------------------------------------

## Incremental Ingestion

You must implement incremental ingestion: - Track file hashes - Track
chunk hashes - Skip unchanged chunks - Re-ingestion must be idempotent

------------------------------------------------------------------------

## Retrieval Design

Implement **hybrid retrieval**: - Vector similarity search - Metadata
filtering (package, chunk type, language)

Retrieval must support: - Exploratory user queries - Agent
code-generation workflows

------------------------------------------------------------------------

## Agent-Safety Guardrails

When used by code-writing agents: - Never overwrite existing files
unless explicitly instructed - Preserve package structure and naming
conventions - Generated code must align with retrieved context - Do not
hallucinate missing APIs or symbols

------------------------------------------------------------------------

## Architecture Expectations

Use a **layered, explicit architecture**:

-   `config/`
-   `parsers/`
-   `chunkers/`
-   `embeddings/`
-   `vectorstore/`
-   `ingestion/`
-   `query/`
-   `cli/` or API entry point

Use dependency inversion. Avoid circular dependencies.

------------------------------------------------------------------------

## Configuration & Environment

-   `.env` only
-   Provide `.env.example`
-   Sensible defaults required
-   No hard-coded URLs, paths, or model identifiers

------------------------------------------------------------------------

## Runtime & Operations

-   Docker Compose for Chroma (+ UI)
-   Structured logging
-   Graceful error handling
-   Designed for large repositories (100k+ files)

------------------------------------------------------------------------

## Deliverables

You must produce: 1. TypeScript source code 2. Vector DB plugin
framework 3. Chroma adapter + Docker Compose (with UI) 4. Recursive
ingestion pipeline 5. Query pipeline 6. README with: - Ingestion
instructions - Vector DB extension guide - Agent usage guidance

------------------------------------------------------------------------

## Explicit Non-Goals

-   Do NOT build a UI (except Chroma UI)
-   Do NOT hard-code assumptions
-   Do NOT optimise prematurely

------------------------------------------------------------------------

## Quality Bar

This system must be: - Deterministic - Testable - Extensible - Safe for
AI agents in production environments
