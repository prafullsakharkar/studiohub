#!/bin/sh

set -e

echo "Starting Celery Beat..."

celery \
    -A core.celery:app \
    beat \
    --loglevel=INFO
