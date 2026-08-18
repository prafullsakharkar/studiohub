# Storage — Overview

Generated: 2026-08-18T12:34:08+05:30

Purpose
-------
Defines the storage abstraction strategy for StudioHub pipeline: logical storage locations, adapter interfaces, and transfer patterns suitable for enterprise VFX workloads.

Principles
----------
- The domain must not depend on concrete storage clients (boto3, MinIO libs, etc.).
- Implement a StorageAdapter interface with implementations for local FS, NFS/SMB, S3, MinIO, and cloud blob stores.
- Support multi-backend mapping per logical location (working, publish, review, archive).

Storage locations and lifecycles
--------------------------------
- Logical locations: working, publish, review, cache, archive, delivery
- Each project maps logical locations to one or more physical backends
- Support replicated/backfilled locations for multi-facility workflows

Transfer considerations
-----------------------
- Use resumable uploads, multipart, or parallel transfers for large files
- Validate checksums after transfer and record them in metadata
- Implement TransferJob abstraction to track progress, retries, and errors

Security
--------
- Never store credentials in scene files or plugin code. Use short-lived signed URLs or service tokens.

Reconciliation
--------------
- Provide reconcile jobs to detect missing publishes/files and to repair or flag inconsistencies.

End of storage overview.
