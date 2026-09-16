"""
Change tracking signals.

Records ``ChangeLog`` rows for creates/updates/deletes on core business
entities so the change-logs observability page shows real history.
Bounded by design:

- explicit tracked-model list (no global receivers → no audit/identity
  noise, no self-trigger loops from ``ChangeLog`` itself);
- writes resolve ``organization`` from the instance (rows without one are
  skipped — the FK requires it);
- actor resolves from the thread-local request (may be ``None`` for
  background writes);
- every receiver is best-effort: tracking must never break the write.
"""

from __future__ import annotations

from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

# Fields too noisy or sensitive for before/after snapshots.
_SKIP_FIELDS = frozenset(
    {
        "id",
        "uuid",
        "password",
        "created_at",
        "updated_at",
        "is_deleted",
        "deleted_at",
        "deleted_by",
    }
)

_MAX_VALUE_LEN = 500


def _snapshot(instance) -> dict:
    """Serialize tracked scalar fields for before/after comparison."""
    import datetime
    import decimal
    import json
    import uuid

    values: dict = {}
    try:
        for field in instance._meta.concrete_fields:
            if field.name in _SKIP_FIELDS or field.is_relation:
                continue
            try:
                raw = field.value_from_object(instance)
            except Exception:
                continue
            # str() first for scalars so both snapshot sides format
            # identically (Decimal/dates must NOT go through json.dumps,
            # which would add quotes on one side only).
            if raw is None:
                text = ""
            elif isinstance(
                raw,
                (
                    str,
                    int,
                    float,
                    bool,
                    datetime.date,
                    datetime.datetime,
                    datetime.time,
                    datetime.timedelta,
                    decimal.Decimal,
                    uuid.UUID,
                ),
            ):
                text = str(raw)
            else:
                try:
                    text = json.dumps(raw, default=str)
                except Exception:
                    text = str(raw)
            values[field.name] = text[:_MAX_VALUE_LEN]
    except Exception:
        return {}
    return values


def _values_equal(left, right) -> bool:
    """String comparison with numeric awareness (Decimal '24.000' == '24')."""
    if left == right:
        return True
    try:
        from decimal import Decimal, InvalidOperation

        if left is None or right is None or left == "" or right == "":
            return left == right
        return Decimal(str(left)) == Decimal(str(right))
    except Exception:
        return False


def _target_name(instance) -> str:
    for attr in ("name", "code", "title"):
        value = getattr(instance, attr, None)
        if value:
            return str(value)[:255]
    return f"{type(instance).__name__} {instance.pk}"


def _organization(instance):
    return getattr(instance, "organization", None)


def _record(change_type: str, instance, before: dict, after: dict) -> None:
    from apps.audit.models import ChangeLog
    from apps.core.middleware.request_context import get_current_user

    organization = _organization(instance)
    if organization is None:
        return
    changed = sorted(
        {k for k in set(before) | set(after) if not _values_equal(before.get(k), after.get(k))}
    )
    ChangeLog.objects.create(
        change_type=change_type,
        target_type=type(instance).__name__,
        target_id=str(instance.pk),
        target_name=_target_name(instance),
        user=get_current_user(),
        organization=organization,
        before_values=before,
        after_values=after,
        changed_fields=changed,
        description=f"{change_type}d {type(instance).__name__} {_target_name(instance)}",
    )


def _pre_save_snapshot(sender, instance, raw, **kwargs) -> None:
    if raw or instance.pk is None:
        instance._changelog_before = {}
        return
    try:
        current = sender.objects.filter(pk=instance.pk).values().first() or {}
        # Skip true FK columns (resolved from model meta, NOT by `_id`
        # suffix: legacy scalar fields like `client_id` must stay tracked).
        # The post-save snapshot omits relations, so FK attnames would
        # always false-positive as changed; FK swaps are untracked.
        rel_attnames = {
            f.attname
            for f in sender._meta.concrete_fields
            if f.is_relation
        }
        instance._changelog_before = {
            k: ("" if v is None else str(v)[:_MAX_VALUE_LEN])
            for k, v in current.items()
            if k not in _SKIP_FIELDS and k not in rel_attnames
        }
    except Exception:
        instance._changelog_before = {}


def _post_save_record(sender, instance, created, raw, **kwargs) -> None:
    if raw:
        return
    try:
        from apps.audit.models import ChangeLog

        if created:
            _record(ChangeLog.CHANGE_CREATE, instance, {}, _snapshot(instance))
        else:
            before = getattr(instance, "_changelog_before", {}) or {}
            after = _snapshot(instance)
            # Column names and field names align (FK attnames excluded on
            # both sides), so compare directly.
            if any(not _values_equal(before.get(k), after.get(k)) for k in set(before) | set(after)):
                _record(ChangeLog.CHANGE_UPDATE, instance, before, after)
    except Exception:
        pass
    finally:
        instance._changelog_before = {}


def _post_delete_record(sender, instance, **kwargs) -> None:
    try:
        from apps.audit.models import ChangeLog

        _record(ChangeLog.CHANGE_DELETE, instance, _snapshot(instance), {})
    except Exception:
        pass


_TRACKED_MODEL_PATHS = (
    "apps.production.models.Project",
    "apps.production.models.Sequence",
    "apps.production.models.Shot",
    "apps.production.models.Asset",
    "apps.production.models.Task",
    "apps.production.models.Version",
    "apps.deliveries.models.DeliveryPackage",
    "apps.publishing.models.PublishItem",
)


def register_change_tracking() -> None:
    """Connect bounded receivers. Called from ``AuditConfig.ready()``."""
    from django.apps import apps as django_apps

    for path in _TRACKED_MODEL_PATHS:
        app_label, _, model_name = path.rpartition(".")
        # path is "apps.<app>.models.<Model>" -> app label is middle part.
        label = path.split(".")[1]
        try:
            model = django_apps.get_model(label, model_name)
        except Exception:
            continue
        pre_save.connect(_pre_save_snapshot, sender=model, weak=False)
        post_save.connect(_post_save_record, sender=model, weak=False)
        post_delete.connect(_post_delete_record, sender=model, weak=False)
