#!/usr/bin/env bash
# Starts the throwaway factory-seeded backend (live_backend.py), runs the Playwright role smoke tests against it,
# and stops the backend. Extra arguments go to Playwright, e.g. `--grep "no role"`.
#
#   docs/sync/tools/run_role_smoke.sh                    # all six roles, about 20 minutes
#   docs/sync/tools/run_role_smoke.sh --grep "no role"   # one role
#
# State (backend log, connection details) is kept in frontend/test-results/live, which Git ignores.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
OUT="$ROOT/frontend/test-results/live"
mkdir -p "$OUT"
rm -f "$OUT/live.json" "$OUT/live.json.totp.json" "$OUT/live.stop"

cd "$ROOT/backend" || exit 1
SYNC_LIVE_MINUTES="${SYNC_LIVE_MINUTES:-45}" SYNC_LIVE_INFO="$OUT/live.json" SYNC_LIVE_STOP="$OUT/live.stop" \
  nohup uv run pytest -c pyproject.toml --rootdir . -p no:cacheprovider --no-cov -q -s ../docs/sync/tools/live_backend.py \
  > "$OUT/backend.log" 2>&1 &

for _ in $(seq 1 60); do [ -f "$OUT/live.json" ] && break; sleep 2; done
grep -q LIVE_READY "$OUT/backend.log" || { echo "the backend did not start; see $OUT/backend.log"; touch "$OUT/live.stop"; exit 1; }
# The harness used this TOTP step to seed MFA; wait for the next one so the first sign-in is not a replay.
sleep 32

cd "$ROOT/frontend" || exit 1
SYNC_LIVE_INFO="$OUT/live.json" pnpm exec playwright test -c playwright.live.config.ts "$@"
status=$?
touch "$OUT/live.stop"
exit $status
