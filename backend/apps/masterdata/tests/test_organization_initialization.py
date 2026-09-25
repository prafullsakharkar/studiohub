"""
Organization initialization tests (Phase 9, ADR-0033 D1).

Creating an organization provisions a usable, isolated tenant baseline:
- starter RBAC roles + grants (canonical DEFAULT_ROLE_SPECS)
- organization settings / branding / default work calendar
- master-data org configs mirroring enabled global catalog rows
- organization mutations never mutate global catalog rows
"""

from __future__ import annotations

import pytest

from apps.masterdata.services.initialization import OrganizationInitializationService
from apps.organization.choices import RolePriority, RoleScope
from apps.organization.constants import DEFAULT_ROLE_SPECS
from apps.organization.models import Role, RolePermission
from apps.organization.tests.factories import OrganizationFactory


@pytest.mark.django_db
class TestOrganizationInitialization:
    def test_provisions_starter_roles_with_permissions(self):
        org = OrganizationFactory.create()
        result = OrganizationInitializationService.initialize(org)

        assert result["roles"] == len(DEFAULT_ROLE_SPECS)

        # org-admin is ADMIN-priority org-scoped with full production access
        admin = Role.objects.get(code="org-admin", organization=org)
        assert admin.priority == RolePriority.ADMIN
        assert admin.scope == RoleScope.ORGANIZATION
        admin_codes = set(
            RolePermission.objects.filter(role=admin, granted=True).values_list(
                "permission__code", flat=True
            )
        )
        assert "project.delete" in admin_codes
        assert "organization.update" in admin_codes

        # artist is project-scoped (per D1: does not confer org-wide production)
        artist = Role.objects.get(code="artist", organization=org)
        assert artist.priority == RolePriority.MEMBER
        assert "task.view" in set(
            RolePermission.objects.filter(role=artist, granted=True).values_list(
                "permission__code", flat=True
            )
        )
        assert "organization.delete" not in set(
            RolePermission.objects.filter(role=artist, granted=True).values_list(
                "permission__code", flat=True
            )
        )

    def test_idempotent_reinitialization(self):
        org = OrganizationFactory.create()
        first = OrganizationInitializationService.initialize(org)
        second = OrganizationInitializationService.initialize(org)
        assert first["roles"] == len(DEFAULT_ROLE_SPECS)
        assert second["roles"] == 0
        assert Role.objects.filter(organization=org).count() == len(DEFAULT_ROLE_SPECS)

    def test_provisions_settings_branding_calendar(self):
        from apps.organization.models import Branding, OrganizationSettings, WorkCalendar

        org = OrganizationFactory.create()
        result = OrganizationInitializationService.initialize(org)
        assert result["settings"] == 1
        assert result["branding"] == 1
        assert result["work_calendars"] == 1
        assert OrganizationSettings.objects.filter(organization=org, is_deleted=False).exists()
        assert Branding.objects.filter(organization=org, is_deleted=False).exists()
        assert WorkCalendar.objects.filter(
            organization=org, is_deleted=False, is_default=True
        ).exists()

    def test_master_configs_seed_from_global_catalog(self):
        from apps.masterdata.models import (
            MasterStatus,
            MasterTaskType,
            OrganizationStatusConfig,
            OrganizationTaskTypeConfig,
        )

        org = OrganizationFactory.create()
        # prepare global catalog
        ms1 = MasterStatus.objects.create(code="wip", name="In Progress", status="active")
        MasterStatus.objects.create(code="disabled-x", name="Off", status="archived")
        mt1 = MasterTaskType.objects.create(code="comp", name="Compositing", status="active")

        OrganizationInitializationService.initialize(org)

        cfg_statuses = OrganizationStatusConfig.objects.filter(
            organization=org, enabled=True
        )
        assert cfg_statuses.count() == 1
        assert cfg_statuses.first().status_item_id == ms1.id
        # disabled global rows are not enabled for the tenant
        assert not OrganizationStatusConfig.objects.filter(status_item__code="disabled-x").exists()
        assert OrganizationTaskTypeConfig.objects.filter(organization=org, task_type_id=mt1.id).exists()

    def test_org_override_does_not_mutate_global(self):
        from apps.masterdata.models import MasterStatus, OrganizationStatusConfig

        org = OrganizationFactory.create()
        enabled = MasterStatus.objects.create(code="onhold", name="On Hold", status="active")
        OrganizationInitializationService.initialize(org)

        cfg = OrganizationStatusConfig.objects.get(organization=org, status_item_id=enabled.id)
        cfg.enabled = False
        cfg.save()

        # global row untouched
        enabled.refresh_from_db()
        assert enabled.status == "active"

    def test_event_wiring_provisions_on_create(self):
        """OrganizationCreated dispatches to the provisioning handler."""
        from apps.core.events.bus import default_event_bus
        from apps.masterdata.events import ProvisionOrganizationOnCreate
        from apps.organization.events import OrganizationCreated

        # Self-sufficient under cross-suite interference: (re)register the
        # handler — registration is idempotent on the shared registry.
        from apps.masterdata.events import register_events

        register_events()

        # wiring: the handler is registered for the event
        assert ProvisionOrganizationOnCreate in default_event_bus.registry._handlers.get(
            OrganizationCreated, []
        )

        org = OrganizationFactory.create()
        default_event_bus.dispatcher.dispatch(
            OrganizationCreated(instance=org, user=None)
        )
        assert Role.objects.filter(organization=org, code="org-admin").exists()
