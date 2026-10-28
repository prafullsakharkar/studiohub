# Final verification: publishing, deliveries and scheduling

Phase 12, 2026-10-27. Branch `feature/scheduling-improvement`, which contains all the work (it starts
from `develop` at `34168d6`, then the publishing, deliveries and scheduling commits below). Nothing is
pushed or merged. This file records what was run, what it showed, and what was **not** verified.

## 1. What was built

| Phase | App | Commit | Subject |
|---|---|---|---|
| 3 | publishing | `9c37116` | integrity and storage |
| 4 | publishing | `4716bc7` | workflow |
| 5 | publishing | `4177fba` | authorization and hardening |
| 6 | deliveries | `c4f649d` | core model and integrity |
| 7 | deliveries | `8029749` | workflow, approvals and access |
| 8 | deliveries | `7602e4b` | sensitive data, API and hardening |
| 8 follow-up | deliveries | `98e1d8f` | `init_platform` withdraws the grants Q34 removes (Q40 = A) |
| fix | deliveries | `66649be` | passcode test key from `.env.test`; `DELIVERY_SECRET_KEYS` reaches settings |
| 9 | scheduling | `5ad3092` | calendars, dates and integrity |
| 10 | scheduling | `b02a0ac` | bookings and capacity |
| 11 | scheduling | `c7a5045` | authorization and hardening |
| 12 | all three | (this commit) | integration and final verification |

Phases 0 to 2 (baseline, audit, design) produced the `docs/*/ANALYSIS.md`, `CONTRACTS.md`, `PLAN.md`
and `DECISIONS.md` files. Per-app detail: `docs/apps/{publishing,deliveries,scheduling}.md`.

## 2. Results (Phase 12, run on the PostgreSQL test database)

| Command | Result |
|---|---|
| `uv run pytest` (full suite, coverage gate 72%) | **5,998 passed, 1 skipped**, coverage **86.18%**, exit 0, 34m09s |
| `uv run ruff check .` | clean |
| `uv run python manage.py makemigrations --check --dry-run` | no changes |
| `uv run python manage.py check` | one pre-existing warning, `identity.W003` (TOTP secrets stored in plaintext while `MFA_ENCRYPTION_ENABLED` is false) |
| `uv run basedpyright apps/scheduling` | one pre-existing error (`serializers/__init__.py`, a `Decimal` default typed as a string). Only `apps/scheduling` was type-checked in Phase 12 (publishing and deliveries were checked in their own phases) |
| Docs link check | 421 files, all relative links resolve |

Tests per app (collected): publishing 576, deliveries 568, scheduling 626, plus the cross-app tests
in `apps/core/tests/`. Full-suite history: 4,340 passed at the Phase 0 baseline, 4,613 after Phase 3,
5,261 after Phase 7, 5,441 after Phase 8, 5,656 after Phase 10, 5,998 now. Every guard named in the
phase reports was also checked by breaking it once and seeing a test fail (mutation checks); the
migration files themselves were deliberately not mutated.

## 3. Cross-app checks (`CONTRACTS.md` X-10)

| Check | Test | Result |
|---|---|---|
| Publish, deliver, schedule, read the project schedule | `apps/deliveries/tests/integration/test_pipeline_flow.py` | passes |
| Revoke after send | same file | passes |
| Archive work that was published and delivered | same file | passes; **behaviour is not "refused"**, see Q41 |
| Disabled user loses access | `apps/core/tests/integration/test_disabled_user_three_apps.py` (all 116 operations) | passes |
| Dependency direction, selectors not models, no organization fields | `apps/core/tests/test_dependency_direction.py` | passes |
| Migrations forward, backward, forward on a disposable database | not done | **UNVERIFIED** (A-65) |

## 4. UNVERIFIED (what was not run or cannot be seen from here)

1. **Migrations on real data.** Nothing ran against staging or production. The stop-and-list migrations
   (publishing, deliveries 0010, scheduling 0006 and 0008) refuse and list offending rows; whether
   yours have any is answered by the read-only queries in `ANALYSIS.md` section 8.
2. **Round trip on a disposable database (Q10 B).** Only per-app round trips inside the test database
   were done. Steps for you: `DECISIONS.md` "Checks only you can make", item 13.
3. **The live database's `btree_gist`.** The test cluster has it; the live database was never touched.
4. **Roles on your databases.** `manage.py init_platform` must run after deploying (new codes and
   withdrawn grants); the resulting grants on your data are unchecked.
5. **Frontend.** `../studiohub-react` was read, never run. Whether it already breaks on the contract
   changes in section 7 is unchecked.
6. **Pipeline tools and clients** calling the three APIs (DCC tools, the delivery passcode outside
   StudioHub): unknown.
7. **Real mock data for the demo seed.** The seed now skips an overlapping assignment instead of
   crashing; whether the mocks overlap was not checked.
8. **Race behaviour outside PostgreSQL.** The race tests are skipped on other engines; SQLite ignores
   row locks.

## 5. Not built, on purpose (Q5, LATER or declined)

Publish and schedule dependencies with cycle checks, recurring events, reminders, notification
channels (Q30), download links (Q4), a leave `cancel` endpoint (A-59), a database constraint on
overlapping leave (A-61), a dashboard card that reads real milestones (A-56), a `Resource` working-days
setting for part-timers on fixed days (A-53).

## 6. Deployment order

1. Back up the database. Read the queries in `ANALYSIS.md` section 8 and the checklist in
   `DECISIONS.md`; fix or accept what they show.
2. Set `DELIVERY_SECRET_KEY` (see `docs/deliveries/`); without it delivery passcode reads and writes
   answer 503.
3. Deploy and run `manage.py migrate`. A stop-and-list migration that refuses has changed nothing:
   fix the rows it names and run it again.
4. Run `manage.py init_platform` and read its last line.
5. Decide on `manage.py redact_leave_reasons` (dry run first) and on Q41.
6. Create the office work calendars (time zone Asia/Kolkata was chosen) and their holidays through the
   API; until then every resource follows the UTC "STUDIO" calendar.

## 7. What a client will notice (all phases)

Publishing and deliveries gained project scoping, state machines with guarded transitions, a file
registry, immutable delivery snapshots, an encrypted passcode with an audited read, bulk cancel and
register, and permission codes with a seeded role matrix. Scheduling gained work calendars, strict
date-times (a naive one is a 400), working-day leave, no overlapping bookings (409), derived resource
status, capacity after holidays and leave, milestones, the leave rules and codes of Phase 11, and bulk
delete. Production's schedule route now shows real milestones (ids are UUIDs, empty until created).
The exact list per phase is in each `CONTRACTS.md` "as built" section.

## 8. Findings the work surfaced (beyond the planned changes)

* `DELIVERY_SECRET_KEYS` was missing from `config/settings/base.py`'s re-export list, so outside the
  tests the delivery key never reached Django (fixed, `66649be`).
* A booking whose end equalled its start was stored (and later a 500 under the new check); event and
  resource create responses carried no `id` (fixed, Phase 9).
* Scheduling queried Production and Masterdata models directly (fixed, A-66).
* **Open:** archiving a shot with published work is allowed (Q41).
* **My own error, corrected:** I reported `btree_gist` as missing from the database server after
  checking the wrong server (port 5432, not the 5439 one the tests use). The record is corrected in
  `DECISIONS.md`; the lesson is to read database state only from inside a pytest run.
