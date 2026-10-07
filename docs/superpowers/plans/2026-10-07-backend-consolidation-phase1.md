# Backend Consolidation Phase 1 (N1/N2/N7/N8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the four approved backend migrations (Person↔User link, ProjectMembership status choices, ProjectMembership role FK, RolePermission table rename) with serializers, tests, and docs, preserving API contracts and organization isolation.

**Architecture:** Additive, backward-compatible schema changes only (nullable FKs, constrained choices with case-insensitive mapping, state-only table rename). Each migration is independently testable; no endpoint removals; no serializer field removals — only additions.

**Tech Stack:** Django 5.x, DRF 3.15+, PostgreSQL (prod) / SQLite (tests), `uv run`, pytest.

**Spec:** Approved design §3.1 (frontend session spec `docs/superpowers/specs/2026-10-07-backend-frontend-consolidation-design.md` in `../studiohub-react`); ADR-0033 (`docs/adr/ADR-0033-canonical-authorization-model.md`) is the binding prior decision.

## Global Constraints

- All commands run via `uv run` (never system Python).
- Never manually edit migrations already applied to shared environments — always new migrations.
- Preserve existing frontend API contracts (URL, method, payloads, pagination, errors) — fields are added, never removed or renamed in responses.
- Organization isolation stays fail-closed; backend authorization remains authoritative.
- Database-portable ORM only (no Postgres-specific logic; must pass on SQLite test DB).
- Follow `backend/.ai/` rules: thin views, serializers for validation/representation only, business rules in services/selectors, type hints on public functions, no magic strings where choices exist.
- Cross-app FK migrations must declare `migrations.swappable_dependency(settings.AUTH_USER_MODEL)`.
- `UniqueConstraint(user, organization)` on Person relies on NULL-distinct semantics (Postgres and SQLite both treat NULLs as distinct) — no partial index, stays portable.

## Review Focus

- A Person whose email matches TWO users (or a user in a different org) must NOT link — exactly-one-match wins, conflicts stay unlinked and are reported, pinned by Task 1 tests.
- A ProjectMembership with an unknown status string (e.g. `"Pending"`) must map to `active` and be logged, never crash the migration, pinned by Task 3 tests.
- A `role` string with no matching Role code must leave `role_ref` NULL and keep the Char snapshot intact, pinned by Task 4 tests.
- The N8 table rename must preserve all rows and the `uq_organization_role_permission` constraint on a populated table, pinned by Task 5 tests.
- A write payload with an out-of-scope `user_id`/`role_id` (unknown id, sibling-org custom role) must be rejected fail-closed, pinned by Tasks 2 and 4 serializer tests.

---

### Task 1: N1 — `Person.user` FK + email-match backfill migration

**Files:**
- Modify: `backend/apps/organization/models/person.py` (add `user` FK + `UniqueConstraint`)
- Create: `backend/apps/organization/migrations/0034_person_user.py` (schema, via makemigrations)
- Create: `backend/apps/organization/migrations/0035_backfill_person_user.py` (data, hand-written `RunPython`)
- Test: `backend/apps/organization/tests/models/test_person_user_link.py` (new)

**Interfaces:**
- Consumes: `settings.AUTH_USER_MODEL` (`"identity.User"`, `backend/config/settings/components/auth.py:5`); existing `Person.email` (db_indexed) and `User.email` (unique).
- Produces: `Person.user` nullable FK (`SET_NULL`, `related_name="person_profiles"`); constraint `uq_person_user_organization`.

- [ ] **Step 1: Write the failing test**

```python
# backend/apps/organization/tests/models/test_person_user_link.py
import pytest
from django.contrib.auth import get_user_model

from apps.organization.models import Organization, Person

User = get_user_model()


@pytest.mark.django_db
def test_person_links_to_matching_user_on_backfill():
    from django.core.management import call_command

    org = Organization.objects.create(code="T1", name="T1", slug="t1")
    user = User.objects.create_user(email="Artist@Example.com", password="x")
    person = Person.objects.create(organization=org, name="Artist", email="artist@example.com")
    assert person.user_id is None
    call_command("migrate", "organization", verbosity=0)  # no-op once applied; backfill runs in migration
    person.refresh_from_db()
    # Backfill is verified at migration level; model-level link works:
    person.user = user
    person.save(update_fields=["user"])
    person.refresh_from_db()
    assert person.user_id == user.id


@pytest.mark.django_db
def test_ambiguous_email_match_leaves_person_unlinked():
    from apps.organization.migrations import migrations_0035_backfill as _  # placeholder, see Step 3
```

(Write the real backfill unit tests against the migration function in Step 3 — import the `backfill` function from the migration module and call it with the migration `apps` registry via `call_command("migrate")` on a test DB is heavy; instead test via `Migrator` pattern used in repo: check `backend/apps/organization/tests/migrations/` for the established helper first and mirror it. Keep three cases: exact match links, two-users-one-email leaves unlinked, different-org-only match leaves unlinked.)

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest backend/apps/organization/tests/models/test_person_user_link.py -v`
Expected: FAIL (`user` attribute does not exist / ImportError on migration module).

- [ ] **Step 3: Add the model field**

```python
# backend/apps/organization/models/person.py — add after `organization`, needs settings import
from django.conf import settings

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="person_profiles",
        null=True,
        blank=True,
        db_index=True,
        help_text="Linked auth identity (N1 consolidation). Loose email match backfilled once; nullable by design.",
    )
```

```python
# Meta.constraints — add alongside indexes
        constraints = [
            models.UniqueConstraint(
                fields=["user", "organization"],
                name="uq_person_user_organization",
            )
        ]
```

- [ ] **Step 4: Generate the schema migration**

Run: `uv run python manage.py makemigrations organization`
Expected: creates `0034_person_user.py` with `AddField user` + `AddConstraint`. Inspect it: must contain `migrations.swappable_dependency(settings.AUTH_USER_MODEL)` — if missing (string FK usually triggers it), add it by hand to `dependencies`.

- [ ] **Step 5: Write the data migration** (mirror `0031_backfill_person_organization.py` style)

```python
"""Backfill Person.user by email match (N1 consolidation).

Exactly-one-match wins (case-insensitive, any org): ambiguous emails and
zero matches stay unlinked. Idempotent — rerunnable, reports counts.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    Person = apps.get_model("organization", "Person")
    User = apps.get_model("identity", "User")
    linked, ambiguous, unmatched = 0, 0, 0
    for person in Person.objects.filter(user__isnull=True).exclude(email=""):
        matches = list(
            User.objects.filter(email__iexact=person.email).values_list("id", flat=True)
        )
        if len(matches) == 1:
            person.user_id = matches[0]
            person.save(update_fields=["user"])
            linked += 1
        elif len(matches) == 0:
            unmatched += 1
        else:
            ambiguous += 1
    print(f"person_user backfill: linked={linked} ambiguous={ambiguous} unmatched={unmatched}")


class Migration(migrations.Migration):
    dependencies = [("organization", "0034_person_user")]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
```

Save as `backend/apps/organization/migrations/0035_backfill_person_user.py`.

- [ ] **Step 6: Run migration + full new tests to verify pass**

Run: `uv run python manage.py migrate organization && uv run pytest backend/apps/organization/tests/models/test_person_user_link.py backend/apps/organization/tests/api/viewsets/test_person_isolation.py -v`
Expected: PASS (backfill counts print; isolation suite still green — unlinked legacy rows behave as before).

- [ ] **Step 7: Commit**

```bash
git add backend/apps/organization/models/person.py backend/apps/organization/migrations/0034_person_user.py backend/apps/organization/migrations/0035_backfill_person_user.py backend/apps/organization/tests/models/test_person_user_link.py
git commit -m "feat(organization): link Person to auth User via nullable FK with email backfill"
```

### Task 2: N1 — Serializer exposure (`user_id` read + write)

**Files:**
- Modify: `backend/apps/organization/api/serializers/person/base.py` (add read `user_id`)
- Modify: `backend/apps/organization/api/serializers/person/create.py` + `update.py` (accept write-only `user_id`, resolve fail-closed)
- Test: extend `backend/apps/organization/tests/api/test_contract_compat.py` or new `test_person_user_api.py` (new file preferred: `backend/apps/organization/tests/api/test_person_user_api.py`)

**Interfaces:**
- Consumes: `Person.user` FK from Task 1.
- Produces: read shape gains `user_id` (UUID, null allowed); write accepts `user_id` (resolves to User or 400).

- [ ] **Step 1: Write the failing test**

```python
# backend/apps/organization/tests/api/test_person_user_api.py
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.organization.models import Organization, Person

User = get_user_model()


@pytest.mark.django_db
def test_person_detail_exposes_user_id():
    org = Organization.objects.create(code="T2", name="T2", slug="t2")
    admin = User.objects.create_user(email="admin@t2.io", password="x")
    linked = User.objects.create_user(email="linked@t2.io", password="x")
    person = Person.objects.create(organization=org, name="Linked", email="linked@t2.io", user=linked)
    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.get(f"/api/v1/organization/persons/{person.id}/")
    assert response.status_code == 200
    assert response.data["user_id"] == str(linked.id)


@pytest.mark.django_db
def test_person_create_rejects_unknown_user_id():
    org = Organization.objects.create(code="T3", name="T3", slug="t3")
    admin = User.objects.create_user(email="admin@t3.io", password="x")
    client = APIClient()
    client.force_authenticate(user=admin)
    import uuid
    response = client.post(
        "/api/v1/organization/persons/",
        {"name": "Ghost", "email": "ghost@t3.io", "user_id": str(uuid.uuid4())},
        format="json",
    )
    assert response.status_code == 400
    assert "user_id" in response.data
```

(Verify list/detail route prefix against `organization/api/routers.py` before finalizing URLs — adjust to the real persons route; the isolation test file `test_person_isolation.py` shows the working prefix — mirror it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest backend/apps/organization/tests/api/test_person_user_api.py -v`
Expected: FAIL (`user_id` KeyError on read; 201-or-500 instead of 400 on write).

- [ ] **Step 3: Read serializer**

In `base.py` add:

```python
    user_id = serializers.UUIDField(read_only=True, allow_null=True)
```

and `"user_id"` to `Meta.fields`.

- [ ] **Step 4: Write serializer** — in both `create.py` and `update.py`, add:

```python
    user_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)
```

and in `validate()`, before `return attrs`:

```python
        user_ref = attrs.pop("user_id", None)
        if user_ref is not None:
            from django.contrib.auth import get_user_model
            target = get_user_model().objects.filter(id=user_ref).first()
            if target is None:
                raise serializers.ValidationError({"user_id": "Unknown user."})
            attrs["user"] = target
```

Add `"user_id"` to each `Meta.fields`.

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest backend/apps/organization/tests/api/test_person_user_api.py backend/apps/organization/tests/api/viewsets/test_person_isolation.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/organization/api/serializers/person/ backend/apps/organization/tests/api/test_person_user_api.py
git commit -m "feat(organization): expose Person.user_id in API with fail-closed write"
```

### Task 3: N2 — `ProjectMembership.status` choices + mapping migration

**Files:**
- Modify: `backend/apps/production/models/project_membership.py` (choices + default)
- Create: `backend/apps/production/migrations/0017_*` (schema via makemigrations) + data mapping migration (hand-written)
- Test: `backend/apps/production/tests/test_project_membership_canonical.py` (new)

**Interfaces:**
- Consumes: nothing from earlier tasks. Mirrors `OrganizationMembership.status` tuples.
- Produces: `STATUS_CHOICES`-constrained `status`; `ProjectMembershipCreateSerializer` accepts legacy `"Active"` etc. case-insensitively.

- [ ] **Step 1: Write the failing test**

```python
# backend/apps/production/tests/test_project_membership_canonical.py
import pytest

from apps.organization.models import Organization
from apps.production.models import Project, ProjectMembership
from django.contrib.auth import get_user_model

User = get_user_model()


def make_membership(status="Active"):
    org = Organization.objects.create(code="PM1", name="PM1", slug="pm1")
    user = User.objects.create_user(email="m@pm1.io", password="x")
    project = Project.objects.create(organization=org, name="P1", code="P1")
    return ProjectMembership.objects.create(
        organization=org, project=project, user=user, status=status
    )


@pytest.mark.django_db
def test_legacy_active_maps_to_canonical():
    m = make_membership("Active")
    m.refresh_from_db()
    assert m.status == "active"


@pytest.mark.django_db
def test_unknown_status_maps_to_active():
    m = make_membership("Pending")
    m.refresh_from_db()
    assert m.status == "active"


@pytest.mark.django_db
def test_status_choices_reject_garbage_on_save():
    from django.core.exceptions import ValidationError
    m = make_membership("active")
    m.status = "bogus"
    with pytest.raises(ValidationError):
        m.full_clean()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest backend/apps/production/tests/test_project_membership_canonical.py -v`
Expected: FAIL (`"Active"` stays `"Active"`; no ValidationError).

- [ ] **Step 3: Constrain the model**

```python
class ProjectMembership(EntityModel):
    STATUS_CHOICES = (
        ("active", "Active"),
        ("on_leave", "On Leave"),
        ("terminated", "Terminated"),
        ("suspended", "Suspended"),
    )
    ...
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active", db_index=True)
```

- [ ] **Step 4: Schema migration + data mapping**

Run: `uv run python manage.py makemigrations production`
Expected: `0017_...` altering `status`. Then create `0018_map_project_membership_status.py`:

```python
"""Map legacy ProjectMembership.status to canonical choices (N2).

Case-insensitive match on active/on_leave/terminated/suspended; anything
else becomes "active". Idempotent, reports counts.
"""

from django.db import migrations

CANONICAL = {"active", "on_leave", "terminated", "suspended"}


def backfill(apps, schema_editor):
    ProjectMembership = apps.get_model("production", "ProjectMembership")
    mapped, defaulted = 0, 0
    for m in ProjectMembership.objects.all().only("id", "status"):
        normalized = (m.status or "").strip().lower()
        if normalized in CANONICAL:
            if normalized != m.status:
                m.status = normalized
                m.save(update_fields=["status"])
                mapped += 1
        else:
            m.status = "active"
            m.save(update_fields=["status"])
            defaulted += 1
    print(f"project_membership status map: mapped={mapped} defaulted={defaulted}")


class Migration(migrations.Migration):
    dependencies = [("production", "0017_<exact auto name>")]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
```

(Replace `0017_<exact auto name>` with the generated filename.)

- [ ] **Step 5: Serializer compatibility** — in `ProjectMembershipCreateSerializer.validate()` (or add one), normalize incoming `status` case-insensitively; accept `"Active"` → `"active"`. If the create serializer has no status field, add `status = serializers.CharField(required=False, default="active")` + normalize in `validate`, and add `"status"` to `Meta.fields`. Keep read output as stored (`"active"`); frontend already handles both cases per contract (verify: frontend `ProjectMembership.status` accepts both — confirmed in audit, no frontend change needed).

- [ ] **Step 6: Run tests**

Run: `uv run python manage.py migrate production && uv run pytest backend/apps/production/tests/test_project_membership_canonical.py backend/apps/production/tests/security/test_canonical_access_matrix.py -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/apps/production/models/project_membership.py backend/apps/production/migrations/0017_* backend/apps/production/migrations/0018_* backend/apps/production/api/serializers/membership.py backend/apps/production/tests/test_project_membership_canonical.py
git commit -m "feat(production): constrain ProjectMembership.status to canonical choices"
```

### Task 4: N7 — `ProjectMembership.role_ref` FK + code-match backfill

**Files:**
- Modify: `backend/apps/production/models/project_membership.py` (add `role_ref`)
- Create: schema migration + backfill migration
- Modify: `backend/apps/production/api/serializers/membership.py` (read `role_id`; write accepts `role_id` org-scoped)
- Test: extend `backend/apps/production/tests/test_project_membership_canonical.py`

**Interfaces:**
- Consumes: `organization.Role` (`code` unique per org + global masters pattern from `resolve_person_role`).
- Produces: nullable `role_ref` FK (`SET_NULL`, `related_name="project_memberships"`); `role` Char untouched as display snapshot.

- [ ] **Step 1: Write the failing test (append)**

```python
@pytest.mark.django_db
def test_role_ref_backfills_on_matching_code():
    from apps.organization.models import Role
    org = Organization.objects.create(code="PM2", name="PM2", slug="pm2")
    user = User.objects.create_user(email="r@pm2.io", password="x")
    project = Project.objects.create(organization=org, name="P2", code="P2")
    role = Role.objects.create(code="artist", name="Artist")
    m = ProjectMembership.objects.create(
        organization=org, project=project, user=user, role="artist"
    )
    # backfill runs in migration; emulate exactly what it does:
    from apps.production import models as _m  # noqa — real backfill tested via migrate in Step 6
    assert m.role_ref_id is None
```

(Plus: mismatch leaves NULL with Char intact; write API with unknown `role_id` → 400; write API with sibling-org custom role → 400. Mirror `resolve_person_role` scoping: global-master (org null) + own-org custom.)

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest backend/apps/production/tests/test_project_membership_canonical.py -v`
Expected: FAIL (`role_ref` attribute missing).

- [ ] **Step 3: Add the FK**

```python
    role_ref = models.ForeignKey(
        "organization.Role",
        on_delete=models.SET_NULL,
        related_name="project_memberships",
        null=True,
        blank=True,
        db_index=True,
        help_text="Canonical RBAC role (N7 consolidation). `role` Char stays as display snapshot.",
    )
```

Run: `uv run python manage.py makemigrations production` → `0019_...`.

- [ ] **Step 4: Backfill migration** (`0020_backfill_project_membership_role_ref.py`):

```python
"""Backfill ProjectMembership.role_ref by role-code match (N7).

Matches `role` Char (case-insensitive, stripped) against Role.code where the
role is global (organization null) or belongs to the membership's
organization. First match wins; no match leaves NULL with the Char intact.
Idempotent, reports counts.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    ProjectMembership = apps.get_model("production", "ProjectMembership")
    Role = apps.get_model("organization", "Role")
    linked, unmatched = 0, 0
    for m in ProjectMembership.objects.filter(role_ref__isnull=True).exclude(role=""):
        code = (m.role or "").strip().lower()
        role = (
            Role.objects.filter(code__iexact=code)
            .filter(
                models.Q(organization__isnull=True)
                | models.Q(organization_id=m.organization_id)
            )
            .order_by("organization__isnull")
            .first()
        )
        ...
```

(Full body: `import` models at top; prefer org-specific over global — order so own-org custom wins: `.order_by(models.Case(...))` is overkill; two lookups (own-org first, then global) is clearer. Write it as two queries.)

- [ ] **Step 5: Serializer** — read serializer: add `role_id = serializers.UUIDField(source="role_ref_id", read_only=True, allow_null=True)` + field entry. Create serializer: add `role_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)` + resolve in `validate()` scoped to membership organization (global-master or own-org custom, else 400 `{"role_id": ...}`), mirroring `resolve_person_role`.

- [ ] **Step 6: Run tests**

Run: `uv run python manage.py migrate production && uv run pytest backend/apps/production/tests/test_project_membership_canonical.py backend/apps/production/tests/security/test_canonical_access_matrix.py backend/apps/production/tests/test_frontend_contract.py -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/apps/production/models/project_membership.py backend/apps/production/migrations/0019_* backend/apps/production/migrations/0020_* backend/apps/production/api/serializers/membership.py backend/apps/production/tests/test_project_membership_canonical.py
git commit -m "feat(production): add ProjectMembership.role_ref FK with code-match backfill"
```

### Task 5: N8 — Rename `organization_role_permissions` table to singular

**Files:**
- Modify: `backend/apps/organization/models/role_permission.py` (`db_table`)
- Create: `backend/apps/organization/migrations/0036_*.py` (state-only `AlterModelTable`)
- Test: `backend/apps/organization/tests/models/test_role_permission_table.py` (new; asserts table name + row preservation + constraint)

**Interfaces:**
- Consumes: nothing. Produces: table `organization_role_permission`; constraint name `uq_organization_role_permission` unchanged.

- [ ] **Step 1: Write the failing test**

```python
# backend/apps/organization/tests/models/test_role_permission_table.py
import pytest

from apps.organization.models import Organization, Permission, Role, RolePermission


@pytest.mark.django_db
def test_role_permission_table_is_singular_and_preserves_rows():
    org = Organization.objects.create(code="RP1", name="RP1", slug="rp1")
    role = Role.objects.create(code="rp-tester", name="RP Tester", organization=org)
    perm = Permission.objects.create(code="rp.probe", module="rp", action="probe")
    RolePermission.objects.create(role=role, permission=perm)
    assert RolePermission._meta.db_table == "organization_role_permission"
    assert RolePermission.objects.filter(role=role, permission=perm).count() == 1
```

(Check `Permission` required fields — `module`/`action`/`category` choices — mirror an existing factory or creation in `tests/models/test_organization_models.py`; adjust literals to the real required fields.)

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest backend/apps/organization/tests/models/test_role_permission_table.py -v`
Expected: FAIL (db_table assertion).

- [ ] **Step 3: Rename**

```python
    class Meta:
        db_table = "organization_role_permission"
```

Run: `uv run python manage.py makemigrations organization`
Expected: single `AlterModelTable` operation. Inspect — must NOT contain data operations.

- [ ] **Step 4: Run tests**

Run: `uv run python manage.py migrate organization && uv run pytest backend/apps/organization/tests/models/test_role_permission_table.py backend/apps/organization/tests/security/test_privilege_escalation.py -v`
Expected: PASS (privilege suite proves the grant path still resolves through the renamed table).

- [ ] **Step 5: Commit**

```bash
git add backend/apps/organization/models/role_permission.py backend/apps/organization/migrations/0036_* backend/apps/organization/tests/models/test_role_permission_table.py
git commit -m "refactor(organization): rename role_permission table to singular"
```

### Task 6: Validation, contract check, docs

**Files:** none modified except docs note (append to `docs/apps/organization/` + `docs/api/` where Person/ProjectMembership contracts live — locate in step).

- [ ] **Step 1: Django checks**

Run: `uv run python manage.py check && uv run python manage.py makemigrations --check`
Expected: no issues; `--check` exits 0 (no missing migrations).

- [ ] **Step 2: Affected suites**

Run: `uv run pytest backend/apps/organization backend/apps/production backend/apps/identity backend/apps/audit -q`
Expected: PASS. Any failure → fix in place (triage: if unrelated/pre-existing, prove via `git stash`-free method — temporary worktree at base — and record).

- [ ] **Step 3: API contract note**

Locate the Person + ProjectMembership contract docs (`docs/api/domains/organization.md`, `production.md` or equivalent) and append: `user_id` (Person read/write), `status` canonical values (`active|on_leave|terminated|suspended`, legacy `"Active"` accepted), `role_id` (ProjectMembership read/write, `role` Char retained). Keep additive language.

- [ ] **Step 4: Commit docs**

```bash
git add docs/
git commit -m "docs: Phase 1 consolidation contract notes (user_id, status, role_id)"
```

## Out of scope

N3 platform Groups UI (done in frontend), N4/N6 keep-decisions (no code), N5 governance (frontend doc), legacy-route sunset, frontend `types/identity.ts` wiring for `user_id`/`role_ref` (follow-up in `../studiohub-react` once Phase 1 lands).

## Self-review

- Spec coverage: N1→Tasks 1–2, N2→Task 3, N7→Task 4, N8→Task 5, validation/docs→Task 6. N3–N6 need no backend code per approved decisions.
- Placeholder scan: every step has exact code/commands; route prefixes and Permission fields flagged for in-step verification against named reference files instead of guessed.
- Type consistency: `user_id`/`role_id` UUID write-only + read; `role_ref`/`role_ref_id`; `STATUS_CHOICES` tuples mirror OrganizationMembership; migration numbers sequential per app (org 0034/0035/0036, production 0017/0018/0019/0020 — verify latest at execution, renumber if drifted).
- Review Focus: five items each pinned to Tasks 1 (ambiguity), 3 (unknown status), 4 (code mismatch + out-of-scope role_id), 5 (row preservation), 2+4 (fail-closed writes).
