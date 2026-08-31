# StudioHub File Storage & Media Architecture

## Storage Architecture
StudioHub supports hybrid storage paradigms:

1. **Cloud Object Storage (S3 / MinIO / GCS)**:
   - Used for review proxies, frame thumbnails, attachments, and delivery archives.
   - Presigned upload and download URLs are generated on demand.

2. **On-Premise VFX NAS / SAN Filesystem**:
   - Used for primary OpenUSD layers, EXR image sequences, and DCC project files.
   - Referenced in database models via `file_path`, `usd_layer_path`, and `storage_root_path`.

---

## File Attachment Model
`Attachment` records in `apps.production.models` provide generic file attachment tracking across shots, assets, review sessions, and delivery packages.
