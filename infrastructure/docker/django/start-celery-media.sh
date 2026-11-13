#!/bin/sh

set -e

# The review media worker (review-pipeline RP-5): only the `media` queue, one job at a time by
# default, each job taken only when a slot is free. ffmpeg is in this image (`--target worker`).

echo "Starting the review media worker..."

exec celery \
    -A core.celery:app \
    worker \
    --queues=media \
    --concurrency="${REVIEW_MEDIA_CONCURRENCY:-1}" \
    --prefetch-multiplier=1 \
    --hostname="media@%h" \
    --loglevel=INFO
