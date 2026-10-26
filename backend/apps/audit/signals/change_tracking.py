"""
Change tracking signals.

Records ``ChangeLog`` rows for creates/updates/deletes on core business
entities so the change-logs observability page shows real history.
Bounded by design:

- explicit tracked-model list (no global receivers → no audit/identity
  noise, no self-trigger loops from ``ChangeLog`` itself);
- platform-global: ``ChangeLog`` carries no tenant partition, so every
  tracked write records a row (the former organization gate is gone —
  rows without an organization are no longer skipped);
- actor resolves from the thread-local request (may be ``None`` for
  background writes);
- every receiver is best-effort: tracking must never break the write.
"""

from __future__ import annotations

from django.db.models.signals import post_delete, post_save, pre_save

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

# Foreign keys are part of the diff only for models of these apps: a swapped
# episode, assignee or reviewer on a production record is a change worth
# keeping. Elsewhere relations stay out, as before. The audit columns change on
# every write, so they never count.
_RELATION_TRACKING_APPS = frozenset({"production"})
_AUDIT_RELATIONS = frozenset({"created_by", "updated_by", "deleted_by"})


def _tracks_relations(model) -> bool:
    return model._meta.app_label in _RELATION_TRACKING_APPS


def _format_value(raw) -> str:
    """
    One text form for a column value, used on both sides of a diff.

    str() first for scalars so both sides format identically (Decimal/dates
    must NOT go through json.dumps, which would add quotes on one side only);
    containers (JSON columns) are dumped as JSON, since the database side hands
    back Python objects whose ``str()`` differs from the dump.
    """
    import datetime
    import decimal
    import json
    import uuid

    if raw is None:
        return ""
    if isinstance(
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
        return str(raw)
    try:
        return json.dumps(raw, default=str)
    except Exception:
        return str(raw)


def _snapshot(instance) -> dict:
    """Serialize tracked scalar fields for before/after comparison."""
    values: dict = {}
    try:
        # A model lists fields that hold personal or financial data in
        # ``audit_exclude_fields``; they never reach the change log.
        excluded = _SKIP_FIELDS | set(getattr(instance, "audit_exclude_fields", ()))
        track_relations = _tracks_relations(type(instance))
        for field in instance._meta.concrete_fields:
            if field.name in excluded:
                continue
            if field.is_relation and (not track_relations or field.name in _AUDIT_RELATIONS):
                continue
            try:
                raw = field.value_from_object(instance)
            except Exception:
                continue
            text = _format_value(raw)
            # A relation is recorded under its column name (``episode_id``), the
            # key ``_pre_save_snapshot`` reads back from the database.
            values[field.attname if field.is_relation else field.name] = text[:_MAX_VALUE_LEN]
    except Exception:
        return {}
    return values


def _values_equal(left, right) -> bool:
    """String comparison with numeric awareness (Decimal '24.000' == '24')."""
    if left == right:
        return True
    try:
        from decimal import Decimal

        if left is None or right is None or left == "" or right == "":
            return left == right
        return Decimal(str(left)) == Decimal(str(right))
    except Exception:
        return False


def _target_name(instance) -> str:
    # A field the model keeps out of the change log (a person's name) must not
    # come back through the label.
    excluded = set(getattr(instance, "audit_exclude_fields", ()))
    for attr in ("name", "code", "title"):
        if attr in excluded:
            continue
        value = getattr(instance, attr, None)
        if value:
            return str(value)[:255]
    return f"{type(instance).__name__} {instance.pk}"


def _record(change_type: str, instance, before: dict, after: dict) -> None:
    from apps.audit.models import ChangeLog
    from apps.core.middleware.request_context import get_current_user

    changed = sorted(
        {k for k in set(before) | set(after) if not _values_equal(before.get(k), after.get(k))}
    )
    ChangeLog.objects.create(
        change_type=change_type,
        target_type=type(instance).__name__,
        target_id=str(instance.pk),
        target_name=_target_name(instance),
        user=get_current_user(),
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
        # The post-save snapshot omits the relations it does not track, so their
        # FK attnames would always false-positive as changed; production models
        # track their FKs (``_tracks_relations``) except the audit columns.
        rel_attnames = {
            f.attname
            for f in sender._meta.concrete_fields
            if f.is_relation and not (_tracks_relations(sender) and f.name not in _AUDIT_RELATIONS)
        }
        # Same exclusion as ``_snapshot``: the "before" side must not carry the
        # personal or financial values the "after" side leaves out.
        skipped = _SKIP_FIELDS | set(getattr(instance, "audit_exclude_fields", ()))
        instance._changelog_before = {
            k: _format_value(v)[:_MAX_VALUE_LEN]
            for k, v in current.items()
            if k not in skipped and k not in rel_attnames
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
            if any(
                not _values_equal(before.get(k), after.get(k)) for k in set(before) | set(after)
            ):
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
    "apps.production.models.Episode",
    "apps.production.models.Review",
    "apps.production.models.Timelog",
    "apps.production.models.ProjectMembership",
    "apps.deliveries.models.DeliveryPackage",
    "apps.publishing.models.PublishItem",
    # Global directory / RBAC entities (post B2/B3 canonicals) — edit-page
    # writes must produce the same field-diff rows as production entities
    # (who/when/entity/old→new). Org-app entities die with B7.
    "apps.masterdata.models.Client",
    "apps.masterdata.models.Vendor",
    "apps.masterdata.models.Person",
    "apps.masterdata.models.Department",
    "apps.masterdata.models.Team",
    "apps.masterdata.models.Office",
    "apps.identity.models.UserRole",
    "apps.identity.models.GroupMember",
    "apps.identity.models.GroupRole",
    "apps.identity.models.RolePermission",
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
