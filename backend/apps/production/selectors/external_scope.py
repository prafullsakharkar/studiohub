"""
Compartmentalization of external (vendor / client) project members (TPN review TM-002, ADR-0033 D2).

A user has one ``ProjectMembership`` per project. When it names a vendor (``vendor_id``) or a client
(``client_id``) the member is *external* on that project: instead of the whole project they see only
what they have been given.

* **Vendor**: the tasks of their vendor, and what is reached through those tasks: the shot, asset,
  sequence and episode a task is on, the versions and timelogs of the task, the reviews that contain
  those versions, and the media attached to any of it. Nothing else a studio or another vendor did.
* **Client**: the reviews they take part in, the versions in those reviews, and the media attached
  to either.
* Both: the project record itself, their own membership, the playlists and notes they created,
  and the project's workflow definitions (reference data, not content).

Anything not listed here is invisible to an external member: this module is deny-by-default. A
membership with neither field set is internal and is not touched by any of this.
"""

from __future__ import annotations

from typing import Any, NamedTuple

from django.apps import apps
from django.db.models import CharField, Q, QuerySet
from django.db.models.functions import Cast


class Grant(NamedTuple):
    """One external membership: what ``user`` may be shown on ``project_id``."""

    project_id: Any
    vendor_id: str
    client_id: str
    user: Any


def _model(name: str):
    return apps.get_model("production", name)


def _text_ids(queryset: QuerySet[Any], field: str = "id") -> QuerySet[Any]:
    """``queryset``'s ids as text, for the ``entity_id`` columns that hold ids as strings."""
    return queryset.annotate(_text_id=Cast(field, CharField())).values("_text_id")


def vendor_match(prefix: str, vendor_id: str) -> Q:
    """Rows whose vendor is ``vendor_id``, by id or by code (both are used as membership values)."""
    return Q(**{f"{prefix}vendor_id__iexact": vendor_id}) | Q(
        **{f"{prefix}vendor_code__iexact": vendor_id}
    )


# ---------------------------------------------------------------------------
# What a grant reaches
# ---------------------------------------------------------------------------


def vendor_tasks(grant: Grant) -> QuerySet[Any]:
    """The tasks of the grant's vendor on its project (empty without a vendor)."""
    tasks = _model("Task").objects.filter(project_id=grant.project_id)

    if not grant.vendor_id:
        return tasks.none()

    return tasks.filter(vendor_match("", grant.vendor_id))


def vendor_versions(grant: Grant) -> QuerySet[Any]:
    return _model("Version").objects.filter(
        project_id=grant.project_id, task_id__in=vendor_tasks(grant).values("id")
    )


def reviews_of(grant: Grant) -> QuerySet[Any]:
    """Reviews reached through the vendor's versions or the client's participation."""
    item = _model("ReviewItem")
    participant = _model("ReviewParticipant")

    q = Q(pk__in=[])

    if grant.vendor_id:
        q |= Q(
            id__in=item.objects.filter(version_id__in=vendor_versions(grant).values("id")).values(
                "review_id"
            )
        )

    if grant.client_id:
        q |= Q(id__in=participant.objects.filter(user=grant.user).values("review_id"))

    return _model("Review").objects.filter(project_id=grant.project_id).filter(q)


def versions_of(grant: Grant) -> QuerySet[Any]:
    """Versions of the vendor's tasks, and every version in a review the grant reaches."""
    item = _model("ReviewItem")

    q = Q(
        id__in=item.objects.filter(review_id__in=reviews_of(grant).values("id")).values(
            "version_id"
        )
    )

    if grant.vendor_id:
        q |= Q(id__in=vendor_versions(grant).values("id"))

    return _model("Version").objects.filter(project_id=grant.project_id).filter(q)


def _shots(grant: Grant) -> QuerySet[Any]:
    return vendor_tasks(grant).filter(shot_id__isnull=False).values("shot_id")


def _assets(grant: Grant) -> QuerySet[Any]:
    return vendor_tasks(grant).filter(asset_id__isnull=False).values("asset_id")


# ---------------------------------------------------------------------------
# One predicate per model
# ---------------------------------------------------------------------------


def _media_q(grant: Grant) -> Q:
    """Media attached to something the grant can see."""
    version = _model("Version")
    shot = _model("Shot")
    asset = _model("Asset")

    q = Q(pk__in=[])

    if grant.vendor_id:
        q |= (
            Q(entity_type__iexact="task", entity_id__in=_text_ids(vendor_tasks(grant)))
            | Q(
                entity_type__iexact="shot",
                entity_id__in=_text_ids(shot.objects.filter(id__in=_shots(grant))),
            )
            | Q(
                entity_type__iexact="asset",
                entity_id__in=_text_ids(asset.objects.filter(id__in=_assets(grant))),
            )
        )

    q |= Q(
        entity_type__iexact="version",
        entity_id__in=_text_ids(version.objects.filter(id__in=versions_of(grant).values("id"))),
    )

    return q


def predicate(model_name: str, grant: Grant) -> Q | None:
    """
    The rows of ``model_name`` the grant may see, as a ``Q`` on that model; ``None`` when the model
    is not shown to external members at all.
    """
    project = Q(project_id=grant.project_id)
    vendor = bool(grant.vendor_id)

    if model_name == "Project":
        return Q(pk=grant.project_id)

    if model_name == "ProjectMembership":
        return project & Q(user=grant.user)

    if model_name == "Workflow":
        return project

    if model_name == "Playlist":
        return project & Q(created_by=grant.user)

    if model_name == "ProjectNote":
        return project & (Q(author=grant.user) | Q(created_by=grant.user))

    if model_name == "Review":
        return project & Q(id__in=reviews_of(grant).values("id"))

    if model_name == "Version":
        return project & Q(id__in=versions_of(grant).values("id"))

    if model_name == "Media":
        return project & _media_q(grant)

    if not vendor:
        return None

    if model_name == "Task":
        return project & vendor_match("", grant.vendor_id)

    if model_name == "Shot":
        return project & Q(id__in=_shots(grant))

    if model_name == "Asset":
        return project & Q(id__in=_assets(grant))

    if model_name == "ShotAsset":
        return project & Q(shot_id__in=_shots(grant)) & Q(asset_id__in=_assets(grant))

    if model_name == "Sequence":
        shot = _model("Shot")
        return project & (
            Q(id__in=vendor_tasks(grant).filter(sequence_id__isnull=False).values("sequence_id"))
            | Q(
                id__in=shot.objects.filter(id__in=_shots(grant))
                .filter(sequence_id__isnull=False)
                .values("sequence_id")
            )
        )

    if model_name == "Episode":
        shot = _model("Shot")
        return project & Q(
            id__in=shot.objects.filter(id__in=_shots(grant))
            .filter(episode_id__isnull=False)
            .values("episode_id")
        )

    if model_name == "Timelog":
        return project & Q(task_id__in=vendor_tasks(grant).values("id"))

    return None


def external_q(model_name: str, grants: list[Grant]) -> Q:
    """What every external grant of the caller allows on ``model_name`` (never matches if none)."""
    combined = Q(pk__in=[])

    for grant in grants:
        part = predicate(model_name, grant)
        if part is not None:
            combined |= part

    return combined
