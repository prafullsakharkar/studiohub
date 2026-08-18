Indexing Operations — Runbooks, Retries, Reindexing & Monitoring

Runbook: Indexing failure

- Detect failure: indexing job emits failure to monitoring and records in indexing_status table with last_error, attempt_count
- Retry strategy: exponential backoff with jitter; configurable max_attempts
- On repeated failure: move to DLQ, alert SRE/owner, and provide manual retry tooling

Runbook: DLQ handling

- Inspect messages in DLQ UI: show event payload, stack trace, attempt history, entity snapshot
- Provide "retry" which requeues with updated attempt_count or "dead" which archives and notifies owners

Reindexing procedure

1. Create new index name with version suffix
2. Run backfill job (entity/project/organization scope)
3. Validate counts and sample documents
4. Switch alias to new index
5. Monitor anomalies, keep old index for rollback window, then delete

Monitoring

- Track indexing lag (event_time -> indexed_time), success_rate, failure_rate, DLQ_size
- Alerts on: sustained lag above threshold, DLQ growth, reindex job failures

Safety

- Reindex must never modify source data
- Reindex jobs should be idempotent and resume from checkpoints

