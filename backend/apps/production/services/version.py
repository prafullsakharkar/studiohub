"""
Versions: numbering, the entity they are about, publishing and the hero version (DECISIONS D-29).

* A version is numbered by the server inside its series (the versions of a task, or of a shot or an
  asset when they have no task): the series row is locked, the next index is the highest ever used
  (soft-deleted versions included) plus one, and ``version_number`` is ``v`` and the index padded to
  three digits. Concurrent creates get consecutive numbers, none twice.
* A version is about a shot or an asset, never both, and agrees with its task's shot or asset; a
  version made from a task alone takes the task's.
* Publishing needs an approved version and records who and when. A published version cannot be
  archived or deleted; unpublish first.
* A shot or asset has at most one hero version; promoting one demotes the previous one in the same
  transaction, under a lock on the shot or asset.
"""

from __future__ import annotations

import re
from typing import Any

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.services.business import BusinessService
from apps.production.models import Asset, Shot, Version
from apps.production.services.status import OVERRIDE_SELF_APPROVAL, StatusService

_CODE_UNSAFE = re.compile(r"[^A-Z0-9_-]+")


class VersionService(BusinessService):
    model = Version

    # -- consistency ----------------------------------------------------------

    @classmethod
    def entity_of(cls, *, shot: Any = None, asset: Any = None, task: Any = None) -> tuple[Any, Any]:
        """
        The (shot, asset) a version is about: the ones given, else its task's. Raises a 400 for both at
        once, or for a task about a different shot or asset than the one given.
        """
        if shot is not None and asset is not None:
            raise ValidationError({"asset": ["A version is about a shot or an asset, not both."]})
        if task is not None:
            if shot is not None and task.shot_id not in (None, shot.pk):
                raise ValidationError({"task": ["The task is about another shot."]})
            if asset is not None and task.asset_id not in (None, asset.pk):
                raise ValidationError({"task": ["The task is about another asset."]})
            if shot is not None and task.asset_id is not None:
                raise ValidationError({"task": ["The task is about an asset, not this shot."]})
            if asset is not None and task.shot_id is not None:
                raise ValidationError({"task": ["The task is about a shot, not this asset."]})
            if shot is None and asset is None:
                shot, asset = task.shot, task.asset
        return shot, asset

    # -- creating -------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def create(cls, *, user=None, **data):
        task = data.get("task")
        shot, asset = cls.entity_of(shot=data.get("shot"), asset=data.get("asset"), task=task)
        data["shot"], data["asset"] = shot, asset
        owner = task or shot or asset
        if owner is not None:
            # Lock the series owner, so two creates in one series are numbered one after the other.
            type(owner)._base_manager.select_for_update().get(pk=owner.pk)
            series = (
                Version.all_objects.filter(task=task)
                if task is not None
                else Version.all_objects.filter(task__isnull=True, shot=shot, asset=asset)
            )
            index = (series.aggregate(top=Max("version_index"))["top"] or 0) + 1
            data["version_index"] = index
            data["version_number"] = f"v{index:03d}"
        if not str(data.get("code") or "").strip():
            data["code"] = cls._derive_code(data, task, shot, asset)
        return super().create(user=user, **data)

    @classmethod
    def _derive_code(cls, data: dict[str, Any], task: Any, shot: Any, asset: Any) -> str:
        """``<entity code>_<step>_v###``; ``_2``, ``_3`` ... when the project already has it."""
        entity = shot or asset
        step = ""
        if task is not None and task.task_type_id:
            step = task.task_type.code
        elif data.get("department"):
            step = str(data["department"])
        parts = [
            getattr(entity, "code", "") or (task.code if task is not None else "VERSION"),
            step,
            data["version_number"],
        ]
        base = _CODE_UNSAFE.sub("-", "_".join(part for part in parts if part).upper()).strip("-_")[
            :90
        ]
        code, number = base, 1
        while Version.all_objects.filter(project=data["project"], code__iexact=code).exists():
            number += 1
            code = f"{base}_{number}"
        return code

    # -- publishing -----------------------------------------------------------

    @classmethod
    @transaction.atomic
    def publish_version(cls, *, actor: Any, version: Version, info: dict[str, Any]) -> Version:
        locked = Version.objects.select_for_update().get(pk=version.pk)
        if locked.is_published:
            raise ValidationError({"is_published": ["This version is already published."]})
        if locked.status != "Approved":
            raise ValidationError({"status": ["Only an approved version can be published."]})
        now = timezone.now()
        locked.is_published = True
        locked.published_at = now
        locked.published_by = actor
        locked.publishing_info = {
            **(locked.publishing_info or {}),
            **info,
            "published_at": now.isoformat(),
        }
        locked.save(
            update_fields=[
                "is_published",
                "published_at",
                "published_by",
                "publishing_info",
                "updated_at",
            ]
        )
        return locked

    @classmethod
    @transaction.atomic
    def unpublish_version(cls, *, actor: Any, version: Version) -> Version:
        locked = Version.objects.select_for_update().get(pk=version.pk)
        if not locked.is_published:
            raise ValidationError({"is_published": ["This version is not published."]})
        locked.is_published = False
        locked.published_at = None
        locked.published_by = None
        locked.save(update_fields=["is_published", "published_at", "published_by", "updated_at"])
        return locked

    @classmethod
    def before_delete(cls, instance, **kwargs):
        if instance.is_published:
            raise ValidationError(
                {
                    "detail": [
                        "A published version cannot be archived or deleted. Unpublish it first."
                    ]
                }
            )
        return instance

    # -- hero -----------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def promote_version(
        cls, *, actor, version, has_permission=None, has_explicit=None, override_reason=None
    ):
        """
        Make ``version`` the hero version of its shot or asset; it is approved by the promotion.

        Promoting is an approval, so the producer of the version may not do it even
        when someone else already approved it (no status change, no transition check).
        The shot's (or asset's) previous hero is demoted in the same transaction.
        """
        field = "shot" if version.shot_id else "asset" if version.asset_id else None
        if field is None:
            raise ValidationError(
                {"detail": ["Only a version of a shot or an asset can be the hero version."]}
            )
        already_approved = version.status == "Approved"
        kind = ""
        if already_approved:
            kind = StatusService.check_separation(
                entity=version,
                to_status="Approved",
                actor=actor,
                has_explicit=has_explicit,
                override_reason=override_reason,
            )
        StatusService.transition_status(
            actor=actor,
            entity=version,
            to_status="Approved",
            reason="promoted",
            has_permission=has_permission,
            has_explicit=has_explicit,
            override_reason=override_reason,
        )
        if kind == OVERRIDE_SELF_APPROVAL:
            # Already approved: no transition row carried the override, so record it.
            StatusService.record_override(
                entity=version,
                actor=actor,
                override_kind=kind,
                reason=override_reason or "",
                note="promote",
            )
        owner_model = Shot if field == "shot" else Asset
        owner_model._base_manager.select_for_update().get(pk=getattr(version, f"{field}_id"))
        for previous in (
            Version.objects.select_for_update()
            .filter(**{f"{field}_id": getattr(version, f"{field}_id")}, is_hero=True)
            .exclude(pk=version.pk)
        ):
            previous.is_hero = False
            previous.save(update_fields=["is_hero", "updated_at"])
        version.is_hero = True
        version.save(update_fields=["is_hero", "updated_at"])
        return version
