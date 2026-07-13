# ADR-0012: File & Asset Storage Strategy

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision Makers:** Architecture Team
- **Supersedes:** None
- **Superseded By:** None

---

# Context

StudioHub is designed for VFX, animation, game development, virtual production, and digital content pipelines where digital assets are a primary business resource.

The platform must manage a wide variety of files, including:

- Concept art
- Reference images
- Models
- Textures
- Rigs
- Animation caches
- Simulation files
- Audio
- Video
- Review media
- Documents
- Deliverables

These files can range from a few kilobytes to multiple gigabytes and require secure, scalable, and versioned storage.

The storage strategy must separate binary file management from application metadata while supporting enterprise scalability.

---

# Decision

StudioHub separates **asset metadata** from **binary file storage**.

- **PostgreSQL** stores structured asset metadata.
- **Object storage** stores binary file content.
- **Django ORM** manages asset records.
- **Storage adapters** abstract the underlying storage provider.

This approach enables flexible deployment across local development, on-premises infrastructure, and cloud environments.

---

# Storage Architecture

```text
Application

↓

Asset Service

↓

Asset Model

↓

PostgreSQL
(metadata)

↓

Storage Adapter

↓

Object Storage
(binary files)
```

Application code interacts with storage through a unified abstraction rather than directly accessing storage providers.

---

# Metadata

PostgreSQL stores information such as:

- Asset identifier
- Organization
- Project
- Asset type
- Version
- Status
- Tags
- Relationships
- Ownership
- Audit fields
- Storage location
- Checksums
- File size
- MIME type

Metadata enables searching, reporting, authorization, and lifecycle management.

---

# Binary Storage

Binary content is stored externally.

Supported storage providers may include:

- Local filesystem (development)
- Amazon S3
- Azure Blob Storage
- Google Cloud Storage
- MinIO
- Enterprise NAS
- Studio file servers

Storage providers are interchangeable through the storage abstraction layer.

---

# Asset Versioning

Assets are versioned rather than overwritten.

Typical workflow:

```text
Asset

↓

Version 1

↓

Version 2

↓

Version 3
```

Every version maintains:

- Creation timestamp
- Author
- Status
- Storage location
- Metadata
- Relationships

Previous versions remain available for audit and rollback purposes.

---

# Naming Strategy

Storage object names should be deterministic and collision-resistant.

Recommended structure:

```text
organization/
project/
asset/
version/
filename
```

Object names should avoid exposing sensitive information where possible.

---

# Lifecycle

Typical asset lifecycle:

```text
Upload

↓

Validation

↓

Storage

↓

Metadata Registration

↓

Processing

↓

Review

↓

Approval

↓

Archive
```

Business workflows operate on metadata while binary content remains in object storage.

---

# Upload Processing

Upload workflow:

```text
Client

↓

API

↓

Temporary Storage

↓

Validation

↓

Virus Scan (optional)

↓

Object Storage

↓

Metadata Creation

↓

Background Processing
```

Large uploads should support resumable transfer where appropriate.

---

# Background Processing

Background workers may perform:

- Thumbnail generation
- Proxy generation
- Metadata extraction
- Checksum calculation
- Media transcoding
- OCR
- AI tagging
- Preview generation

Long-running media processing should be asynchronous.

---

# Security

Storage security includes:

- Access control
- Signed URLs
- Encryption at rest
- Encryption in transit
- Virus scanning
- Checksum verification
- Audit logging

Binary objects should not be publicly accessible by default.

---

# Authorization

Access to files requires:

- Authentication
- Organization membership
- Object-level authorization
- Business validation

Storage permissions must remain consistent with application permissions.

---

# Scalability

The architecture supports:

- Multi-terabyte asset libraries
- Distributed object storage
- CDN integration
- Lifecycle policies
- Archival storage
- Horizontal scaling

Metadata and binary storage can scale independently.

---

# Backup Strategy

Metadata:

- PostgreSQL backups
- Point-in-time recovery

Binary assets:

- Object storage replication
- Versioning
- Lifecycle management
- Cross-region backups

Both metadata and binaries are required for complete disaster recovery.

---

# Alternatives Considered

## Database BLOB Storage

Advantages:

- Single storage system
- Simpler backups

Disadvantages:

- Database growth
- Poor scalability
- Reduced performance
- Expensive storage

Rejected.

---

## Local Filesystem Only

Advantages:

- Simple implementation

Disadvantages:

- Poor scalability
- Limited redundancy
- Difficult cloud deployment

Rejected for production use.

---

## Shared Network Drives

Advantages:

- Familiar studio workflow

Disadvantages:

- Limited cloud portability
- Scalability constraints
- Operational complexity

Supported only through storage adapters where required.

---

# Consequences

## Positive

- Independent scaling
- Efficient metadata queries
- Flexible storage providers
- Enterprise-ready architecture
- Improved disaster recovery
- Better performance

## Negative

- Additional infrastructure
- Metadata and binary consistency management
- Storage adapter maintenance

The architectural flexibility outweighs the added complexity.

---

# Implementation Guidelines

- Store metadata in PostgreSQL.
- Store binary content in object storage.
- Never overwrite asset versions.
- Use storage adapters for provider abstraction.
- Generate previews asynchronously.
- Validate uploads before persistence.
- Protect storage with signed access mechanisms.

---

# Compliance

Architecture reviews should verify:

- Metadata and binaries remain separated.
- Asset versions are immutable.
- Storage providers are abstracted.
- Authorization is consistently enforced.
- Upload workflows include validation.
- Backup and recovery procedures cover both metadata and binary content.

---

# Related ADRs

- ADR-0002 — Layered Architecture
- ADR-0004 — Domain-Driven Design
- ADR-0006 — PostgreSQL as the Primary Database
- ADR-0007 — Background Processing with Celery & Redis
- ADR-0010 — Multi-Tenant Organization Model
- ADR-0011 — Audit Logging Strategy

---

# References

- `docs/03-backend/assets.md`
- `docs/06-infrastructure/object-storage.md`
- `docs/07-deployment/storage-configuration.md`
- `docs/10-security/file-security.md`
- `docs/13-roadmap/infrastructure-roadmap.md`