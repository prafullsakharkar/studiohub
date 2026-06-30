#!/bin/sh

set -e

echo "Waiting for database..."

until python - <<EOF
import socket
import os

host = os.getenv("POSTGRES_HOST", "postgres")
port = int(os.getenv("POSTGRES_PORT", 5432))

try:
    socket.create_connection((host, port), timeout=2)
    print("Database available")
except Exception:
    raise SystemExit(1)
EOF
do
    sleep 2
done

echo "Database is ready."

exec "$@"
