Semantic Search & Embeddings — Model Versioning, Storage & Retrieval

Goals

- Provide a safe, auditable semantic retrieval pipeline for RAG and knowledge workflows.
- Keep embeddings and semantic indexes as derived, versioned projections with clear provenance.

Embeddings lifecycle

- Extraction: extract textual content from notes, descriptions, transcripts, OCR of attachments, metadata fields marked for semantic indexing.
- Normalization: clean, truncate, and canonicalize text; record content_hash and extractor_version.
- Embedding: generate embedding using a chosen model; record model_id, model_version, parameters, and call metadata.
- Store: persist embedding with metadata: entity_id, entity_type, content_hash, model_id, model_version, created_at, source_field, offset, chunk_index.

Model & embedding versioning

- Always store model_id and model_version per embedding.
- Maintain an embeddings_catalog recording model metadata, tokenization, normative dimension, cost estimates, and known behaviors (e.g., truncation limits).
- Tag embeddings with embeddings_version for index schema migrations.

Vector store choices

- Evaluate pgvector first for self-hosted setups; consider external vector DBs (Qdrant/Pinecone) only when scale or features demand.
- Keep vector store ephemeral: embeddings can be recomputed — do not store unrecoverable state without source content and model metadata.

Hybrid retrieval

- Retrieve candidates via structured and full-text search, then re-rank via vector similarity on candidates (hybrid retrieval).
- For RAG, use strict permission filters before returning text snippets; never surface content user is unauthorized to view.

Privacy & provenance

- Record source provenance for every returned snippet.
- Include content citations (entity id, field, chunk index) in RAG responses.

Backfill & reindex

- When changing embedding models, provide backfill jobs and keep previous embeddings until migration completes and validation passes.

Operational concerns

- Monitor cost for embedding generation and storage.
- Rate-limit embeddings creation in bulk imports and provide batch job controls.

