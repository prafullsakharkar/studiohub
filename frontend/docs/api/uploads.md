# StudioHub Uploads & Media Storage Contract

## 1. Storage Architecture

StudioHub supports both direct multipart uploads and presigned S3 / MinIO direct-to-bucket uploads for high-throughput media files (exr, dpx, mov, mp4, usdz, usd).

```
┌──────────────┐                  ┌────────────────────────┐
│ React Client │ ── POST /media/presign/ ──► │ Django Media App       │
│              │ ◄── S3 Presigned URL ─────── │ (Generates S3 signature│
└──────┬───────┘                              └────────────────────────┘
       │
       │ PUT binary file directly
       ▼
┌────────────────────────┐
│ AWS S3 / MinIO Storage │
│ (Stores raw media)     │
└──────┬─────────────────┘
       │
       │ S3 Notification / Celery Worker
       ▼
┌────────────────────────┐
│ Asynchronous Transcode │ ── FFmpeg proxy / OCIO ACES 1.3 color transcode
│ (Celery + Redis)       │ ── Generates WebM/H.264 dailies & audio waveforms
└────────────────────────┘
```

---

## 2. Endpoints

### 2.1 Presigned Upload URL Generation
- **Endpoint**: `POST /api/v1/media/presign/`
- **Request Body**:
```json
{
  "filename": "NK_010_010_comp_v003.mov",
  "content_type": "video/quicktime",
  "file_size": 245892014,
  "entity_type": "Shot",
  "entity_id": "shot-001"
}
```
- **Response (200 OK)**:
```json
{
  "upload_url": "https://storage.studiohub.vfx/studio-vault/NK_010_010_comp_v003.mov?X-Amz-Signature=...",
  "file_key": "studio-vault/projects/proj-001/shots/shot-001/NK_010_010_comp_v003.mov",
  "expires_in": 3600
}
```

### 2.2 Multipart Direct Attachment Upload
- **Endpoint**: `POST /api/v1/attachments/`
- **Content-Type**: `multipart/form-data`
- **Fields**: `file` (Binary), `entity_type` (String), `entity_id` (UUID), `label` (String).
