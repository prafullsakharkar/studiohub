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


# --- docs/sync CR-02: codes the views enforce must exist and be assignable --------------------

ENFORCED_BUT_FORMERLY_UNSEEDED = {
    "settings.view",
    "identity.user.activate",
    "identity.user.deactivate",
    "identity.user.archive",
    "identity.user.restore",
    "identity.user.reset_password",
    "identity.user.change_password",
    "identity.security_event.view",
    "identity.security_event.create",
    "identity.login_history.view",
    "identity.login_attempt.view",
    "identity.login_attempt.create",
    "identity.ip_blacklist.view",
    "identity.ip_blacklist.create",
    "identity.ip_blacklist.update",
    "identity.ip_blacklist.delete",
    "identity.profile.delete",
    "identity.trusted_device.delete",
}

# Held by org-admin: account lifecycle, read-only ledgers, settings.view.
ORG_ADMIN_IDENTITY = {
    "settings.view",
    "identity.user.activate",
    "identity.user.deactivate",
    "identity.user.archive",
    "identity.user.restore",
    "identity.user.reset_password",
    "identity.user.change_password",
    "identity.security_event.view",
    "identity.login_history.view",
    "identity.login_attempt.view",
    "identity.ip_blacklist.view",
}


def _codes_of(role_code):
    from apps.identity.models import Role, RolePermission

    role = Role.objects.get(code=role_code)
    return set(
        RolePermission.objects.filter(role=role).values_list("permission__code", flat=True)
    )


def test_every_enforced_identity_and_settings_code_is_seeded(db, seeded_platform_module):
    from apps.identity.models import Permission

    seeded = set(Permission.objects.values_list("code", flat=True))
    assert ENFORCED_BUT_FORMERLY_UNSEEDED <= seeded


def test_platform_admin_holds_all_of_them(db, seeded_platform_module):
    assert ENFORCED_BUT_FORMERLY_UNSEEDED <= _codes_of("platform-admin")


def test_org_admin_holds_lifecycle_and_read_only_ledgers_but_not_ledger_writes(db, seeded_platform_module):
    held = _codes_of("org-admin")
    assert ORG_ADMIN_IDENTITY <= held
    # Writing to the ledgers and the IP blacklist is platform-admin only.
    assert not (
        {
            "identity.ip_blacklist.create",
            "identity.ip_blacklist.update",
            "identity.ip_blacklist.delete",
            "identity.login_attempt.create",
            "identity.security_event.create",
            "identity.profile.delete",
            "identity.trusted_device.delete",
        }
        & held
    )


def test_production_admin_can_view_settings_but_nothing_else_new(db, seeded_platform_module):
    held = _codes_of("production-admin")
    assert "settings.view" in held
    assert not ((ENFORCED_BUT_FORMERLY_UNSEEDED - {"settings.view"}) & held)


def test_other_roles_hold_none_of_them(db, seeded_platform_module):
    for role in ("org-member", "vfx-supervisor", "lead-artist", "artist"):
        assert not (ENFORCED_BUT_FORMERLY_UNSEEDED & _codes_of(role)), role
