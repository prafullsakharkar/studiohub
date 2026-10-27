"""
Work calendars (docs/scheduling/CONTRACTS.md DOM-SCH-01).

A calendar code is unique in any case, the time zone must be a real IANA zone, the working weekdays
are one to seven distinct ISO weekdays, an office has at most one calendar, and exactly one live
calendar is the default (choosing a new default moves it in the same transaction). The database
holds the code, office and default rules as constraints too, so two requests that race cannot both
win. A calendar that is the default, or that a live resource or holiday still uses, is not deleted.
"""

from __future__ import annotations

import uuid
from decimal import Decimal, InvalidOperation
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db import IntegrityError, transaction
from django.db.models.functions import Upper
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.core.api.exceptions.api import ConflictException, NotFoundException
from apps.scheduling.models import Holiday, Resource, WorkCalendar
from apps.scheduling.services import audit

EDITABLE_FIELDS = ("name", "time_zone", "working_weekdays", "hours_per_day", "office")


class CalendarInUse(ConflictException):
    """The calendar is the default or is still used (409)."""

    default_detail = "This calendar is the default or is still used by resources or holidays."
    default_code = "calendar_in_use"


def _actor_or_none(actor: Any):
    return actor if getattr(actor, "is_authenticated", False) else None


def clean_time_zone(value: Any) -> str:
    """``value`` as a valid IANA zone name, else a 400 (no path tricks, no unknown names)."""
    name = str(value or "").strip()
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        raise ValidationError(
            {"time_zone": ["Unknown time zone. Use an IANA name such as Europe/London."]}
        ) from None
    if not name:
        raise ValidationError({"time_zone": ["Unknown time zone."]})
    return name


def clean_weekdays(value: Any) -> list[int]:
    """One to seven distinct ISO weekdays (1 is Monday, 7 is Sunday), sorted."""
    if not isinstance(value, (list, tuple)) or not value:
        raise ValidationError(
            {"working_weekdays": ["Give at least one weekday (1 is Monday, 7 is Sunday)."]}
        )
    days = []
    for item in value:
        if isinstance(item, bool) or not isinstance(item, int) or not 1 <= item <= 7:
            raise ValidationError(
                {"working_weekdays": ["Weekdays are whole numbers from 1 (Monday) to 7 (Sunday)."]}
            )
        days.append(item)
    if len(set(days)) != len(days):
        raise ValidationError({"working_weekdays": ["Each weekday may appear once."]})
    return sorted(days)


def clean_hours(value: Any) -> Decimal:
    try:
        hours = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValidationError({"hours_per_day": ["A number of hours is required."]}) from None
    if not hours.is_finite() or hours <= 0 or hours > 24:
        raise ValidationError(
            {"hours_per_day": ["Hours per day must be more than 0 and at most 24."]}
        )
    return hours.quantize(Decimal("0.01"))


def _check_code(code: str, *, exclude: Any = None) -> None:
    clash = WorkCalendar.all_objects.annotate(ucode=Upper("code")).filter(
        ucode=code.strip().upper()
    )
    if exclude is not None:
        clash = clash.exclude(pk=exclude)
    if clash.exists():
        raise ValidationError({"code": ["A calendar with this code already exists."]})


def _check_office(office: Any, *, exclude: Any = None) -> None:
    if office is None:
        return
    clash = WorkCalendar.objects.filter(office=office)
    if exclude is not None:
        clash = clash.exclude(pk=exclude)
    if clash.exists():
        raise ValidationError({"office": ["This office already has a calendar."]})


def _clear_other_defaults(keep: Any = None) -> None:
    others = WorkCalendar.objects.select_for_update().filter(is_default=True)
    if keep is not None:
        others = others.exclude(pk=keep)
    for calendar in others:
        calendar.is_default = False
        calendar.save(update_fields=["is_default", "updated_at"])


class WorkCalendarService:
    @staticmethod
    def _lock(calendar: Any) -> WorkCalendar:
        pk = getattr(calendar, "pk", calendar)
        try:
            return WorkCalendar.objects.select_for_update().get(pk=pk)
        except WorkCalendar.DoesNotExist as error:
            raise NotFoundException() from error

    @classmethod
    @transaction.atomic
    def create(cls, *, actor: Any, data: dict[str, Any]) -> WorkCalendar:
        """
        Create a calendar. The time zone defaults to the office's own when an office is given and no
        zone is sent. The first calendar ever made is the default.
        """
        data = dict(data)
        code = (data.get("code") or "").strip()
        if not code:
            raise ValidationError({"code": ["A code is required."]})
        _check_code(code)
        office = data.get("office")
        _check_office(office)
        zone = data.get("time_zone") or (getattr(office, "timezone", "") if office else "") or "UTC"
        make_default = (
            bool(data.get("is_default"))
            or not WorkCalendar.objects.filter(is_default=True).exists()
        )
        if make_default:
            _clear_other_defaults()
        try:
            with transaction.atomic():
                return WorkCalendar.objects.create(
                    code=code,
                    name=(data.get("name") or code).strip(),
                    time_zone=clean_time_zone(zone),
                    office=office,
                    working_weekdays=clean_weekdays(data.get("working_weekdays", [1, 2, 3, 4, 5])),
                    hours_per_day=clean_hours(data.get("hours_per_day", 8)),
                    is_default=make_default,
                    created_by=_actor_or_none(actor),
                )
        except IntegrityError as error:
            raise ValidationError(
                {"code": ["This code, office or default was taken by someone else just now."]}
            ) from error

    @classmethod
    def ensure_default(cls) -> WorkCalendar:
        """
        The default calendar, made if there is none (UTC, Monday to Friday, 8 hours, code STUDIO).

        Migration 0004 creates it; this covers a database that lost it (every table truncated, a
        restore). Safe to call twice at once: a second creator hits the one-default constraint and
        reads the winner's row.
        """
        existing = WorkCalendar.objects.filter(is_default=True).first()
        if existing is not None:
            return existing
        code = "STUDIO"
        if WorkCalendar.all_objects.annotate(ucode=Upper("code")).filter(ucode=code).exists():
            code = f"STUDIO-{uuid.uuid4().hex[:6].upper()}"
        try:
            with transaction.atomic():
                return WorkCalendar.objects.create(
                    code=code,
                    name="Studio",
                    time_zone="UTC",
                    working_weekdays=[1, 2, 3, 4, 5],
                    hours_per_day=Decimal("8.00"),
                    is_default=True,
                )
        except IntegrityError:
            return WorkCalendar.objects.get(is_default=True)

    @classmethod
    @transaction.atomic
    def update(cls, *, actor: Any, calendar: Any, data: dict[str, Any]) -> WorkCalendar:
        """Edit a calendar. The code is not editable; the default is moved with ``set_default``."""
        locked = cls._lock(calendar)
        data = dict(data)
        if "office" in data:
            _check_office(data["office"], exclude=locked.pk)
        cleaners = {
            "time_zone": clean_time_zone,
            "working_weekdays": clean_weekdays,
            "hours_per_day": clean_hours,
        }
        for name in EDITABLE_FIELDS:
            if name not in data:
                continue
            value = cleaners[name](data[name]) if name in cleaners else data[name]
            setattr(locked, name, value)
        if data.get("is_default") and not locked.is_default:
            _clear_other_defaults(keep=locked.pk)
            locked.is_default = True
        locked.updated_by = _actor_or_none(actor)
        try:
            with transaction.atomic():
                locked.save()
        except IntegrityError as error:
            raise ValidationError(
                {"office": ["This office or the default was taken by someone else just now."]}
            ) from error
        return locked

    @classmethod
    @transaction.atomic
    def set_default(cls, *, actor: Any, calendar: Any) -> WorkCalendar:
        """Make ``calendar`` the default; the previous default stops being one."""
        locked = cls._lock(calendar)
        if not locked.is_default:
            _clear_other_defaults(keep=locked.pk)
            locked.is_default = True
            locked.updated_by = _actor_or_none(actor)
            locked.save(update_fields=["is_default", "updated_by", "updated_at"])
            audit.record(
                actor=actor,
                action=AuditLog.ACTION_UPDATE,
                target_id=locked.pk,
                target_name=f"Calendar {locked.code}",
                description=f"Calendar {locked.code} is now the default",
                metadata={"event": "calendar.default_changed", "calendar": locked.code},
            )
        return locked

    @classmethod
    @transaction.atomic
    def delete(cls, *, actor: Any, calendar: Any) -> None:
        """Soft-delete a calendar that is not the default and that nothing live uses (else 409)."""
        locked = cls._lock(calendar)
        if (
            locked.is_default
            or Resource.objects.filter(calendar=locked).exists()
            or Holiday.objects.filter(calendar=locked).exists()
        ):
            raise CalendarInUse()
        locked.soft_delete(user=_actor_or_none(actor))
