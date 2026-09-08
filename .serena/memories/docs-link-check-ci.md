# Docs Link-Check CI (ci-linkcheck audit TODO)

Implemented the remaining P0 item from `docs/architecture/documentation-audit.md` Appendix B (ci-linkcheck).

## What was done
- Added `scripts/check_docs_links.py` (stdlib-only): validates every relative markdown link in `docs/**/*.md` resolves to an existing path. Skips http/https/mailto/# targets, ignores fenced code blocks and inline code spans, strips `#anchors`. Repo-absolute links (`/...`) resolve against REPO_ROOT — this catches leaked local absolute paths (e.g. `/home/<user>/...`) that "work" on one machine only.
- Added `docs` job to `.github/workflows/ci.yml` running `uv run python scripts/check_docs_links.py` at repo root (no root pyproject needed; uv falls back to managed python).
- Fixed 88 pre-existing broken links the checker found:
  - `docs/SUMMARY.md`: rewrote sections 01/02/03-backend/04/05/06/07/08/10/11 to match the actual tree; fixed 3 checkpoint links that wrongly used `docs/...` prefix from inside docs/.
  - `docs/architecture/core-refactor-analysis.md`: replaced 47 leaked `/home/...` absolute link prefixes with `../../` repo-relative links.
  - `docs/08-development/core.md`: repointed dead links to files deleted in commit 948b831 (`test_architecture.py`, `test_api.py` -> `test_api_foundation.py`, `api/builders/export.py`/`ExportBuilder` removed; dependency-rule sentence now references ADR-0026).

## ADR consolidation (adr-consolidation audit TODO, done 2026-09-07)
- Created `docs/adr/ADR-0030-domain-events-and-event-bus.md` consolidating ADR-0005 + ADR-0018 (both now marked "Superseded by ADR-0030" in status headers; bodies untouched as historical record).
- Implementation status in ADR-0018 had drifted from code: real `DomainEvent` is a kwargs-payload base class (`base.py`) with `dispatch(**kwargs)` classmethod, frozen dataclass subclasses (`BaseCreated`/`BaseUpdated`); `EventBus.publish(event)` has no `on_commit` param (auto-defers via `transaction.on_commit` when in atomic block); publish/subscribe are instance methods on the `default_event_bus` singleton, not classmethods; `events/signals.py` (empty) and `events/mixins/` (auditable/cache/logging/notification, used by core models+api) still exist despite ADR-0018 claiming removal. ADR-0030 records verified facts only.
- `docs/12-reference/architecture-decision-records.md` contains a fictional "Example ADR Index" (ADR-0005 = Django REST Framework etc.) — it is explicitly a template, not a live index; do not confuse it with real ADRs.
- `docs/02-architecture/event-system.md` Related Documents now points to ADR-0030; SUMMARY.md ADR list now includes ADR-0029 and ADR-0030 and marks 0005/0018 superseded.
- All audit TODOs (Appendix B of documentation-audit.md) are now complete.

## Conventions to remember
- When deleting/renaming backend files, grep docs for the old path — docs link-check CI will fail on broken references.
- Remaining audit TODO (P1, not done): adr-consolidation — reconcile ADR-0005 (event-driven architecture) vs ADR-0018 (event bus architecture).
