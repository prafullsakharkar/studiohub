#!/bin/sh

set -e

mc alias set local \
    http://minio:9000 \
    "$MINIO_ROOT_USER" \
    "$MINIO_ROOT_PASSWORD"

mc mb --ignore-existing local/media
mc mb --ignore-existing local/static
mc mb --ignore-existing local/backups
mc mb --ignore-existing local/exports

# Private. Nothing here is served by path; files leave only through the application.
mc anonymous set none local/media

echo "Buckets created."
