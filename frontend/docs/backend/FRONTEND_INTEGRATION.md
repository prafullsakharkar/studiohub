# StudioHub Frontend-Backend Integration Guide

## Overview
StudioHub frontend seamlessly switches between MSW (Mock Service Worker) for offline prototyping and the real Django REST Framework backend in development and production.

---

## Configuration

In `.env`:
```env
# Point to Django REST API base URL
VITE_API_URL=http://localhost:8000

# Set to false to disable MSW and route traffic directly to Django
VITE_USE_MSW=false
```

---

## Zero-Code Change Parity
The Django backend API endpoints strictly replicate:
- URL prefixes: `/api/v1/auth/`, `/api/v1/org/`, `/api/v1/prod/`, `/api/v1/work/`, `/api/v1/review/`, `/api/v1/pipe/`, `/api/v1/out/`, `/api/v1/auto/`, `/api/v1/analytics/`, `/api/v1/audit/`, `/api/v1/settings/`.
- Pagination structure: `{ "count": N, "next": "...", "previous": "...", "results": [...] }`.
- Status codes, error payloads, and filtering query parameters (`?project=...`, `?status=...`, `?search=...`).
