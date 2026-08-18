# Pipeline SDK — Conceptual API for DCCs and CLI

Generated: 2026-08-18T12:34:06+05:30

Purpose
-------
Describe the conceptual PipelineSDK used by DCC plugins and CLI tooling. This is a design document — do not implement code from it without API stabilization and authentication design.

Goals
-----
- Provide a minimal, stable surface for common pipeline tasks: context resolution, publish, validate, path resolution, media upload, and job status.
- Make SDK calls idempotent and safe for retries.
- Offer a consistent authentication model (short-lived tokens, service accounts).

Example conceptual API
----------------------
- context = SDK.resolve_context(token_or_flags)
- SDK.create_workspace(context, options)
- scene_meta = SDK.collect_scene_metadata(context)
- publish = SDK.publish_version(context, source_files, metadata)
- SDK.validate_publish(publish_id)
- SDK.upload_media(media_path, callbacks)
- SDK.get_job_status(job_id)

Transport
---------
- SDK uses REST over HTTPS. Consider gRPC for high-throughput internal integrations later.

Versioning & compatibility
-------------------------
- The SDK must be versioned and compatible with the server API versions. Provide clear compatibility matrix and deprecation policy.

End of SDK conceptual doc.
