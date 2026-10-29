# Edit-Pages Audit & Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit then fix the Edit pages (fields end-to-end + activity logging) for Organization, Vendor, Client, People, Department, Team, Office.

**Architecture:** Seven independent per-entity audits run in parallel (one subagent each), each producing a field inventory table + broken-field list; shared-component bugs are fixed once at the shared level; backend serializer/model fixes land in the sibling `studiohub` repo; everything re-verified with unit tests + targeted E2E.

**Tech Stack:** React 19 + TanStack Query mutations + ky ApiClient → Django REST (`studiohub/backend`: DRF serializers, services, `organization_*` tables, activity/audit tables); vitest; Playwright.

**Spec:** User request 2026-10-01 — 7-step audit/fix procedure for the 7 entities (locate, inventory, trace, logging, flag, fix, summarize).

## Global Constraints

- Fix root causes, not symptoms; one shared fix beats seven entity patches.
- Follow existing activity/history logging patterns; do not invent a new mechanism.
- Do not redesign UI or change API contracts unnecessarily.
- No mock API/data in tests or fixes — real Django backend only.
- Frontend changes → `studiohub-react` repo; backend changes → `studiohub` repo (`backend/` dir); commit each repo separately.

## Review Focus

- Unsaved tab-switch loss: edits on tab A silently discarded when saving from tab B — user reasonably expects either a shared draft or a warning.
- Partial-update clobbering: PATCH with a subset of fields nulling fields the tab never loaded.
- False log entries: frontend-optimistic logging on a save that the backend rejected.
- Wrong-entity log attribution: shared logging helper logging under the wrong entity type/id.
- Stale post-save UI: success toast shown but displayed values reverted on refetch.

---

### Task 1: Organization edit audit

**Files:**
- Modify: `src/modules/organization/pages/EditOrganizationPage.tsx`
- Modify: `src/modules/organization/hooks/useOrganizationMutations.ts`
- Modify: `src/modules/organization/api/organizationApi.ts`
- Backend: `studiohub/backend/apps/organization/api/serializers/organization/update.py`, `studiohub/backend/apps/organization/services/organization.py`
- Test: `src/modules/organization/__tests__/editAudit.organization.test.tsx` (create)

**Interfaces:**
- Consumes: `useOrganizationDetail(id)` query, `updateOrganization` mutation (`PATCH /api/v1/organizations/:id/`), `updateOrgSettings` (`PATCH .../settings/`).
- Produces: per-tab field table; list of broken fields with root causes.

- [ ] **Step 1: Inventory tabs + fields of EditOrganizationPage**

Read `src/modules/organization/pages/EditOrganizationPage.tsx` fully. List every tab and every field with: label, input type, state key, API key. Record which tabs save via `updateOrganization` vs `updateOrgSettings` vs other endpoints.

- [ ] **Step 2: Trace each field to the backend**

For each inventoried field, follow `organizationApi.updateOrganization` → DRF `OrganizationUpdateSerializer` (`fields="__all__"` + declared extras) → model column. Flag fields dropped/renamed/ignored at any layer (known fixed examples: `headquarters_office_id`, `primary_contact_person_id` now work — re-verify, don't re-fix).

- [ ] **Step 3: Check activity logging for org updates**

Determine the app's logging pattern (frontend `useActivityStore.recordActivity` vs backend audit writes on DB write). Check whether org PATCH writes an audit row with actor/time/entity/field diffs, and whether the Activity tab displays it.

- [ ] **Step 4: Write the entity table**

Produce: Field updates table (Tab | Field | working/broken | root cause) + Activity logging table (Tab | Field | yes/no/missing | root cause). State verification method per row (code-read vs live test).

- [ ] **Step 5: Fix broken fields + logging (tiny commits, one per fix)**

```bash
git add <files>; git commit -m "fix(organizations): <what> (<root cause>)"
```

- [ ] **Step 6: Verify**

Run: `npx vitest run src/modules/organization 2>&1 | tail -n 4` and `npx tsc --noEmit`
Expected: PASS, 0 errors.

### Task 2: Vendor edit audit

**Files:**
- Modify: `src/modules/organization/pages/VendorFormPage.tsx`
- Modify: vendor hooks/mutations under `src/modules/organization/hooks/`
- Backend: `studiohub/backend/apps/organization/api/serializers/vendor/*`, services
- Test: create `src/modules/organization/__tests__/editAudit.vendor.test.tsx` if missing

**Interfaces:**
- Consumes: vendor detail query, vendor update mutation (`PATCH /api/v1/vendors/:id/` or org-scoped route).
- Produces: per-tab field table; broken-field list.

- [ ] **Step 1: Inventory VendorFormPage tabs + fields (same table format as Task 1)**
- [ ] **Step 2: Trace each field through vendor api → DRF vendor update serializer → model**
- [ ] **Step 3: Check vendor activity logging**
- [ ] **Step 4: Write the entity table**
- [ ] **Step 5: Fix (one commit per fix)**
- [ ] **Step 6: Verify**

Run: `npx vitest run src/modules/organization 2>&1 | tail -n 4` and `npx tsc --noEmit`
Expected: PASS, 0 errors.

### Task 3: Client edit audit

**Files:**
- Modify: `src/modules/organization/pages/ClientFormPage.tsx`
- Modify: client hooks/mutations under `src/modules/organization/hooks/`
- Backend: `studiohub/backend/apps/organization/api/serializers/client/*`, services
- Test: create `src/modules/organization/__tests__/editAudit.client.test.tsx` if missing

**Interfaces:**
- Consumes: client detail query, client update mutation.
- Produces: per-tab field table; broken-field list.

- [ ] **Step 1: Inventory ClientFormPage tabs + fields**
- [ ] **Step 2: Trace each field through client api → DRF serializer → model**
- [ ] **Step 3: Check client activity logging**
- [ ] **Step 4: Write the entity table**
- [ ] **Step 5: Fix (one commit per fix)**
- [ ] **Step 6: Verify**

Run: `npx vitest run src/modules/organization 2>&1 | tail -n 4` and `npx tsc --noEmit`
Expected: PASS, 0 errors.

### Task 4: People edit audit

**Files:**
- Modify: `src/modules/people/pages/EditPersonPage.tsx`
- Modify: people hooks/mutations
- Backend: person serializers/services in `studiohub/backend`
- Test: create people edit-audit test if missing

**Interfaces:**
- Consumes: person detail query, person update mutation.
- Produces: per-tab field table; broken-field list.

- [ ] **Step 1: Inventory EditPersonPage tabs + fields**
- [ ] **Step 2: Trace each field to the backend**
- [ ] **Step 3: Check people activity logging**
- [ ] **Step 4: Write the entity table**
- [ ] **Step 5: Fix (one commit per fix)**
- [ ] **Step 6: Verify**

Run: `npx vitest run src/modules/people 2>&1 | tail -n 4` and `npx tsc --noEmit`
Expected: PASS, 0 errors.

### Task 5: Department edit audit

**Files:**
- Modify: `src/modules/departments/pages/EditDepartmentPage.tsx`
- Modify: department hooks/mutations
- Backend: department serializers/services
- Test: create department edit-audit test if missing

**Interfaces:**
- Consumes: department detail query, department update mutation.
- Produces: per-tab field table; broken-field list.

- [ ] **Step 1: Inventory EditDepartmentPage tabs + fields**
- [ ] **Step 2: Trace each field to the backend**
- [ ] **Step 3: Check department activity logging**
- [ ] **Step 4: Write the entity table**
- [ ] **Step 5: Fix (one commit per fix)**
- [ ] **Step 6: Verify**

Run: `npx vitest run src/modules/departments 2>&1 | tail -n 4` and `npx tsc --noEmit`
Expected: PASS, 0 errors.

### Task 6: Team edit audit

**Files:**
- Modify: `src/modules/teams/pages/EditTeamPage.tsx`
- Modify: team hooks/mutations
- Backend: team serializers/services
- Test: create team edit-audit test if missing

**Interfaces:**
- Consumes: team detail query, team update mutation.
- Produces: per-tab field table; broken-field list.

- [ ] **Step 1: Inventory EditTeamPage tabs + fields**
- [ ] **Step 2: Trace each field to the backend**
- [ ] **Step 3: Check team activity logging**
- [ ] **Step 4: Write the entity table**
- [ ] **Step 5: Fix (one commit per fix)**
- [ ] **Step 6: Verify**

Run: `npx vitest run src/modules/teams 2>&1 | tail -n 4` and `npx tsc --noEmit`
Expected: PASS, 0 errors.

### Task 7: Office edit audit

**Files:**
- Modify: `src/modules/offices/pages/EditOfficePage.tsx`
- Modify: office hooks/mutations
- Backend: office serializers/services
- Test: create office edit-audit test if missing

**Interfaces:**
- Consumes: office detail query, office update mutation.
- Produces: per-tab field table; broken-field list.

- [ ] **Step 1: Inventory EditOfficePage tabs + fields**
- [ ] **Step 2: Trace each field to the backend**
- [ ] **Step 3: Check office activity logging**
- [ ] **Step 4: Write the entity table**
- [ ] **Step 5: Fix (one commit per fix)**
- [ ] **Step 6: Verify**

Run: `npx vitest run src/modules/offices 2>&1 | tail -n 4` and `npx tsc --noEmit`
Expected: PASS, 0 errors.

### Task 8: Shared-component + logging-pattern fixes

**Files:**
- Modify: shared form/tab components reused across entities (e.g. Address/Contact blocks, `src/shared/crud/*`)
- Modify: shared save/logging utilities if the same bug hits ≥2 entities
- Test: affected entity suites

**Interfaces:**
- Consumes: broken-field lists from Tasks 1–7.
- Produces: single shared fixes with per-entity propagation confirmation.

- [ ] **Step 1: Collect shared bugs (same Address/Contact component or save helper broken in ≥2 entities)**

```bash
grep -rn "shared/components\|shared/crud" src/modules/organization/pages/ src/modules/people/pages/ src/modules/departments/pages/ src/modules/teams/pages/ src/modules/offices/pages/ | head -n 20
```

- [ ] **Step 2: Fix once at shared level, confirm each entity's table row flips to working**
- [ ] **Step 3: Verify**

Run: `npx vitest run 2>&1 | tail -n 4` and `npx tsc --noEmit` and `npm run build 2>&1 | tail -n 2`
Expected: all green.

### Task 9: Final verification + summary

- [ ] **Step 1: Full frontend verification**

Run: `npx tsc --noEmit` (expect 0 errors), `npx vitest run` (expect all pass), `npm run build` (expect exit 0).

- [ ] **Step 2: Backend verification (in `studiohub` repo)**

Run: `uv run python manage.py makemigrations --check --dry-run` (expect "No changes detected"), targeted `pytest` for touched apps.

- [ ] **Step 3: Commit each repo separately and push**

```bash
git add <touched files only>; git commit -m "fix(<scope>): <what>"
```

- [ ] **Step 4: Write the per-entity summary (broken → changed → shared-vs-specific → logging status → unverifiable fields)**
