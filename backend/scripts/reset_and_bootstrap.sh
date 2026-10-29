#!/usr/bin/env bash
# Wipe a development or test database and rebuild it: migrate, seed reference data, create the
# first superuser. Run from backend/. Never use it against production (the commands refuse).
#
#   scripts/reset_and_bootstrap.sh <database-name>
#
# The database name must be given, and is repeated to the wipe command as its confirmation.
# The superuser comes from INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD; with DJANGO_ENV=local or
# testing they may be left out and the development defaults are used (docs/setup/BOOTSTRAP.md).
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <database-name>" >&2
  exit 2
fi
name="$1"

uv run python manage.py reset_database --name "$name" --yes-wipe "$name"
# bootstrap works on the configured database: refuse a name that is not the configured one
configured="$(uv run python -c 'from config.env import settings; print(settings.database["NAME"])')"
if [ "$configured" != "$name" ]; then
  echo "Wiped $name. It is not the configured database ($configured), so bootstrap was not run." >&2
  echo "Point DB_NAME at it and run: uv run python manage.py bootstrap" >&2
  exit 0
fi
uv run python manage.py bootstrap
