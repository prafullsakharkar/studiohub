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

mc anonymous set public local/media

echo "Buckets created."
