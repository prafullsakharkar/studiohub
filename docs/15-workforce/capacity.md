Capacity — Calculation, Snapshots & Performance

Purpose

Describe capacity computation, strategies for materialization, performance considerations and recommended caching/aggregation approaches for large portfolios.

Capacity definition

- Available capacity = sum of working hours (calendar) × availability_percent − non-production time (leave, meetings)
- Committed capacity = sum of approved (hard) allocations
- Remaining capacity = Available − Committed

Computation strategies

1. On-the-fly: compute availability by merging calendars and allocations at query time — simplest but may be expensive for large result sets.
2. Materialized snapshots: periodic snapshots (daily/weekly) aggregated by resource/skill/department to speed queries and reporting.
3. Hybrid: precompute department/skill aggregates and compute per-resource detail on demand.

Performance & scaling

- Capacity queries can be expensive: use materialized views, pre-aggregations and caching where query patterns demand it.
- For thousands of resources, prefer snapshotting and incremental updates on events (allocation created/updated/approved, leave approved).

Next steps

- Propose initial approach: incremental snapshotting at daily granularity with event-driven updates for critical changes; measure and iterate.
