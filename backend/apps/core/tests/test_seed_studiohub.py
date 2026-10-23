"""
Seed-system tests for seed_studiohub (§28).

Hermetic: STUDIOHUB_REACT_MOCKS points at a tiny fixture tree (no node
needed — plain JSON-compatible arrays), --skip-base avoids the foundation.
Covers idempotency, relationships, project isolation, user access,
soft-delete restore, mock compatibility, and dry-run safety.

Org-free (org-removal B6): no organizations or org memberships are seeded;
roles resolve through platform-global ``UserRole`` rows.
"""

import json
from pathlib import Path

import pytest
from django.core.management import CommandError, call_command

from apps.core.management.commands.seed_studiohub import SeedReporter
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
                 "avatar_url": "https://example.com/alpha.png",
                 "is_active": True, "is_staff": True, "is_superuser": True,
                 "project_memberships": [
                     {"projectId": "proj-t1", "role": "Artist",
                      "roles": ["Artist"], "scope": "PROJECT", "status": "Active"}
                 ]},
                {"id": "usr-t2", "email": "beta@example.com",
                 "first_name": "Beta", "last_name": "Two",
                 "full_name": "Beta Two",
                 "avatar_url": "https://example.com/beta.png",
                 "is_active": True, "is_staff": False, "is_superuser": False,
                 "project_memberships": []},
            ],
        ),
        "production/projects.ts": (
            "mockProjects",
            [
                {"id": "proj-t1", "code": "PRJ1", "name": "Project One",
                 "status": "In Progress", "type": "Feature Film"},
                {"id": "proj-t2", "code": "PRJ2", "name": "Project Two",
                 "status": "In Progress", "type": "Feature Film"},
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
        assert Project.objects.filter(code__in=["PRJ1", "PRJ2"]).count() == 2
        assert Sequence.objects.filter(code__in=["SEQ-T1", "SEQ-T2"]).count() == 1
        # Mock-archived row preserved as soft-deleted (§25 fixture).
        archived = Sequence.all_objects.filter(code="SEQ-T2").first()
        assert archived is not None
        assert archived.is_deleted is True
        assert Shot.objects.filter(code="SH-T1").count() == 1
        # Users + mock-driven project memberships only (§9, §22).
        from django.contrib.auth import get_user_model

        assert get_user_model().objects.filter(email="alpha@example.com").exists()
        assert get_user_model().objects.filter(email="beta@example.com").exists()
        assert ProjectMembership.objects.filter(
            user__email="alpha@example.com", project__code="PRJ1"
        ).exists()
        # Beta has no project memberships in mock: none created.
        assert not ProjectMembership.objects.filter(
            user__email="beta@example.com"
        ).exists()

    def test_user_data_syncs_to_mock(self, mock_root):
        """§9: user/profile fields must match the mock source of truth."""
        from django.contrib.auth import get_user_model

        from apps.identity.models import Profile

        _seed()
        alpha = get_user_model().objects.get(email="alpha@example.com")
        # Account flags reconciled from mock.
        assert (alpha.is_active, alpha.is_staff, alpha.is_superuser) == (
            True, True, True,
        )
        # Profile names + avatar_url reconciled from mock.
        profile = Profile.objects.get(user=alpha)
        assert profile.first_name == "Alpha"
        assert profile.last_name == "One"
        assert profile.display_name == "Alpha One"
        assert profile.avatar_url == "https://example.com/alpha.png"

        beta = get_user_model().objects.get(email="beta@example.com")
        assert (beta.is_active, beta.is_staff, beta.is_superuser) == (
            True, False, False,
        )

    def test_user_sync_is_idempotent(self, mock_root):
        """Re-running the overlay leaves synced fields unchanged."""
        from django.contrib.auth import get_user_model

        from apps.identity.models import Profile

        _seed()

        def snapshot():
            alpha = get_user_model().objects.get(email="alpha@example.com")
            profile = Profile.objects.get(user=alpha)
            return (
                alpha.is_staff, alpha.is_superuser,
                profile.first_name, profile.avatar_url,
            )

        before = snapshot()
        _seed()
        assert snapshot() == before

    def test_idempotent_double_run(self, mock_root):
        _seed()

        def snapshot():
            from django.contrib.auth import get_user_model

            return {
                "projects": Project.objects.count(),
                "sequences": Sequence.all_objects.count(),
                "shots": Shot.objects.count(),
                "users": get_user_model().objects.count(),
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
        assert Sequence.objects.filter(project=prj1).count() == 1
        assert Sequence.objects.filter(project=prj2).count() == 0
        assert Shot.objects.filter(project=prj2).count() == 0

    def test_dry_run_writes_nothing(self, mock_root):
        _seed()
        from django.contrib.auth import get_user_model

        before = {
            "projects": Project.objects.count(),
            "users": get_user_model().objects.count(),
        }
        _seed(dry_run=True)
        after = {
            "projects": Project.objects.count(),
            "users": get_user_model().objects.count(),
        }
        assert before == after

    def test_validate_only_passes_on_clean_seed(self, mock_root):
        _seed()
        call_command("seed_studiohub", validate_only=True, verbosity=0)

    def test_validate_only_fails_on_orphaned_row(self, mock_root):
        _seed()
        from apps.deliveries.models import DeliveryPackage

        DeliveryPackage.objects.create(
            code="DEL-X1", name="Orphaned", project=None
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
        from apps.identity.models import Permission

        assert Permission.objects.filter(code="project.view").exists()
        assert Project.objects.count() == 0
        call_command(
            "seed_studiohub", force=True, skip_base=True, skip_validate=True,
            production=True, verbosity=0,
        )
        assert Project.objects.filter(code="PRJ1").exists()

    def test_platform_phase_seeds_masterdata(self, mock_root):
        # Extend the fixture with the masterdata mock source.
        master_dir = mock_root / "masterData"
        master_dir.mkdir(parents=True, exist_ok=True)
        (master_dir / "initialMasterData.ts").write_text(
            'export const mockGlobalSoftware = [{"id":"sw-t1","code":"SW1","name":"Soft",'
            '"vendor":"V","category":"","scope":"GLOBAL"}];\n'
            'export const mockCustomSoftware = [];\n'
            'export const mockSoftwareVersions = [];\n'
            'export const mockCustomSoftwareVersions = [];\n'
            'export const mockMasterStatuses = [{"id":"st-t1","code":"todo","name":"Todo",'
            '"entity_type":"Task","category":"","color":"","order":0,"is_default":false,'
            '"is_final":false,"status":"active","scope":"GLOBAL"}];\n'
            'export const mockMasterTaskTypes = [{"id":"tt-t1","code":"anim",'
            '"name":"Animation","category":"","department_code":"","department_name":"",'
            '"color":"","icon":""}];\n'
            'export const mockMasterAssetTypes = [];\n'
            'export const mockMasterShotTypes = [];\n'
            'export const mockMasterReviewTypes = [];\n'
            'export const mockMasterFileTypes = [];\n'
            'export const mockOrganizationSoftwareConfigs = [];\n'
            'export const mockOrganizationStatusConfigs = [];\n'
        )

        call_command(
            "seed_studiohub", force=True, skip_base=True, skip_validate=True,
            platform=True, verbosity=0,
        )

        from apps.masterdata.models import MasterStatus, MasterTaskType, Software

        assert Software.objects.filter(code="SW1").exists()
        assert MasterStatus.objects.filter(code="todo").exists()
        assert MasterTaskType.objects.filter(code="anim").exists()


_EMPTY_MASTER_ARRAYS = (
    "mockGlobalSoftware",
    "mockCustomSoftware",
    "mockSoftwareVersions",
    "mockCustomSoftwareVersions",
    "mockMasterTaskTypes",
    "mockMasterAssetTypes",
    "mockMasterShotTypes",
    "mockMasterReviewTypes",
    "mockMasterFileTypes",
    "mockOrganizationSoftwareConfigs",
    "mockOrganizationStatusConfigs",
)


@pytest.mark.django_db
class TestSeedMasterdataCatalogRules:
    """seed_demo_data must follow the lookup-catalog rules (Phase 3)."""

    def _write(self, mock_root, statuses, asset_types=(), software=(), versions=()):
        master_dir = mock_root / "masterData"
        master_dir.mkdir(parents=True, exist_ok=True)
        given = {
            "mockMasterAssetTypes": asset_types,
            "mockGlobalSoftware": software,
            "mockSoftwareVersions": versions,
            "mockMasterStatuses": statuses,
        }
        names = [n for n in _EMPTY_MASTER_ARRAYS if n not in given] + ["mockMasterStatuses"]
        lines = [f"export const {name} = [];\n" for name in names if name not in given]
        lines += [
            f"export const {name} = {json.dumps(list(rows))};\n" for name, rows in given.items()
        ]
        (master_dir / "initialMasterData.ts").write_text("".join(lines))

    def _run(self):
        call_command(
            "seed_studiohub",
            force=True,
            skip_base=True,
            skip_validate=True,
            platform=True,
            verbosity=0,
        )

    def test_status_codes_are_kept_per_entity_type_not_renamed(self, mock_root):
        from apps.masterdata.models import MasterStatus

        self._write(
            mock_root,
            [
                {"id": "s1", "code": "in_progress", "name": "In progress", "entity_type": "Task"},
                {"id": "s2", "code": "in_progress", "name": "In progress", "entity_type": "Shot"},
            ],
        )
        self._run()
        self._run()  # idempotent

        rows = MasterStatus.objects.filter(code="in_progress")
        assert sorted(rows.values_list("entity_type", flat=True)) == ["Shot", "Task"]
        assert MasterStatus.objects.count() == 2

    def test_a_second_default_replaces_the_first_instead_of_crashing(self, mock_root):
        from apps.masterdata.models import MasterStatus

        self._write(
            mock_root,
            [
                {"id": "s1", "code": "a", "name": "A", "entity_type": "Task", "is_default": True},
                {"id": "s2", "code": "b", "name": "B", "entity_type": "Task", "is_default": True},
            ],
        )
        self._run()
        assert list(
            MasterStatus.objects.filter(is_default=True).values_list("code", flat=True)
        ) == ["b"]

    def test_legacy_status_words_and_clashing_rows_do_not_crash(self, mock_root):
        from apps.masterdata.models import MasterAssetType

        self._write(
            mock_root,
            [],
            asset_types=[
                {"id": "a1", "code": "prop", "name": "Prop", "status": "inactive"},
                {"id": "a2", "code": "prop2", "name": "PROP"},  # same name, different code: clashes
            ],
        )
        self._run()

        assert MasterAssetType.objects.get(code="prop").status == "archived"
        assert not MasterAssetType.objects.filter(code="prop2").exists()

    def test_software_versions_are_keyed_by_software_and_version_with_derived_names(
        self, mock_root
    ):
        from apps.masterdata.models import Software, SoftwareVersion

        self._write(
            mock_root,
            [],
            software=[{"id": "sw1", "code": "MAYA", "name": "Maya", "status": "Inactive"}],
            versions=[
                {
                    "id": "v1",
                    "software_id": "sw1",
                    "version": "2025",
                    "version_code": "maya-2025",
                    "release_date": "2024-03-01",
                    "end_of_support": "2027-03-01",
                },
                {"id": "v2", "software_id": "sw1", "version": "2026"},
                # end of support before release: reported and skipped, never a crash
                {
                    "id": "v3",
                    "software_id": "sw1",
                    "version": "2024",
                    "release_date": "2024-01-01",
                    "end_of_support": "2023-01-01",
                },
            ],
        )
        self._run()
        self._run()  # idempotent

        maya = Software.objects.get(code="MAYA")
        assert maya.status == "archived"
        versions = {v.version: v for v in SoftwareVersion.objects.filter(software=maya)}
        assert sorted(versions) == ["2025", "2026"]
        assert versions["2025"].code == "maya-2025" and versions["2025"].name == "Maya 2025"
        assert versions["2026"].code == "MAYA-2026" and versions["2026"].name == "Maya 2026"
        assert SoftwareVersion.objects.count() == 2
