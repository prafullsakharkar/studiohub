#!/bin/sh

set -e

echo "Starting Flower..."

celery \
    -A core.celery:app \
    flower \
    --port=5555
