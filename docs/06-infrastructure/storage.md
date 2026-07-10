# Storage

## Overview

StudioHub manages several types of data storage to support application execution, persistent business data, uploaded media, static assets, logs, backups, and future production pipeline assets.

The storage architecture is designed to separate persistent data from application containers, enabling scalability, disaster recovery, and cloud-native deployments.

---

# Objectives

The storage architecture provides:

- Persistent Storage
- High Availability
- Backup Support
- Scalable Media Storage
- Fast Static Asset Delivery
- Secure File Management
- Disaster Recovery
- Cloud Compatibility

---

# Storage Architecture

```text
                    StudioHub

                         │

      ┌──────────────────┼──────────────────┐

      ▼                  ▼                  ▼

 PostgreSQL         Media Storage      Static Storage

      │                  │                  │

      ▼                  ▼                  ▼

 Database          Uploaded Files      Collected Assets

                         │

                         ▼

                  Future Object Storage

                  (S3 / MinIO / Azure)
```

---

# Storage Categories

StudioHub uses multiple storage types.

```text
Database

Static Files

Media Files

Application Logs

Backups

Temporary Files

Cache

Exports

Imports
```

Each storage type has different lifecycle and backup requirements.

---

# Database Storage

Stores:

- Organizations
- Users
- Projects
- Tasks
- Reviews
- Assets
- Settings

Database storage is managed by PostgreSQL.

---

# Static Files

Static files include:

```text
CSS

JavaScript

Fonts

Icons

Images

Compiled Assets
```

Static files are generated during deployment.

Example

```text
/static/
```

---

# Media Files

Media files include:

```text
Profile Images

Organization Logos

Attachments

Review Videos

Project Documents

Reference Images

Production Assets
```

Example

```text
/media/
```

Media files should never be stored inside application containers.

---

# Temporary Storage

Temporary storage may include:

- Upload Chunks
- Export Files
- Generated Reports
- Processing Files
- AI Intermediate Files

Temporary data should have automatic cleanup.

---

# Log Storage

Application logs

```text
Application

Nginx

Celery

Redis

Database
```

Logs should be rotated automatically.

---

# Backup Storage

Backups include:

- PostgreSQL
- Media Files
- Static Files
- Configuration
- Reports

Backups should be encrypted before storage.

---

# Persistent Volumes

Docker volumes should be created for:

```text
postgres_data

media

static

logs

backups
```

Application containers should remain stateless.

---

# Directory Structure

Example

```text
storage/

├── media/
├── static/
├── backups/
├── exports/
├── imports/
├── logs/
└── temp/
```

---

# Media Organization

Recommended structure

```text
media/

users/

organizations/

projects/

shots/

assets/

reviews/

attachments/
```

Files should be grouped by business domain.

---

# Asset Storage

Production assets may include:

```text
Textures

Models

Scenes

Renders

HDRIs

Audio

Video

Caches
```

Future deployments should support object storage.

---

# Object Storage

Future supported providers

- Amazon S3
- MinIO
- Azure Blob Storage
- Google Cloud Storage

Benefits

- Unlimited Scalability
- High Availability
- Versioning
- Lifecycle Policies

---

# File Naming

Recommended strategy

```text
UUID

↓

Extension

↓

Directory
```

Example

```text
550e8400-e29b-41d4-a716-446655440000.mov
```

Avoid storing user-supplied filenames directly.

---

# File Validation

Every upload should validate:

- File Type
- MIME Type
- File Size
- Extension
- Virus Scan (Future)

Invalid uploads should be rejected before storage.

---

# Storage Lifecycle

```text
Upload

↓

Validation

↓

Storage

↓

Processing

↓

Usage

↓

Archive

↓

Deletion
```

Every file should follow a defined lifecycle.

---

# Storage Security

Protect storage by:

- Access Control
- Private Media
- Signed URLs
- HTTPS
- Encryption at Rest
- Encryption in Transit

Sensitive files should never be publicly accessible.

---

# Retention Policies

Different file types may have different retention periods.

Examples

| Storage Type | Retention |
|--------------|-----------|
| Logs | 90 Days |
| Temporary Files | 24 Hours |
| Reports | 1 Year |
| Media | Business Defined |
| Backups | Business Policy |

Retention should comply with organizational requirements.

---

# Performance

Storage optimization

- Compression
- CDN
- Thumbnail Generation
- Lazy Loading
- Chunked Uploads
- Streaming Downloads

Large files should never be loaded entirely into memory.

---

# Monitoring

Monitor:

- Storage Usage
- Upload Failures
- Download Performance
- Disk Space
- Backup Size
- File Growth

Storage capacity planning should be reviewed regularly.

---

# Best Practices

- Separate media from static files.
- Use persistent volumes.
- Validate every upload.
- Encrypt sensitive files.
- Use UUID-based filenames.
- Automate backups.
- Monitor storage usage.

---

# Anti-Patterns

Avoid:

- Storing uploads inside containers
- Public access to private files
- Unlimited upload sizes
- Missing validation
- Hardcoded file paths
- Manual backup processes

---

# Testing

Storage testing should verify:

- File Uploads
- File Downloads
- Media Access
- Static File Delivery
- Backup Integrity
- Storage Permissions
- Cleanup Jobs
- Large File Handling

---

# Related Documents

- overview.md
- docker.md
- docker-compose.md
- nginx.md
- postgres.md
- backup.md
- networking.md
- monitoring.md
- environments.md
- ../07-deployment/overview.md
```