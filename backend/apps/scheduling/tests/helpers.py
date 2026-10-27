"""Shared builders for the scheduling tests: users with codes, resources, calendars, projects."""

from __future__ import annotations

import itertools
from typing import Any

from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership
from apps.scheduling.models import Resource, WorkCalendar
from apps.scheduling.services.calendar import WorkCalendarService

_counter = itertools.count(1)

VIEW = "schedule.view"
CREATE = "schedule.create"
UPDATE = "schedule.update"
DELETE = "schedule.delete"
MANAGE = "schedule.manage"
APPROVE = "schedule.approve"
SOD_OVERRIDE = "schedule.sod.override"
#: what a planner holds (the full roles); the override code is held by nobody
ALL_CODES = (VIEW, CREATE, UPDATE, DELETE, MANAGE, APPROVE)


def client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def person(*codes: str, project: Any = None, superuser: bool = False):
    """A user holding ``codes``, a member of ``project`` when one is given."""
    user = UserFactory.create(is_superuser=superuser)
    if codes:
        grant_permissions(user, *codes)
    if project is not None:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def admin_client() -> APIClient:
    """A platform admin (superuser): reaches every project, holds every non-opt-in code."""
    return client_for(person(superuser=True))


def default_calendar() -> WorkCalendar:
    """The studio default calendar (made if a truncating test removed it)."""
    return WorkCalendarService.ensure_default()


def make_calendar(code: str | None = None, **fields: Any) -> WorkCalendar:
    """A work calendar made through the service (not the default unless asked)."""
    number = next(_counter)
    default_calendar()  # so this one does not take the default role by being first
    data = {"code": code or f"CAL{number}", "name": f"Calendar {number}", **fields}
    return WorkCalendarService.create(actor=None, data=data)


def make_resource(code: str | None = None, **fields: Any) -> Resource:
    number = next(_counter)
    return Resource.objects.create(
        name=fields.pop("name", f"Resource {number}"),
        code=code or f"RES{number}",
        resource_type=fields.pop("resource_type", "Person"),
        **fields,
    )
