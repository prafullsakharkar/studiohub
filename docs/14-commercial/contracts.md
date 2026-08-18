Contracts — Structure, lifecycle, and governance

Purpose

Document the schema, lifecycle, versioning, amendments, attachments, and security for Contracts (MSA, SOWs, Vendor agreements).

Contract lifecycle

- Draft -> Negotiation -> Pending Approval -> Active -> Suspended -> Expired -> Terminated

Versioning

- Each contract has an integer version and a pointer to previous_version. When terms change, create a new version rather than mutate an approved version.
- Amendments are separate records linked to the original contract and carry their own versioning.

Attachments & signed documents

- Store attachments using the canonical storage architecture (docs/07-pipeline/storage.md). Attachments are references (storage path, checksum, uploader, timestamp).

Immutability & corrections

- Once a contract is approved and signed, do not silently change terms. Use amendments or versioned records. Maintain a commercial_audit trail.

Security

- Contracts contain sensitive information and should be accessible only to authorized finance, legal, and production personnel.

Next steps

- Create UI flows for contract version diff, amendment creation, and signature attachments.
- Draft ADR for contract immutability and authoritative recording.