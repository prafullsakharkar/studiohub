# Phase 3 — Backend Validation + Security Tests + Playwright + Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Django rejects every cross-organization relationship; CRUD, relationship, and end-to-end tests prove it; production build passes; no stale references remain.

**Architecture:** Add missing `validate()` org-guards in `../studiohub` serializers (mirroring the existing person/team/department guards); frontend + backend tests with Org-A/Org-B fixtures; one Playwright connected-entity workflow extending existing e2e patterns; final audits in both repos.

**Tech Stack:** Django REST Framework serializers, pytest via `make pytest` (docker compose), vitest, Playwright (real Django backend only, `VITE_API_URL` default `http://127.0.0.1:8000`, seeded users like `supervisor@studiohub.vfx / password123`).

**Spec:** `docs/superpowers/specs/2026-10-06-organization-workspace-refactor-design.md` (§3.5, §5/§42)

## Global Constraints

- Backend changes live in `/home/prafull.sakharkar/Repository/github/studiohub`, committed separately from frontend changes.
- Invitation backend stays untouched.
- Frontend tests use the Django REST API contract only — no mocks of org scoping itself (mock hooks only to isolate component rendering, as in Phase 2).
- Playwright runs against the real backend + seeded data (follow `e2e/organization-isolation.spec.ts` login/seed patterns); no MSW.
- Existing error contract decides status codes (400 vs 403) — match the person-serializer precedent, don't invent a new one.

## Review Focus

- A cross-org POST that the backend previously accepted with 201 must now fail — expect the exact precedent status code, not a new one.
- A serializer with `organization = NULL` legacy rows must not crash validation — expect the legacy allowance the person guard uses.
- Playwright creating entities in Org A must use unique names per run — expect no collisions on re-runs.
- Switching to Org B mid-workflow must show zero Org-A records in every selector — expect server-filtered lists, not client filtering.
- The final grep for `invitation` in workspace surface and for hardcoded entity names in forms must be empty — expect the audit commands to prove it.

## File Map

- Backend modify: `backend/apps/organization/api/serializers/{client.py, vendor.py, client_contact.py, vendor_contact.py, client_contract.py, vendor_contract.py, group.py, group_member.py, group_role.py, membership.py, user_role.py}` (+ calendar/holiday/branding serializers if they carry org FKs — verify per file)
- Backend reference: `serializers/person/create.py::PersonCreateSerializer.validate` (the guard pattern to copy), `serializers/team/update.py`, `constants/permissions.py`
- Frontend tests: `src/features/organizations/__tests__/` (new `relationships/` + `crossOrg/` suites)
- E2E create: `e2e/org-workspace-connected-entities.spec.ts` (patterns from `organization-isolation.spec.ts`, `production-role-scoping.spec.ts`)

---

### Task 1: Backend validate() guards for client/vendor serializers

**Files (backend repo `/home/prafull.sakharkar/Repository/github/studiohub`):**
- Modify: `backend/apps/organization/api/serializers/client.py`, `vendor.py`, `client_contact.py`, `vendor_contact.py`, `client_contract.py`, `vendor_contract.py`

**Interfaces:**
- Consumes: request organization from the same source the person guard uses (`self.context['request']` org / `resolve_organization_context`); sibling FKs (`client` on contacts/contracts, `organization` on all).
- Produces: `validate(attrs)` raising `serializers.ValidationError` when any submitted related id belongs to a different organization; legacy `organization IS NULL` rows allowed exactly as the person guard allows.

- [ ] **Step 1: Read the person-guard precedent verbatim**

Read `backend/apps/organization/api/serializers/person/create.py::validate` (and `team/update.py::validate`). Copy: how the request org is obtained, how dept/team/office ids are filtered by org, which exception type + message shape, how legacy NULL-org rows are treated.

- [ ] **Step 2: Write the failing backend test first**

In the organization app's test suite (find existing serializer tests for client/vendor to colocate), add:

```python
def test_client_contact_rejects_other_org_client(org_a, org_b, client_in_b):
    data = {"organization": org_a.id, "client": client_in_b.id, ...required_fields}
    serializer = ClientContactSerializer(data=data, context={"request": request_in_org_a})
    assert not serializer.is_valid()
    assert "organization" in str(serializer.errors).lower() or "client" in serializer.errors
```

(Fill `...required_fields` from the actual serializer — read it first.)

- [ ] **Step 3: Run test to verify it fails**

Run: `make pytest` scoped, e.g. `docker compose exec django pytest backend/apps/organization -k "other_org" -x -q`
Expected: FAIL (currently accepted).

- [ ] **Step 4: Implement validate() in each of the six serializers**

Mirror the person guard: resolve request org, check each submitted FK (`organization`, `client`, `vendor`) is owned by it, raise `ValidationError` with the same message shape. No behavior change for same-org payloads.

- [ ] **Step 5: Run backend org tests**

Run: `docker compose exec django pytest backend/apps/organization -q`
Expected: PASS (full app suite, no regressions).

- [ ] **Step 6: Commit (backend repo)**

```bash
git add backend/apps/organization/api/serializers/ backend/apps/organization/tests/
git commit -m "fix(org-api): reject cross-organization client/vendor relationships"
```

---

### Task 2: Backend validate() guards for group/membership/user-role serializers

**Files (backend repo):**
- Modify: `backend/apps/organization/api/serializers/group.py`, `group_member.py`, `group_role.py`, `membership.py`, `user_role.py` (verify each file's FKs first — guard every FK pointing at an org-owned entity: `group.organization`, member `user` validity per org, `role.organization`)

- [ ] **Step 1: Read each serializer and list its org-owned FKs**

Run: `grep -n "organization\|group\|role\|user\|department\|team\|office" backend/apps/organization/api/serializers/{group,group_member,group_role,membership,user_role}.py | head -n 60`
Expected: exact FK inventory guiding the guards.

- [ ] **Step 2: Write failing tests (cross-org group-role, cross-org membership dept)**

Follow the Task 1 test shape: valid in-org payload passes, cross-org payload fails with the precedent error shape.

- [ ] **Step 3: Run to verify they fail**

Run: `docker compose exec django pytest backend/apps/organization -k "other_org or cross_org" -q`
Expected: FAIL on the new tests.

- [ ] **Step 4: Implement validate() guards mirroring Task 1**

Same request-org resolution, same error shape, same legacy allowance.

- [ ] **Step 5: Run backend org + masterdata suites**

Run: `docker compose exec django pytest backend/apps/organization backend/apps/masterdata -q`
Expected: PASS.

- [ ] **Step 6: Commit (backend repo)**

```bash
git add backend/apps/organization/api/serializers/ backend/apps/organization/tests/
git commit -m "fix(org-api): reject cross-organization group and membership relationships"
```

---

### Task 3: Frontend CRUD + relationship + cross-org test suites

**Files:**
- Create: `src/features/organizations/__tests__/relationships/<entity>.test.tsx` per entity (person, team, department, project minimum)
- Create: `src/features/organizations/__tests__/crossOrg/orgIsolation.test.tsx`
- Reference: Phase 2 selector tests, `PersonRoleSelect.test.tsx` patterns

**Interfaces:**
- Consumes: Phase 2 forms/selectors; MSW-or-hook mocks only for rendering isolation (never to fake scoping itself).
- Produces: per-entity suites (create/read/update/archive/restore/delete-where-supported, search, filter, pagination, permissions, relationships) + cross-org suite (Org-A form shows Dept-A not Dept-B; direct POST with Dept-B id surfaces the backend 400/403 error in the form).

- [ ] **Step 1: Write the People relationship test (department/team/office/role dropdowns)**

Mock `useDepartments/useTeams/useOffices/useAvailablePositions` with Org-A vs Org-B datasets keyed by the `orgId` argument; render the People form for Org A; assert Dept-A present, Dept-B absent; assert submit payload carries ids.

- [ ] **Step 2: Run to verify it fails (if implementation regressed) or passes**

Run: `pnpm vitest run src/features/organizations/__tests__/relationships/person.test.tsx`
Expected: PASS against Phase 2 code (pins behavior); any FAIL is a Phase 2 regression to fix before proceeding.

- [ ] **Step 3: Replicate for team/department/project forms + cross-org API-error surfacing**

Team: department dropdown + people/projects multi-selects. Department: people/teams/projects selectors (only where the model supports them). Project: client/vendors/departments/teams/people selectors. Cross-org: simulate backend 400 on mismatched `department_id` → assert the form shows the field error and keeps entered values.

- [ ] **Step 4: Run the full frontend suite + typecheck**

Run: `pnpm vitest run && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/organizations/__tests__/relationships src/features/organizations/__tests__/crossOrg
git commit -m "test(org-workspace): crud, relationship and cross-org suites"
```

---

### Task 4: Playwright connected-entity workflow + Org-B isolation

**Files:**
- Create: `e2e/org-workspace-connected-entities.spec.ts`
- Reference: `e2e/organization-isolation.spec.ts` (`loginAs` helper, seeded users/orgs: `vfx.supervisor@studiohub.vfx` multi-org, `artist@studiohub.vfx` apex-only, orgs Apex/Vanguard)

**Interfaces:**
- Consumes: Phase 2 forms in the running app (`pnpm dev` on port 3100 via playwright config `webServer`), real backend at `VITE_API_URL`.
- Produces: green workflow — login → Org A → create Department/Team/Office/Client/Vendor → create Project (select them) → create Person (Dept/Team/Office dropdowns show the new records) → verify relationships → switch Org B → verify Org-A records absent everywhere.

- [ ] **Step 1: Write the spec with unique-per-run names**

```ts
import { test, expect, type Page } from '@playwright/test';

const stamp = Date.now().toString(36);
const deptName = `E2E Dept ${stamp}`;

async function loginAs(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('#login-email-input').fill(email);
  await page.locator('input[type="password"]').fill('password123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|access|organizations)/, { timeout: 30_000 });
}

test.describe('Connected entity workflow', () => {
  test('create chain in Org A and verify isolation in Org B', async ({ page }) => {
    await loginAs(page, 'vfx.supervisor@studiohub.vfx');
    // ... navigate to /organizations/<apex-id>?tab=departments, create deptName,
    // teams, office, client, vendor, project, person; assert each new record
    // appears in the downstream selectors; switch org; assert absence.
  });
});
```

Resolve selectors/URLs against the real rendered DOM (run once headed to confirm locators — never guess locators; adjust to what renders).

- [ ] **Step 2: Run the spec to verify it passes**

Run: `pnpm exec playwright test e2e/org-workspace-connected-entities.spec.ts`
Expected: PASS. On locator failure, inspect the DOM and fix the locator (not the app) unless the app truly broke — then fix the app and re-run.

- [ ] **Step 3: Run the existing isolation + role-scoping specs for regressions**

Run: `pnpm exec playwright test e2e/organization-isolation.spec.ts e2e/production-role-scoping.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/org-workspace-connected-entities.spec.ts
git commit -m "test(e2e): connected-entity workflow with org isolation"
```

---

### Task 5: Production build + final repository audit + definition of done

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `pnpm build`
Expected: success, no type or bundling errors.

- [ ] **Step 2: Stale-reference audit (frontend)**

Run: `grep -rni "invitation" src e2e --include='*.ts*' -l | grep -v generated; echo ---; grep -rn "Compositing\|Montreal HQ" src/modules/organization/components/tabs/ | head; echo ---; grep -rn "tab=invitations\|'invitations'\|\"invitations\"" src --include='*.ts*' | grep -v generated | head`
Expected: empty (no workspace invitation surface, no hardcoded entity names, no stale tab ids).

- [ ] **Step 3: Backend audit (backend repo)**

Run: `grep -rn "class.*Invitation" backend/apps/organization/api/viewsets/ backend/apps/organization/api/urls_nested.py | head`
Expected: invitation API intact (backend keeps it — confirming scope, not removing).

- [ ] **Step 4: Full frontend suite once more + summarize**

Run: `pnpm vitest run`
Expected: PASS. Then write the completion summary with: files added / modified / removed, invitation code removed, workspace sections changed, optional tabs, entity CRUD consolidated, relationship selectors implemented, API endpoints used, backend validation added/verified, RBAC changes, tests, Playwright results, build result, remaining issues.

- [ ] **Step 5: Commit the summary (append to the spec or plans as a completion note)**

```bash
git add docs/superpowers/plans/ docs/superpowers/specs/
git commit -m "docs(org-workspace): phase 3 completion summary"
```

## Self-review

- Spec §3.5 covered by Tasks 1-2 (every missing-guard serializer listed; person-guard precedent; invitation backend excluded). Spec §§36-42 covered by Tasks 3-5 (CRUD, dropdown, cross-org, Playwright, build, audit, summary).
- No placeholders: exact files, commands (`docker compose exec django pytest`, `pnpm exec playwright test`), and the precedent to copy are named; unknown serializer keys get verify-first steps.
- Type consistency: `validate(attrs)` + `serializers.ValidationError` + request-org context pattern carried across backend tasks; `orgId` scoping language matches Phase 2.
- Phase 3 produces the done state: validated backend, proven isolation, green build, audited repo.
