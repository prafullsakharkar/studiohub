"""
Seed-system tests for seed_studiohub (§28).

Hermetic: STUDIOHUB_REACT_MOCKS points at a tiny fixture tree (no node
needed — plain JSON-compatible arrays), --skip-base avoids the foundation.
Covers idempotency, relationships, org/project isolation, user access,
soft-delete restore, mock compatibility, and dry-run safety.
"""

import json
from pathlib import Path

import pytest
from django.core.management import CommandError, call_command

from apps.core.management.commands.seed_studiohub import SeedReporter
from apps.organization.models import Organization, OrganizationMembership
from apps.production.models import Project, ProjectMembership, Sequence, Shot


def _write_fixture_root(tmp_path):
    root = Path(tmp_path) / "mocks" / "db"
    files = {
        "organization/organization.ts": (
            "mockOrganizations",
            [
                {"id": "org-t1", "code": "TST1", "name": "Test One",
                 "slug": "test-one", "status": "Active"},
                {"id": "org-t2", "code": "TST2", "name": "Test Two",
                 "slug": "test-two", "status": "Active"},
            ],
        ),
        "identity/users.ts": (
            "mockUsers",
            [
                {"id": "usr-t1", "email": "alpha@example.com",
                 "first_name": "Alpha", "last_name": "One",
                 "full_name": "Alpha One",
                 "memberships": [{"organization_id": "org-t1", "role": "Artist"}],
                 "project_memberships": [
                     {"projectId": "proj-t1", "role": "Artist",
                      "roles": ["Artist"], "scope": "PROJECT", "status": "Active"}
                 ]},
                {"id": "usr-t2", "email": "beta@example.com",
                 "first_name": "Beta", "last_name": "Two",
                 "full_name": "Beta Two",
                 "memberships": [{"organization_id": "org-t2", "role": "Viewer"}],
                 "project_memberships": []},
            ],
        ),
        "production/projects.ts": (
            "mockProjects",
            [
                {"id": "proj-t1", "code": "PRJ1", "name": "Project One",
                 "organization_id": "org-t1", "status": "In Progress",
                 "type": "Feature Film"},
                {"id": "proj-t2", "code": "PRJ2", "name": "Project Two",
                 "organization_id": "org-t2", "status": "In Progress",
                 "type": "Feature Film"},
            ],
        ),
        "production/sequences.ts": (
            "mockSequences",
            [
                {"id": "seq-t1", "project_id": "proj-t1",
                 "project_code": "PRJ1", "code": "SEQ-T1", "name": "Seq One",
                 "status": "In Progress", "department": "Comp"},
                {"id": "seq-t2", "project_id": "proj-t1",
                 "project_code": "PRJ1", "code": "SEQ-T2", "name": "Seq Archived",
                 "status": "Archived", "is_deleted": True},
            ],
        ),
        "production/shots.ts": (
            "mockShots",
            [
                {"id": "shot-t1", "project_id": "proj-t1",
                 "project_code": "PRJ1", "code": "SH-T1", "name": "Shot One",
                 "status": "In Progress"},
            ],
        ),
        "production/notes.ts": (
            "mockProjectNotes",
            [
                {"project_id": "proj-t1", "project_code": "PRJ1",
                 "subject": "Note One", "body": "Hello",
                 "entity_type": "Project", "category": "General"},
            ],
        ),
        "production/editorial.ts": (
            "mockEditorialCuts",
            [
                {"project_id": "proj-t1", "project_code": "PRJ1",
                 "code": "CUT-T1", "name": "Cut One"},
            ],
        ),
    }
    for rel, (var, items) in files.items():
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"export const {var} = {json.dumps(items)};\n")
    return root


@pytest.fixture
def mock_root(tmp_path, monkeypatch):
    root = _write_fixture_root(tmp_path)
    monkeypatch.setenv("STUDIOHUB_REACT_MOCKS", str(root))
    return root


def _seed(**kwargs):
    kwargs.setdefault("force", True)
    kwargs.setdefault("skip_base", True)
    kwargs.setdefault("skip_validate", True)
    kwargs.setdefault("verbosity", 0)
    call_command("seed_studiohub", **kwargs)


@pytest.mark.django_db
class TestSeedStudiohub:
    def test_overlay_seeds_expected_rows(self, mock_root):
        _seed()
        assert Organization.objects.filter(code__in=["TST1", "TST2"]).count() == 2
        assert Project.objects.filter(code__in=["PRJ1", "PRJ2"]).count() == 2
        assert Sequence.objects.filter(code__in=["SEQ-T1", "SEQ-T2"]).count() == 1
        # Mock-archived row preserved as soft-deleted (§25 fixture).
        archived = Sequence.all_objects.filter(code="SEQ-T2").first()
        assert archived is not None
        assert archived.is_deleted is True
        assert Shot.objects.filter(code="SH-T1").count() == 1
        # Users + mock-driven memberships only (§9, §22).
        from django.contrib.auth import get_user_model

        assert get_user_model().objects.filter(email="alpha@example.com").exists()
        assert get_user_model().objects.filter(email="beta@example.com").exists()
        alpha_memberships = OrganizationMembership.objects.filter(
            user__email="alpha@example.com"
        )
        assert {m.organization.code for m in alpha_memberships} == {"TST1"}
        assert ProjectMembership.objects.filter(
            user__email="alpha@example.com", project__code="PRJ1"
        ).exists()
        # Beta has no project memberships in mock: none created.
        assert not ProjectMembership.objects.filter(
            user__email="beta@example.com"
        ).exists()

    def test_idempotent_double_run(self, mock_root):
        _seed()

        def snapshot():
            from django.contrib.auth import get_user_model

            return {
                "orgs": Organization.objects.count(),
                "projects": Project.objects.count(),
                "sequences": Sequence.all_objects.count(),
                "shots": Shot.objects.count(),
                "users": get_user_model().objects.count(),
                "memberships": OrganizationMembership.objects.count(),
                "pmemberships": ProjectMembership.objects.count(),
            }

        before = snapshot()
        _seed()
        assert snapshot() == before

    def test_soft_deleted_rows_restored(self, mock_root):
        _seed()
        Sequence.objects.filter(code="SEQ-T1").update(is_deleted=True)
        assert Sequence.objects.filter(code="SEQ-T1").count() == 0
        _seed()
        assert Sequence.objects.filter(code="SEQ-T1").count() == 1
        restored = Sequence.objects.filter(code="SEQ-T1").first()
        assert restored.is_deleted is False

    def test_project_isolation(self, mock_root):
        _seed()
        prj1 = Project.objects.get(code="PRJ1")
        prj2 = Project.objects.get(code="PRJ2")
        assert prj1.organization.code == "TST1"
        assert prj2.organization.code == "TST2"
        assert Sequence.objects.filter(project=prj1).count() == 1
        assert Sequence.objects.filter(project=prj2).count() == 0
        assert Shot.objects.filter(project=prj2).count() == 0

    def test_dry_run_writes_nothing(self, mock_root):
        _seed()
        from django.contrib.auth import get_user_model

        before = {
            "orgs": Organization.objects.count(),
            "projects": Project.objects.count(),
            "users": get_user_model().objects.count(),
        }
        _seed(dry_run=True)
        after = {
            "orgs": Organization.objects.count(),
            "projects": Project.objects.count(),
            "users": get_user_model().objects.count(),
        }
        assert before == after

    def test_validate_only_passes_on_clean_seed(self, mock_root):
        _seed()
        call_command("seed_studiohub", validate_only=True, verbosity=0)

    def test_validate_only_fails_on_cross_org_row(self, mock_root):
        _seed()
        org_a = Organization.objects.get(code="TST1")
        prj_b = Project.objects.get(code="PRJ2")
        Shot.objects.create(
            organization=org_a, project=prj_b, code="SH-X1", name="Cross"
        )
        with pytest.raises(CommandError):
            call_command("seed_studiohub", validate_only=True, verbosity=0)

    def test_reporter_summary_format(self):
        reporter = SeedReporter()
        reporter.add("projects", "created", 2)
        reporter.add("projects", "updated", 3)
        reporter.add("shots", "skipped", 1)
        summary = reporter.summary()
        assert "StudioHub Seed Summary" in summary
        assert "created: 2" in summary
        assert "Errors: 0" in summary

    def test_scoped_phases(self, mock_root):
        call_command(
            "seed_studiohub", force=True, skip_base=True, skip_validate=True,
            organizations=True, verbosity=0,
        )
        assert Organization.objects.filter(code="TST1").exists()
        assert Project.objects.count() == 0
        call_command(
            "seed_studiohub", force=True, skip_base=True, skip_validate=True,
            production=True, verbosity=0,
        )
        assert Project.objects.filter(code="PRJ1").exists()
