#!/bin/sh
#
# Production process launcher.
#
# Migrations are intentionally NOT run here — they must be executed as an
# explicit, controlled deployment step (see compose.prod.yml / deployment docs).
# This script only collects static assets and starts the ASGI server.

set -eu

echo "Running deployment checks..."
python manage.py check --deploy --fail-level ERROR

echo "Collecting static files..."
python manage.py collectstatic --noinput

# Serve HTTPS to the reverse proxy when a certificate is given (compose.prod.yml sets these from the
# tls-init job): the proxy-to-application hop is encrypted and the proxy verifies it (TPN review TM-009).
if [ -n "${DJANGO_TLS_CERTFILE:-}" ] && [ -n "${DJANGO_TLS_KEYFILE:-}" ]; then
    echo "Starting Uvicorn (TLS)..."
    set -- --ssl-certfile "$DJANGO_TLS_CERTFILE" --ssl-keyfile "$DJANGO_TLS_KEYFILE"
else
    echo "Starting Uvicorn..."
    set --
fi

exec uvicorn config.asgi:application \
    --host 0.0.0.0 \
    --port 8000 \
    --workers "${WEB_CONCURRENCY:-2}" \
    --proxy-headers \
    --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-${TRUSTED_PROXY_IPS:-127.0.0.1}}" \
    "$@"
