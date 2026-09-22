# Phase B4: Memory

Implement the semantic memory service (Django + pgvector) for storing, retrieving, and searching agent experiences across sessions.

## Purpose

Agents learn from past work. This service provides vector embeddings of task outcomes, allowing future agents to retrieve similar past decisions, successful patterns, and failure cases. Uses pgvector's cosine similarity search on a 384-dimensional embedding space (matching OpenAI text-embedding-3-small output dimensions).

## Timing

Runs after B3 (orchestrator) confirms task routing works. Must be ready before B5 (agent runtime) starts producing retrievable learning data.

## Inputs

- `shared/event_bus.py` and `shared/logging.py` from B1
- PostgreSQL container with pgvector extension from B2
- Celery beat schedule from B3 confirming task completion events flow through the bus

## Outputs

- Django models: LearningEntry(id, task_id, outcome_text, embedding_vector, metadata_json, created_at, is_superseded)
- Supervised entry lifecycle: store → query → supersede
- Pgvector cosine similarity search endpoint at `/api/v1/memories/search/` accepting `{query, top_k, threshold}` returning ranked results
- Idempotent upsert: writing an entry with same `(task_id, embedding_hash)` updates rather than duplicates

## Steps

1. Create Django model `LearningEntry` with fields: id (UUID), task_id (FK to TaskRecord), outcome_text (TextField, max 5000 chars), embedding_vector (pgvector VectorField dimension=384), metadata_json (JSONField for tags, source_role, quality_score), created_at (DateTimeField auto_now_add), is_superseded (BooleanField default False).
2. Implement `embed(text)` function using shared/llm_client.py to call the text embedding endpoint, returning a normalized float array of length 384.
3. On task completion, consume the TaskResult event, compute embedding of the `outcome_text` field, and store a new LearningEntry row. Set `is_superseded=False`.
4. Implement supersede logic: when a new entry has `(task_id, embedding_hash)` where `embedding_hash = sha256(outcome_text[:200])`, mark all existing non-superseded entries with the same hash as `is_superseded=True` (with superseded_by reference set to the new entry ID).
5. Build REST endpoint `/api/v1/memories/search/` accepting POST with body `{query: string, top_k: int(default 5), threshold: float(default 0.7)}`. Compute query embedding, run pgvector cosine similarity search ordered by 1 - cosine_distance(limit=top_k), filter by similarity >= threshold, return list of entries sorted by descending similarity with score included.
6. Implement deduplication: before inserting a new entry, check if a non-superseded entry with identical embedding already exists (cosine distance < 0.001), and if so, update the existing entry's created_at and metadata instead of creating a duplicate.
7. Run syntax check: `python -m py_compile` on all models and views.
8. Publish `MEMORY_READY` event.

## Checklist

- [ ] LearningEntry model defined with all seven fields listed above
- [ ] LearningEntry.outcome_text validated max 5000 characters
- [ ] LearningEntry.metadata_json accepts arbitrary JSON with type hints in serializer
- [ ] LearningEntry.is_superseded defaults to False; supersedable via supersede method
- [ ] embed() function calls shared/llm_client.py and returns length-384 normalized vector
- [ ] Embedding normalization divides by L2 norm; zero vector logged as warning and skipped
- [ ] Post-completion consumer subscribes to TaskResult events and stores LearningEntries automatically
- [ ] Supersede logic uses sha256(outcome_text[:200]) as the identity hash
- [ ] Superseded entries remain queryable when include_expired=true parameter passed
- [ ] Search endpoint at /api/v1/memories/search/ handles POST with query, top_k, threshold
- [ ] Search uses pgvector <-> operator for exact cosine distance computation
- [ ] Search filters results by minimum similarity threshold (default 0.7)
- [ ] Search returns {id, outcome_text, metadata, score} objects ordered by descending score
- [ ] Deduplication checks cosine distance < 0.001 against existing non-superseded entries
- [ ] Dedup updates existing entry's metadata_json with merged tags instead of duplicating
- [ ] All Python files pass py_compile validation
- [ ] MEMORY_READY event published to event bus

## Rollback

If pgvector extension fails to load during database migration, verify the extension was installed (`CREATE EXTENSION IF NOT EXISTS "pgvector";`) in the postgres service Dockerfile or init script. If still failing, halt B4 and alert operator — vector search cannot function without pgvector. Delete any partial migrations created during this phase. Do not proceed to B5 until the search endpoint returns valid results for a test query.
