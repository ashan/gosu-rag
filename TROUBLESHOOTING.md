# Guidewire RAG Platform - Troubleshooting Guide

## Issue: Files Being Skipped During Ingestion

**Symptom:** `npm run view-logs summary` shows most files as "skipped"

**Cause:** The hash tracker (`.rag-cache.json`) stores file hashes and modification times. Files are skipped if they haven't changed since last ingestion.

**Solution:**
```bash
# Delete the hash cache for a fresh ingestion
rm .rag-cache.json

# Then run ingestion
npm run ingest
```

---

## Issue: ChromaDB Data Directory Empty

**Symptom:** `./chroma_data/` directory exists but is empty

**Cause:** ChromaDB uses `/data` as persist directory by default, not `/chroma/chroma`

**Solution:** Fixed in docker-compose.yml to mount `./chroma_data:/data`

```bash
# Restart ChromaDB with corrected mount
docker compose down
docker compose up -d

# Verify mount
docker exec gosu-chroma-db ls -la /data
```

---

## Issue: View Logs Shows Wrong Session

**Symptom:** `npm run view-logs summary` shows 0 files

**Cause:** Script was creating new session instead of querying latest

**Solution:** Fixed - now queries latest session from database

---

## Complete Fresh Start

If you want to completely reset everything:

```bash
# 1. Stop and remove ChromaDB
docker compose down
docker volume prune -f

# 2. Delete local data
rm -rf chroma_data/
rm .rag-cache.json
rm ingestion.db
rm ingestion-report-*.json

# 3. Restart ChromaDB
docker compose up -d

# 4. Run fresh ingestion
npm run ingest
```

---

## Verifying Setup

After ingestion, verify everything is working:

```bash
# Check ChromaDB has data
npm run inspect-chroma
# Should show document count

# Check logs
npm run view-logs summary
# Should show processed/skipped/error counts

# Check data is persisted
ls -lh chroma_data/
# Should show SQLite files

# Query test
npm run query -- "test query"
```
