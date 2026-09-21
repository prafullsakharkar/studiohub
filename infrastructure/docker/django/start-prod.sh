#!/bin/sh
#
# Production process launcher.
#
# Migrations are intentionally NOT run here — they must be executed as an
# explicit, controlled deployment step (see compose.prod.yml / deployment docs).
# This script only collects static assets and starts the ASGI server.

set -eu

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting Uvicorn..."

exec uvicorn config.asgi:application \
    --host 0.0.0.0 \
    --port 8000 \
    --workers "${WEB_CONCURRENCY:-2}" \
    --proxy-headers \
    --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-127.0.0.1}"
