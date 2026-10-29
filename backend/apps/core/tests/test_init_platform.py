from django.core.management import call_command

from apps.core.management.commands.init_platform import (
    DEPARTMENT_SPECS,
    OFFICE_SPECS,
    PERMISSION_SPECS,
    POSITION_SPECS,
    ROLE_SPECS,
    STATUS_SPECS,
    TEAM_SPECS,
)


def _counts():
    from apps.identity.models import Permission, Role
    from apps.masterdata.models import (
        Department,
        MasterStatus,
        Office,
        Position,
        Team,
    )

    return {
        "permissions": Permission.objects.count(),
        "roles": Role.objects.count(),
        "statuses": MasterStatus.objects.count(),
        "departments": Department.objects.count(),
        "teams": Team.objects.count(),
        "offices": Office.objects.count(),
        "positions": Position.objects.count(),
    }


# The first run is the shared ``seeded_platform_module`` fixture (conftest.py), so a failing first
# run errors every test here; each test below starts from that seed.


def test_init_platform_is_idempotent(db, seeded_platform_module):
    call_command("init_platform")


def test_init_platform_seeds_expected_rows(db, seeded_platform_module):
    counts = _counts()
    assert counts["permissions"] == len(PERMISSION_SPECS)
    assert counts["roles"] == len(ROLE_SPECS)
    assert counts["statuses"] == len(STATUS_SPECS)
    assert counts["departments"] == len(DEPARTMENT_SPECS)
    assert counts["teams"] == len(TEAM_SPECS)
    assert counts["offices"] == len(OFFICE_SPECS)
    assert counts["positions"] == len(POSITION_SPECS)


def test_init_platform_second_run_adds_nothing(db, seeded_platform_module):
    before = _counts()
    call_command("init_platform")
    assert _counts() == before


def test_init_platform_grants_role_permissions(db, seeded_platform_module):
    from apps.identity.models import Role, RolePermission

    artist = Role.objects.get(code="artist")
    granted = set(
        RolePermission.objects.filter(role=artist).values_list(
            "permission__code", flat=True
        )
    )
    assert {"project.view", "shot.view", "task.view"} <= granted
