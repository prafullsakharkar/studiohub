#!/bin/sh

set -e

echo "Starting Celery Worker..."

celery \
    -A core.celery:app \
    worker \
    --loglevel=INFO
