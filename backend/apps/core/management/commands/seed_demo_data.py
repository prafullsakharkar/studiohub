"""
Seed demo data: ``seed_studiohub`` foundation + Phase 1-3 contract gap entities.

Canonical demo entry point::

    uv run python manage.py seed_demo_data --force
    uv run python manage.py seed_demo_data --force --dry-run
    uv run python manage.py seed_demo_data --force --skip-base
    uv run python manage.py seed_demo_data --force --only masterdata

What it does:

1. Runs the full ``seed_studiohub`` chain unless ``--skip-base`` (foundation
   + react-mock overlay + validation).
2. Seeds the contract entities ``seed_studiohub`` predates (Phase 1-3 work):
   masterdata catalog + org configs, automation rules/logs, scheduling
   resources/schedules/leaves/holidays/events.

Contract rules honored (same as ``seed_studiohub``):

- Idempotent: natural keys + restore-aware ``update_or_create``; safe to
  re-run. Soft-deleted rows matching incoming keys are restored, never
  duplicated.
- Frontend mock data is never modified; unresolvable references are skipped
  and reported, never guessed — except the documented seed decisions below.
- Nothing is destroyed (no ``--reset`` here; use ``seed_studiohub --reset``
  for a clean slate first).
- ``--dry-run`` executes everything inside a rolled-back transaction.

Documented seed decisions (mock has no equivalent — deterministic, reported):

- Studio holidays reference offices, not orgs: each holiday is seeded into
  every org (studio-wide semantics; natural key is ``(organization, date)``).
- Scheduling resources without a resolvable project org are skipped.
- ``mockOverbookingAlerts`` are NOT stored (alerts are computed live by the
  capacity selectors); ``mockAutomationRuns/Templates`` and
  ``intelligence/automations.ts`` have no API endpoints and are not seeded.
- Platform roles/groups/departments/positions have no mock source (the mock
  RBAC dataset seeds org roles instead) and are not seeded.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.core.management.commands.seed_studiohub import SeedReporter
from apps.production.management.commands.seed_production_mocks import (
    _load_ts_mock_array,
    _resolve_mock_root,
    _update_or_create,
)

RESOURCE_TYPE_MAP = {
    "person": "Person",
    "equipment": "Equipment",
}

LEAVE_TYPE_MAP = {
    "Annual Leave": "Vacation",
    "Training / Workshop": "Other",
    "Comp Time": "Other",
}

EVENT_TYPE_MAP = {
    "meeting": "Meeting",
    "deadline": "Deadline",
    "milestone": "Milestone",
    "review": "Review Session",
    "holiday": "Holiday",
    "leave": "Leave",
    "task": "Work Block",
    "project": "Work Block",
    "delivery": "Deadline",
    "availability": "Meeting",
}

GAP_PHASES = ("masterdata", "automations", "scheduling")


class Command(BaseCommand):
    help = "Seed demo data: seed_studiohub foundation + Phase 1-3 gap entities."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true",
                            help="Allow seeding even when DEBUG is False.")
        parser.add_argument("--dry-run", action="store_true",
                            help="Compute and report everything, then roll back (no writes).")
        parser.add_argument("--skip-base", action="store_true",
                            help="Skip seed_studiohub; only seed the gap phases.")
        parser.add_argument("--skip-validate", action="store_true",
                            help="Skip post-seed validation.")
        parser.add_argument("--only", action="store", default="",
                            help=f"Only seed these gap phases (comma-separated of {','.join(GAP_PHASES)}).")

    # ------------------------------------------------------------------
    # Entry point
    # ------------------------------------------------------------------

    def handle(self, *args, **options):
        force = options["force"]
        allow_seed_env = os.getenv("ALLOW_SEED", "").lower() in ("1", "true", "yes")
        if not settings.DEBUG and not force and not allow_seed_env:
            raise CommandError(
                "Refusing to seed in production. Use --force or set ALLOW_SEED=1 / DEBUG=True."
            )
        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — all writes will be rolled back."))
        with transaction.atomic():
            self._run(options)
            if dry_run:
                transaction.set_rollback(True)

    def _run(self, options):
        reporter = SeedReporter()
        if not options["skip_base"]:
            call_command(
                "seed_studiohub",
                force=options["force"],
                skip_validate=True,
                verbosity=options["verbosity"],
            )
        mock_root = _resolve_mock_root()
        self.stdout.write(f"Mock source: {mock_root}")
        only = [p.strip() for p in (options["only"] or "").split(",") if p.strip()]
        if only:
            unknown = [p for p in only if p not in GAP_PHASES]
            if unknown:
                raise CommandError(f"Unknown --only phases: {unknown} (choose from {','.join(GAP_PHASES)})")
        context = self._build_context(mock_root, reporter)
        if not only or "masterdata" in only:
            self._seed_masterdata(mock_root, reporter, context)
        if not only or "automations" in only:
            self._seed_automations(mock_root, reporter, context)
        if not only or "scheduling" in only:
            self._seed_scheduling(mock_root, reporter, context)
        self.stdout.write(reporter.summary())
        if not options["skip_validate"]:
            call_command("seed_studiohub", validate_only=True, verbosity=options["verbosity"])

    # ------------------------------------------------------------------
    # Shared context (id/code maps rebuilt from the mock on every run)
    # ------------------------------------------------------------------

    def _build_context(self, mock_root, reporter):
        from django.contrib.auth import get_user_model

        from apps.organization.models import Department, Office, Organization

        mock_orgs = _load_ts_mock_array(mock_root / "organization" / "organization.ts", "mockOrganizations")
        org_by_mock_id = {}
        org_by_code = {}
        for item in mock_orgs:
            code = (item.get("code") or "").strip().upper()
            org = Organization.objects.filter(code=code).first()
            if org is None:
                continue
            if item.get("id"):
                org_by_mock_id[item["id"]] = org
            org_by_code[code] = org

        mock_users = _load_ts_mock_array(mock_root / "identity" / "users.ts", "mockUsers")
        user_model = get_user_model()
        id_to_user = {}
        name_to_user = {}
        for item in mock_users:
            email = item.get("email")
            if not email:
                continue
            user = user_model.objects.filter(email__iexact=email).first()
            if user is None:
                continue
            if item.get("id"):
                id_to_user[item["id"]] = user
            full_name = (item.get("full_name") or "").strip().lower()
            if full_name:
                name_to_user.setdefault(full_name, user)

        projects = {}
        try:
            from apps.production.models import Project

            for project in Project.objects.select_related("organization").all():
                projects.setdefault((project.organization.code, project.code), project)
        except Exception as exc:  # noqa: BLE001
            reporter.note("seed_context", f"projects unavailable: {exc}")

        departments = {}
        for department in Department.objects.all():
            departments.setdefault(department.name.strip().lower(), department)
        offices = {}
        for office in Office.objects.all():
            offices.setdefault(office.name.strip().lower(), office)

        return {
            "org_by_mock_id": org_by_mock_id,
            "org_by_code": org_by_code,
            "id_to_user": id_to_user,
            "name_to_user": name_to_user,
            "projects": projects,
            "departments": departments,
            "offices": offices,
        }

    def _project_org(self, context, project_code):
        for (_org_code, code), project in context["projects"].items():
            if code == project_code:
                return project.organization
        return None

    @staticmethod
    def _parse_date(value):
        if not value or not isinstance(value, str):
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            return None

    @staticmethod
    def _parse_datetime(value):
        if not value or not isinstance(value, str):
            return None
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.utc)
        return parsed

    # ------------------------------------------------------------------
    # Phase: masterdata
    # ------------------------------------------------------------------

    def _seed_masterdata(self, mock_root, reporter, context):
        from apps.masterdata.models import (
            MasterAssetType,
            MasterFileType,
            MasterReviewType,
            MasterShotType,
            MasterStatus,
            MasterTaskType,
            OrganizationAssetTypeConfig,
            OrganizationReviewTypeConfig,
            OrganizationShotTypeConfig,
            OrganizationSoftwareConfig,
            OrganizationStatusConfig,
            OrganizationTaskTypeConfig,
            Software,
            SoftwareVersion,
        )

        path = mock_root / "masterData" / "initialMasterData.ts"
        org_by_mock_id = context["org_by_mock_id"]

        software_by_mock_id = {}
        for item in _load_ts_mock_array(path, "mockGlobalSoftware"):
            if self._seed_software(item, None, reporter):
                software_by_mock_id[item["id"]] = item["code"]
        for item in _load_ts_mock_array(path, "mockCustomSoftware"):
            org = org_by_mock_id.get(item.get("organization_id"))
            if org is None:
                reporter.add("masterdata_software", "skipped")
                reporter.note(
                    "masterdata_software",
                    f"custom software {item.get('code')}: unknown organization "
                    f"{item.get('organization_id')!r}",
                )
                continue
            if self._seed_software(item, org, reporter):
                software_by_mock_id[item["id"]] = item["code"]

        version_by_mock_id = {}
        for var in ("mockSoftwareVersions", "mockCustomSoftwareVersions"):
            for item in _load_ts_mock_array(path, var):
                software = Software.objects.filter(
                    code=software_by_mock_id.get(item.get("software_id"), "")
                ).first()
                # CatalogModel.code is globally unique; mock versions carry no
                # code, so the unique version_code doubles as the row code.
                if software is None or not item.get("version") or not item.get("version_code"):
                    reporter.add("masterdata_versions", "skipped")
                    continue
                release = self._parse_date(item.get("release_date"))
                end_of_support = self._parse_date(item.get("end_of_support"))
                _, created = _update_or_create(
                    SoftwareVersion,
                    code=item["version_code"],
                    defaults={
                        "software": software,
                        "version": item["version"],
                        "version_code": item.get("version_code", ""),
                        "release_date": release,
                        "end_of_support": end_of_support,
                        "status": item.get("status", "active"),
                        "scope": item.get("scope", "GLOBAL"),
                        "organization": software.organization,
                        "metadata": item.get("metadata") or {},
                    },
                )
                reporter.add("masterdata_versions", "created" if created else "updated")
                if item.get("id"):
                    version_by_mock_id[item["id"]] = (software, item["version"])

        status_by_mock_id = {}
        used_status_codes: set[str] = set()
        for item in _load_ts_mock_array(path, "mockMasterStatuses"):
            if not item.get("code"):
                reporter.add("masterdata_statuses", "skipped")
                continue
            # CatalogModel.code is unique per table but mock reuses codes
            # across entity types ('in_progress' for task+shot). First-seen
            # keeps the bare code; later collisions are namespaced.
            code = item["code"]
            if code in used_status_codes:
                code = f"{item.get('entity_type', 'x')}_{code}"
                reporter.note("masterdata_statuses", f"code collision disambiguated: {code}")
            used_status_codes.add(code)
            _, created = _update_or_create(
                MasterStatus,
                code=code,
                defaults={
                    "name": item.get("name", item["code"]),
                    "entity_type": item.get("entity_type", ""),
                    "category": item.get("category", ""),
                    "color": item.get("color", ""),
                    "order": item.get("order", 0) or 0,
                    "is_default": bool(item.get("is_default", False)),
                    "is_final": bool(item.get("is_final", False)),
                    "description": item.get("description", ""),
                    "status": item.get("status", "active"),
                    "scope": item.get("scope", "GLOBAL"),
                    "organization": org_by_mock_id.get(item.get("organization_id") or ""),
                },
            )
            reporter.add("masterdata_statuses", "created" if created else "updated")
            if item.get("id"):
                status_by_mock_id[item["id"]] = code

        # File types carry no `code` in the mock — derive it deterministically
        # from the (unique) extension.
        type_jobs = [
            ("mockMasterTaskTypes", MasterTaskType, "masterdata_tasktypes",
             lambda item: item.get("code", ""),
             lambda item: {
                 "category": item.get("category", ""),
                 "department_code": item.get("department_code", ""),
                 "department_name": item.get("department_name", ""),
                 "color": item.get("color", ""),
                 "icon": item.get("icon", ""),
             }),
            ("mockMasterAssetTypes", MasterAssetType, "masterdata_assettypes",
             lambda item: item.get("code", ""),
             lambda item: {
                 "color": item.get("color", ""),
                 "icon": item.get("icon", ""),
             }),
            ("mockMasterShotTypes", MasterShotType, "masterdata_shottypes",
             lambda item: item.get("code", ""),
             lambda item: {
                 "default_handle_frames": item.get("default_handle_frames"),
             }),
            ("mockMasterReviewTypes", MasterReviewType, "masterdata_reviewtypes",
             lambda item: item.get("code", ""),
             lambda item: {
                 "allow_verdicts": item.get("allow_verdicts", True),
                 "require_notes": bool(item.get("require_notes", False)),
             }),
            ("mockMasterFileTypes", MasterFileType, "masterdata_filetypes",
             lambda item: (item.get("extension") or "").lstrip(".").lower(),
             lambda item: {
                 "extension": item.get("extension", ""),
                 "mime_type": item.get("mime_type", ""),
                 "category": item.get("category", ""),
                 "dcc_affinity": item.get("dcc_affinity", ""),
             }),
        ]
        type_by_mock_id: dict[str, str] = {}
        for var, model, entity, code_fn, extra in type_jobs:
            for item in _load_ts_mock_array(path, var):
                code = code_fn(item)
                if not code:
                    reporter.add(entity, "skipped")
                    continue
                defaults = {
                    "name": item.get("name", code),
                    "description": item.get("description", ""),
                    "status": item.get("status", "active"),
                    "scope": item.get("scope", "GLOBAL"),
                    "organization": org_by_mock_id.get(item.get("organization_id") or ""),
                }
                defaults.update(extra(item))
                _, created = _update_or_create(model, code=code, defaults=defaults)
                reporter.add(entity, "created" if created else "updated")
                if item.get("id"):
                    type_by_mock_id[item["id"]] = code

        for item in _load_ts_mock_array(path, "mockOrganizationSoftwareConfigs"):
            org = org_by_mock_id.get(item.get("organization_id"))
            software = Software.objects.filter(
                code=software_by_mock_id.get(item.get("software_id"), "")
            ).first()
            if org is None or software is None:
                reporter.add("masterdata_software_configs", "skipped")
                continue
            default_version = None
            version_key = version_by_mock_id.get(item.get("default_version_id") or "")
            if version_key:
                default_version = SoftwareVersion.objects.filter(
                    software=version_key[0], version=version_key[1]
                ).first()
            _, created = _update_or_create(
                OrganizationSoftwareConfig,
                organization=org,
                software=software,
                defaults={
                    "enabled": bool(item.get("enabled", True)),
                    "display_name_override": item.get("display_name_override"),
                    "default_version": default_version,
                    "notes": item.get("notes", ""),
                },
            )
            reporter.add("masterdata_software_configs", "created" if created else "updated")

        for item in _load_ts_mock_array(path, "mockOrganizationStatusConfigs"):
            org = org_by_mock_id.get(item.get("organization_id"))
            status = MasterStatus.objects.filter(
                code=status_by_mock_id.get(item.get("status_id"), "")
            ).first()
            if org is None or status is None:
                reporter.add("masterdata_status_configs", "skipped")
                continue
            _, created = _update_or_create(
                OrganizationStatusConfig,
                organization=org,
                status_item=status,
                defaults={
                    "enabled": bool(item.get("enabled", True)),
                    "name_override": item.get("name_override"),
                    "color_override": item.get("color_override"),
                },
            )
            reporter.add("masterdata_status_configs", "created" if created else "updated")

        for item in _load_ts_mock_array(path, "mockOrganizationTaskTypeConfigs"):
            org = org_by_mock_id.get(item.get("organization_id"))
            task_type = MasterTaskType.objects.filter(
                code=type_by_mock_id.get(item.get("task_type_id") or "", "")
            ).first()
            if org is None or task_type is None:
                reporter.add("masterdata_tasktype_configs", "skipped")
                continue
            _, created = _update_or_create(
                OrganizationTaskTypeConfig,
                organization=org,
                task_type=task_type,
                defaults={
                    "enabled": bool(item.get("enabled", True)),
                    "name_override": item.get("name_override"),
                },
            )
            reporter.add("masterdata_tasktype_configs", "created" if created else "updated")

        # Asset/shot/review org-config arrays are empty in the mock — report, don't invent.
        for var, entity in (
            ("mockOrganizationAssetTypeConfigs", OrganizationAssetTypeConfig),
            ("mockOrganizationShotTypeConfigs", OrganizationShotTypeConfig),
            ("mockOrganizationReviewTypeConfigs", OrganizationReviewTypeConfig),
        ):
            items = _load_ts_mock_array(path, var)
            if not items:
                reporter.note(entity.__name__, "no mock records — nothing seeded")

    # ------------------------------------------------------------------
    # Phase: automations (db/production/workflow.ts — the served dataset)
    # ------------------------------------------------------------------

    def _seed_automations(self, mock_root, reporter, context):
        from apps.production.models import AutomationAuditLog, AutomationRule
        from apps.production.services import automation as automation_service

        path = mock_root / "production" / "workflow.ts"
        mock_workflows = {
            item["id"]: item
            for item in _load_ts_mock_array(path, "mockWorkflows")
            if item.get("id")
        }

        def resolve_org(workflow_mock_id):
            workflow = mock_workflows.get(workflow_mock_id or "")
            project_code = (workflow or {}).get("project_code", "")
            for (_org_code, code), project in context["projects"].items():
                if code == project_code:
                    return project.organization
            return None

        def resolve_workflow(org, workflow_mock_id):
            from apps.production.models import Workflow

            workflow = mock_workflows.get(workflow_mock_id or "")
            if not workflow or not workflow.get("code"):
                return None
            return Workflow.objects.filter(
                organization=org, code=workflow["code"]
            ).first()

        for item in _load_ts_mock_array(path, "mockAutomationRules"):
            org = resolve_org(item.get("workflow_id"))
            if org is None or not item.get("name"):
                reporter.add("automation_rules", "skipped")
                reporter.note(
                    "automation_rules",
                    f"rule {item.get('id')}: unresolvable workflow/project org",
                )
                continue
            trigger = item.get("trigger") or {}
            data = {
                "name": item["name"],
                "description": item.get("description", ""),
                "trigger_event": trigger.get("event", ""),
                "trigger_entity_type": trigger.get("entity_type", ""),
                "trigger_filters": trigger.get("filters") or {},
                "conditions": item.get("conditions") or [],
                "actions": item.get("actions") or [],
                "is_active": bool(item.get("is_active", True)),
                "required_role": item.get("required_role", ""),
                "workflow_id": item.get("workflow_id"),
            }
            rule = AutomationRule.objects.filter(organization=org, name=item["name"]).first()
            if rule is None:
                rule = automation_service.create_rule(organization=org, user=None, data=data)
                reporter.add("automation_rules", "created")
            else:
                automation_service.update_rule(rule=rule, data=data)
                reporter.add("automation_rules", "updated")
            # Server-maintained counters: backfill mock execution stats.
            rule.execution_count = item.get("execution_count", 0) or 0
            rule.last_triggered_at = self._parse_datetime(item.get("last_triggered_at"))
            rule.last_status = item.get("last_status", "")
            rule.save(update_fields=["execution_count", "last_triggered_at", "last_status"])

        for item in _load_ts_mock_array(path, "mockAutomationAuditLogs"):
            org = resolve_org(item.get("workflow_id"))
            if org is None:
                reporter.add("automation_audit_logs", "skipped")
                continue
            rule = AutomationRule.objects.filter(
                organization=org, name=item.get("rule_name", "")
            ).first()
            actor = context["id_to_user"].get(item.get("actor_id") or "")
            executed_at = self._parse_datetime(item.get("executed_at")) or timezone.now()
            _, created = _update_or_create(
                AutomationAuditLog,
                organization=org,
                rule=rule,
                executed_at=executed_at,
                defaults={
                    "rule_name": item.get("rule_name", ""),
                    "workflow": resolve_workflow(org, item.get("workflow_id")),
                    "workflow_name": item.get("workflow_name", ""),
                    "trigger_event": item.get("trigger_event", ""),
                    "entity_type": item.get("entity_type", ""),
                    "entity_id": item.get("entity_id", ""),
                    "entity_code": item.get("entity_code", ""),
                    "actor": actor,
                    "actor_name": item.get("actor_name", ""),
                    "actor_role": item.get("actor_role", ""),
                    "duration_ms": item.get("duration_ms", 0) or 0,
                    "status": item.get("status", "success"),
                    "step_logs": item.get("step_logs") or [],
                    "action_logs": item.get("action_logs") or [],
                },
            )
            reporter.add("automation_audit_logs", "created" if created else "updated")

        # No API serves runs/templates — report, don't invent storage.
        if _load_ts_mock_array(mock_root / "intelligence" / "automations.ts", "mockAutomationRuns"):
            reporter.note("automation_runs", "mock-only dataset, no endpoint — not seeded")
        if _load_ts_mock_array(mock_root / "intelligence" / "automations.ts", "mockAutomationTemplates"):
            reporter.note("automation_templates", "mock-only dataset, no endpoint — not seeded")

    def _seed_software(self, item, org, reporter):
        from apps.masterdata.models import Software

        if not item.get("code"):
            reporter.add("masterdata_software", "skipped")
            return False
        _, created = _update_or_create(
            Software,
            code=item["code"],
            defaults={
                "name": item.get("name", item["code"]),
                "publisher": item.get("publisher", ""),
                "category": item.get("category", ""),
                "description": item.get("description", ""),
                "website": item.get("website", ""),
                "status": item.get("status", "active"),
                "scope": item.get("scope", "GLOBAL" if org is None else "ORGANIZATION"),
                "organization": org,
                "is_system": bool(item.get("is_system", False)),
                "metadata": item.get("metadata") or {},
            },
        )
        reporter.add("masterdata_software", "created" if created else "updated")
        return True

    # ------------------------------------------------------------------
    # Phase: scheduling (db/production/scheduling.ts)
    # ------------------------------------------------------------------

    def _seed_scheduling(self, mock_root, reporter, context):
        from apps.scheduling.models import (
            CalendarEvent,
            Holiday,
            Resource,
            ResourceLeave,
            ResourceSchedule,
        )

        path = mock_root / "production" / "scheduling.ts"

        resource_by_mock_id: dict[str, Any] = {}
        for item in _load_ts_mock_array(path, "mockResources"):
            resource_type = RESOURCE_TYPE_MAP.get((item.get("type") or "").lower(), "")
            if not resource_type or not item.get("code"):
                reporter.add("scheduling_resources", "skipped")
                reporter.note(
                    "scheduling_resources",
                    f"resource {item.get('id')}: no bookable equivalent "
                    f"(type {item.get('type')!r})",
                )
                continue
            org = self._project_org(context, item.get("current_project_code", ""))
            if org is None:
                reporter.add("scheduling_resources", "skipped")
                reporter.note(
                    "scheduling_resources",
                    f"resource {item.get('code')}: unresolvable project "
                    f"{item.get('current_project_code')!r}",
                )
                continue
            user = context["name_to_user"].get((item.get("name") or "").strip().lower())
            department = context["departments"].get(
                (item.get("department_name") or "").strip().lower()
            )
            metadata = {
                "role": item.get("role", ""),
                "skills": item.get("skills") or [],
                "avatar_url": item.get("avatar_url", ""),
            }
            resource, created = _update_or_create(
                Resource,
                code=item["code"],
                defaults={
                    "name": item.get("name", item["code"]),
                    "resource_type": resource_type,
                    "organization": org,
                    "department": department,
                    "user": user,
                    "capacity_hours_per_week": item.get("capacity_weekly_hours", 40) or 40,
                    "location": item.get("office_name", ""),
                    "metadata": metadata,
                },
            )
            reporter.add("scheduling_resources", "created" if created else "updated")
            if item.get("id"):
                resource_by_mock_id[item["id"]] = resource

        task_by_key: dict[tuple[str, str], Any] = {}
        try:
            from apps.production.models import Task

            for task in Task.objects.select_related("project", "project__organization").all():
                task_by_key[(task.project.code, task.code)] = task
        except Exception as exc:  # noqa: BLE001
            reporter.note("scheduling_schedules", f"tasks unavailable: {exc}")

        for resource_item in _load_ts_mock_array(path, "mockResources"):
            resource = resource_by_mock_id.get(resource_item.get("id") or "")
            if resource is None:
                continue
            for assignment in resource_item.get("assignments") or []:
                start = self._parse_datetime((assignment.get("start_date") or "") + "T09:00:00Z")
                total_hours = assignment.get("total_hours") or 0
                if start is None or not total_hours:
                    reporter.add("scheduling_schedules", "skipped")
                    continue
                from datetime import timedelta

                end = start + timedelta(hours=total_hours)
                task = task_by_key.get(
                    (assignment.get("project_code", ""), assignment.get("task_code", ""))
                )
                if ResourceSchedule.all_objects.filter(
                    resource=resource, start_time=start, end_time=end
                ).exists():
                    reporter.add("scheduling_schedules", "existing")
                    continue
                ResourceSchedule.objects.create(
                    resource=resource,
                    start_time=start,
                    end_time=end,
                    status="Booked",
                    task=task,
                    notes=assignment.get("task_title", ""),
                )
                reporter.add("scheduling_schedules", "created")

        for item in _load_ts_mock_array(path, "mockResourceLeaves"):
            resource = None
            user = context["id_to_user"].get(item.get("resource_id") or "")
            if user is not None:
                resource = Resource.objects.filter(user=user).first()
            if resource is None:
                resource = Resource.objects.filter(name=item.get("resource_name", "")).first()
            if resource is None:
                reporter.add("scheduling_leaves", "skipped")
                reporter.note(
                    "scheduling_leaves",
                    f"leave {item.get('id')}: no resource for "
                    f"{item.get('resource_name')!r}",
                )
                continue
            leave_type = LEAVE_TYPE_MAP.get(item.get("leave_type", ""), "Other")
            start_date = self._parse_date(item.get("start_date"))
            end_date = self._parse_date(item.get("end_date")) or start_date
            if start_date is None:
                reporter.add("scheduling_leaves", "skipped")
                continue
            _, created = _update_or_create(
                ResourceLeave,
                resource=resource,
                start_date=start_date,
                end_date=end_date,
                defaults={
                    "leave_type": leave_type,
                    "status": item.get("status", "Pending"),
                    "total_days": item.get("total_days", 0) or 0,
                    "reason": item.get("notes", ""),
                },
            )
            reporter.add("scheduling_leaves", "created" if created else "updated")

        # Studio-wide semantics: seed each holiday into every org.
        orgs = list(context["org_by_code"].values())
        for item in _load_ts_mock_array(path, "mockStudioHolidays"):
            holiday_date = self._parse_date(item.get("date"))
            if not holiday_date:
                reporter.add("scheduling_holidays", "skipped")
                continue
            for org in orgs:
                _, created = _update_or_create(
                    Holiday,
                    organization=org,
                    holiday_date=holiday_date,
                    defaults={
                        "name": item.get("name", "Holiday"),
                        "description": f"{item.get('type', '')} ({item.get('office_name', '')})".strip(),
                    },
                )
                reporter.add("scheduling_holidays", "created" if created else "updated")

        for item in _load_ts_mock_array(path, "mockCalendarEvents"):
            org = self._project_org(context, item.get("project_code", ""))
            if org is None:
                reporter.add("scheduling_events", "skipped")
                continue
            start = self._parse_datetime((item.get("start_date") or "") + "T00:00:00Z")
            end_raw = self._parse_datetime((item.get("end_date") or "") + "T00:00:00Z")
            if start is None:
                reporter.add("scheduling_events", "skipped")
                continue
            from datetime import timedelta

            end = (end_raw or start) + timedelta(days=1) - timedelta(seconds=1)
            project = None
            for (_org_code, code), candidate in context["projects"].items():
                if code == item.get("project_code", ""):
                    project = candidate
                    break
            event_type = EVENT_TYPE_MAP.get((item.get("event_type") or "").lower(), "Meeting")
            if CalendarEvent.all_objects.filter(
                organization=org, title=item.get("title", ""), start_time=start
            ).exists():
                reporter.add("scheduling_events", "existing")
                continue
            CalendarEvent.objects.create(
                organization=org,
                project=project,
                title=item.get("title", "Event"),
                description=item.get("description", ""),
                event_type=event_type,
                status=item.get("status", "Scheduled"),
                start_time=start,
                end_time=end,
                is_all_day=bool(item.get("all_day", False)),
                location=item.get("location_or_link", ""),
            )
            reporter.add("scheduling_events", "created")

        # Stored mock alerts are superseded by live computation — report.
        if _load_ts_mock_array(path, "mockOverbookingAlerts"):
            reporter.note(
                "scheduling_overbooking_alerts",
                "mock alerts superseded by live capacity computation — not stored",
            )
