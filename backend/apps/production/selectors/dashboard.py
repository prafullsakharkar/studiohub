"""
Project dashboard aggregation selector.

Builds the ``ProjectDashboardData`` payload consumed by the frontend Project
Command Center (``GET /api/v1/projects/{id}/dashboard/`` with the nested
``/api/organizations/{org}/projects/{project}/dashboard`` fallback).

The aggregation rules intentionally mirror the frontend mock builder
(``studiohub-react/src/features/dashboard/api/buildProjectDashboardMock.ts``)
so the real API reproduces the established contract — same field names,
same status-bucket math, same 60/40 progress methodology — but every value
is derived from real database records. Anything without a data source is
omitted (optional fields) rather than fabricated.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from django.db.models import Q
from django.utils import timezone

from apps.production.selectors.base import ProductionBaseSelector


class ProjectDashboardSelector(ProductionBaseSelector):
    """Read-only project dashboard aggregation."""

    METHODOLOGY_NOTE = "Weighted aggregate: 60% Approved Shots + 40% Completed Tasks"

    # Canonical shot-status keys, seeded with zeros so the shape is stable
    # even for projects that have no shots in a given bucket. Unknown
    # statuses pass through as their own keys (same as the mock builder).
    SHOT_STATUS_SEED = (
        "Not Started",
        "In Progress",
        "Internal Review",
        "Client Review",
        "Approved",
        "Final",
        "On Hold",
    )

    # Upper bound of org-level change rows scanned when attributing recent
    # activity to a project (ChangeLog carries no project FK; attribution is
    # done by matching (target_type, target_id) against the project's entity
    # ids). Bounded so a busy org cannot make the dashboard scan unbounded.
    ACTIVITY_SCAN_LIMIT = 500

    # Milestone scaffolding: names mirror the frontend mock; dates
    # interpolate the project's real start/delivery dates and statuses derive
    # from the real overall progress. Same precedent as SCHEDULE_PHASES in
    # the project-scoped schedule view.
    MILESTONES = (
        "Plate Turnover & Ingest",
        "Rough Layout & Asset Conform",
        "Mid-Point Client Temp Screening",
        "90% Final Lighting & Comp Review",
        "Final 4K ACES Master Delivery",
    )

    # -- entry point ----------------------------------------------------

    @classmethod
    def build(cls, project) -> dict[str, Any]:
        """Aggregate the full dashboard payload for ``project``."""
        from apps.deliveries.models import DeliveryPackage
        from apps.production.models import Asset, Review, Shot, Task

        organization = project.organization
        today = timezone.localdate()

        shots = list(
            Shot.objects.filter(organization=organization, project=project)
            .select_related("assigned_artist")
            .order_by("-updated_at")[:5000]
        )
        tasks = list(
            Task.objects.filter(organization=organization, project=project)
            .select_related("assignee")
            .order_by("-updated_at")[:5000]
        )
        assets = list(
            Asset.objects.filter(organization=organization, project=project)[:5000]
        )
        reviews = list(
            Review.objects.filter(organization=organization, project=project)
            .select_related("lead_reviewer")
            .order_by("-updated_at")[:500]
        )
        deliveries = list(
            DeliveryPackage.objects.filter(organization=organization, project=project)
            .select_related("client")
            .order_by("-updated_at")[:500]
        )

        shot_stats = cls._shot_stats(shots)
        task_stats = cls._task_stats(tasks, today)
        asset_stats = cls._asset_stats(assets)
        review_stats = cls._review_stats(reviews)
        delivery_stats = cls._delivery_stats(deliveries, timezone.now())

        overall = cls._overall_progress(
            shot_stats["completion_pct"],
            task_stats["completion_pct"],
            total_shots=shot_stats["total"],
            total_tasks=task_stats["total"],
        )
        schedule = cls._schedule(
            project, overall, task_stats["overdue"], delivery_stats["late"], tasks, deliveries, today
        )

        return {
            "project": cls._project_metadata(project),
            "summary": {
                "total_shots": shot_stats["total"],
                "approved_shots": shot_stats["approved"],
                "in_progress_shots": shot_stats["in_progress"],
                "shots_at_risk": shot_stats["at_risk"],
                "shots_completion_pct": shot_stats["completion_pct"],
                "total_tasks": task_stats["total"],
                "open_tasks": task_stats["open"],
                "in_progress_tasks": task_stats["in_progress"],
                "completed_tasks": task_stats["completed"],
                "overdue_tasks": task_stats["overdue"],
                "tasks_completion_pct": task_stats["completion_pct"],
                "total_assets": asset_stats["total"],
                "in_progress_assets": asset_stats["in_progress"],
                "approved_assets": asset_stats["approved"],
                "needs_revision_assets": asset_stats["needs_revision"],
                "total_reviews": review_stats["total"],
                "pending_reviews": review_stats["pending"],
                "approved_reviews": review_stats["approved"],
                "changes_requested_reviews": review_stats["changes_requested"],
                "total_deliveries": delivery_stats["total"],
                "upcoming_deliveries": delivery_stats["upcoming"],
                "delivered_deliveries": delivery_stats["delivered"],
                "late_deliveries": delivery_stats["late"],
            },
            "production": {
                "overall_progress_pct": overall,
                "completed_shots": shot_stats["approved"],
                "in_progress_shots": shot_stats["in_progress"],
                "not_started_shots": shot_stats["not_started"],
                "status_breakdown": shot_stats["breakdown"],
                "methodology_note": cls.METHODOLOGY_NOTE,
            },
            "shots": {
                "total": shot_stats["total"],
                "by_status": shot_stats["by_status"],
                "recent_shots": [cls._shot_item(s) for s in shots[:8]],
            },
            "tasks": {
                "total": task_stats["total"],
                "open": task_stats["open"],
                "in_progress": task_stats["in_progress"],
                "blocked": task_stats["blocked"],
                "review": task_stats["review"],
                "completed": task_stats["completed"],
                "overdue": task_stats["overdue"],
                "recent_tasks": [cls._task_item(t, today) for t in tasks[:8]],
            },
            "reviews": {
                "pending": review_stats["pending"],
                "approved": review_stats["approved"],
                "changes_requested": review_stats["changes_requested"],
                "rejected": review_stats["rejected"],
                "recent_reviews": [cls._review_item(r) for r in reviews[:6]],
            },
            "schedule": schedule,
            "workload": {"team_members": cls._workload(tasks, today)},
            "deliveries": {
                "total": delivery_stats["total"],
                "upcoming": delivery_stats["upcoming"],
                "delivered": delivery_stats["delivered"],
                "late": delivery_stats["late"],
                "items": [cls._delivery_item(d) for d in deliveries[:6]],
            },
            "activity": cls._activity(project, organization, shots, tasks),
        }

    # -- project ----------------------------------------------------------

    @classmethod
    def _project_metadata(cls, project) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "id": str(project.id),
            "organization_id": str(project.organization_id),
            "name": project.name,
            "code": project.code,
            "type": project.type or "",
            "description": project.description or "",
            "status": project.status or "",
            "fps": float(project.fps or 24),
            "resolution": project.resolution or "",
            "aspect_ratio": project.aspect_ratio or "",
            "color_space": project.color_space or "",
            "start_date": project.start_date.isoformat() if project.start_date else "",
            "delivery_date": project.delivery_date.isoformat()
            if project.delivery_date
            else "",
        }
        if project.thumbnail_url:
            payload["thumbnail_url"] = project.thumbnail_url
        supervisor = cls._user_display_name(getattr(project, "supervisor", None))
        if supervisor:
            payload["supervisor_name"] = supervisor
        coordinator = cls._user_display_name(getattr(project, "coordinator", None))
        if coordinator:
            payload["coordinator_name"] = coordinator
        if project.client_name:
            payload["client_name"] = project.client_name
        if project.budget_usd:
            payload["budget_usd"] = float(project.budget_usd)
        return payload

    # -- shots ------------------------------------------------------------

    @classmethod
    def _shot_stats(cls, shots: list) -> dict[str, Any]:
        by_status: dict[str, int] = {key: 0 for key in cls.SHOT_STATUS_SEED}
        for shot in shots:
            status = shot.status or "Not Started"
            by_status[status] = by_status.get(status, 0) + 1
        total = len(shots)
        approved = by_status.get("Approved", 0) + by_status.get("Final", 0)
        in_progress = (
            by_status.get("In Progress", 0)
            + by_status.get("Internal Review", 0)
            + by_status.get("Client Review", 0)
        )
        return {
            "total": total,
            "approved": approved,
            "in_progress": in_progress,
            "not_started": by_status.get("Not Started", 0),
            "at_risk": by_status.get("On Hold", 0),
            "completion_pct": round(approved / total * 100) if total else 0,
            "by_status": by_status,
            "breakdown": [
                {
                    "status": status,
                    "count": count,
                    "percentage": round(count / total * 100) if total else 0,
                }
                for status, count in by_status.items()
            ],
        }

    @classmethod
    def _shot_item(cls, shot) -> dict[str, Any]:
        artist = getattr(shot, "assigned_artist", None)
        item: dict[str, Any] = {
            "id": str(shot.id),
            "code": shot.code,
            "status": shot.status or "Not Started",
        }
        if shot.name:
            item["name"] = shot.name
        if shot.sequence_code:
            item["sequence_code"] = shot.sequence_code
        if shot.thumbnail_url:
            item["thumbnail_url"] = shot.thumbnail_url
        name = cls._user_display_name(artist)
        if name:
            item["assigned_artist_name"] = name
        avatar = cls._user_avatar(artist)
        if avatar:
            item["assigned_artist_avatar"] = avatar
        try:
            item["frame_count"] = shot.frame_count
        except Exception:  # noqa: BLE001
            pass
        if shot.current_version:
            item["current_version"] = shot.current_version
        return item

    # -- tasks ------------------------------------------------------------

    @classmethod
    def _task_bucket(cls, status: str) -> str:
        normalized = (status or "").lower()
        if normalized in ("open", "todo", "not started"):
            return "open"
        if normalized in ("in progress", "wip"):
            return "in_progress"
        if normalized == "blocked":
            return "blocked"
        if normalized in ("review", "internal review", "client review"):
            return "review"
        if normalized in ("completed", "approved", "done"):
            return "completed"
        return "open"

    @classmethod
    def _is_task_overdue(cls, task, today: date, *, completed_only: bool = False) -> bool:
        if not task.due_date or task.due_date >= today:
            return False
        done = {"completed"} if completed_only else {"completed", "approved", "done"}
        return (task.status or "").lower() not in done

    @classmethod
    def _task_stats(cls, tasks: list, today: date) -> dict[str, Any]:
        buckets = {"open": 0, "in_progress": 0, "blocked": 0, "review": 0, "completed": 0}
        overdue = 0
        for task in tasks:
            buckets[cls._task_bucket(task.status)] += 1
            if cls._is_task_overdue(task, today):
                overdue += 1
        total = len(tasks)
        return {
            **buckets,
            "total": total,
            "overdue": overdue,
            "completion_pct": round(buckets["completed"] / total * 100) if total else 0,
        }

    @classmethod
    def _task_item(cls, task, today: date) -> dict[str, Any]:
        assignee = getattr(task, "assignee", None)
        item: dict[str, Any] = {
            "id": str(task.id),
            "title": task.title,
            "department": task.department or "",
            "status": task.status or "",
            "priority": task.priority or "",
            "is_overdue": cls._is_task_overdue(task, today, completed_only=True),
        }
        if task.code:
            item["code"] = task.code
        name = cls._user_display_name(assignee)
        if name:
            item["assignee_name"] = name
        avatar = cls._user_avatar(assignee)
        if avatar:
            item["assignee_avatar"] = avatar
        if task.due_date:
            item["due_date"] = task.due_date.isoformat()
        return item

    # -- assets / reviews / deliveries ------------------------------------

    @classmethod
    def _asset_stats(cls, assets: list) -> dict[str, Any]:
        approved = needs_revision = 0
        for asset in assets:
            normalized = (asset.status or "").lower()
            if normalized in ("approved", "ready", "released", "final"):
                approved += 1
            elif normalized in ("revision", "rejected", "needs revision", "retake"):
                needs_revision += 1
        total = len(assets)
        return {
            "total": total,
            "approved": approved,
            "needs_revision": needs_revision,
            "in_progress": total - approved - needs_revision,
        }

    @classmethod
    def _review_stats(cls, reviews: list) -> dict[str, Any]:
        approved = changes_requested = rejected = 0
        for review in reviews:
            normalized = (review.status or "").lower()
            if normalized in ("approved", "closed", "completed"):
                approved += 1
            elif normalized in ("changes requested", "retake"):
                changes_requested += 1
            elif normalized == "rejected":
                rejected += 1
        total = len(reviews)
        return {
            "total": total,
            "approved": approved,
            "changes_requested": changes_requested,
            "rejected": rejected,
            "pending": total - approved - changes_requested - rejected,
        }

    @classmethod
    def _review_item(cls, review) -> dict[str, Any]:
        reviewers = getattr(review, "reviewers", None) or []
        return {
            "id": str(review.id),
            "title": review.title or "Screening Session",
            # The review model carries no screening-type column; the
            # entity under review is the honest, useful label.
            "type": f"{review.entity_type or 'Shot'} Review",
            "status": review.status or "Pending Review",
            "reviewers_count": len(reviewers) if isinstance(reviewers, list) else 0,
            "updated_at": review.updated_at.isoformat() if review.updated_at else "",
        }

    @classmethod
    def _delivery_stats(cls, deliveries: list, now) -> dict[str, Any]:
        delivered = late = 0
        for delivery in deliveries:
            normalized = (delivery.status or "").lower()
            expires_at = getattr(delivery, "expires_at", None)
            is_late = (
                expires_at is not None
                and expires_at < now
                and normalized not in ("delivered", "approved", "sent", "complete")
            )
            if is_late:
                late += 1
            elif normalized in ("delivered", "approved", "sent", "accepted", "complete"):
                delivered += 1
        total = len(deliveries)
        return {
            "total": total,
            "delivered": delivered,
            "late": late,
            "upcoming": total - delivered - late,
        }

    @classmethod
    def _delivery_item(cls, delivery) -> dict[str, Any]:
        client = getattr(delivery, "client", None)
        try:
            item_count = delivery.version_count
        except Exception:  # noqa: BLE001
            item_count = 0
        item: dict[str, Any] = {
            "id": str(delivery.id),
            "title": delivery.name,
            "package_name": delivery.code or "TURNOVER_PKG",
            "status": delivery.status or "Draft",
            "recipient": getattr(client, "name", "") or "",
        }
        expires_at = getattr(delivery, "expires_at", None)
        # Contract requires `due_date` (string); empty when unscheduled.
        item["due_date"] = expires_at.date().isoformat() if expires_at is not None else ""
        if item_count:
            item["item_count"] = item_count
        return item

    # -- progress / schedule / workload -----------------------------------

    @classmethod
    def _overall_progress(
        cls, shots_pct: int, tasks_pct: int, *, total_shots: int, total_tasks: int
    ) -> int:
        if total_shots > 0 and total_tasks > 0:
            return round(shots_pct * 0.6 + tasks_pct * 0.4)
        if total_shots > 0:
            return shots_pct
        if total_tasks > 0:
            return tasks_pct
        return 0

    @classmethod
    def _schedule(
        cls, project, overall: int, overdue_tasks: int, late_deliveries: int,
        tasks: list, deliveries: list, today: date,
    ) -> dict[str, Any]:
        # Same defaulting rule as the project-scoped schedule view: a project
        # without dates still yields a well-formed schedule section.
        start = project.start_date or today
        end = project.delivery_date or (start + timedelta(days=180))
        if end <= start:
            end = start + timedelta(days=180)
        span_days = max(1, (end - start).days)
        days_total = max(1, round(span_days))
        days_elapsed = max(0, round((today - start).days))
        days_remaining = max(0, days_total - days_elapsed)
        total_seconds = span_days * 86400

        def _point(fraction: float) -> str:
            return (start + timedelta(seconds=round(total_seconds * fraction))).isoformat()

        if overall >= 25:
            m2 = "completed"
        else:
            m2 = "in_progress"
        if overall >= 50:
            m3 = "completed"
        elif overall >= 30:
            m3 = "in_progress"
        else:
            m3 = "upcoming"
        names = cls.MILESTONES
        milestones = [
            {"id": "m1", "name": names[0], "date": start.isoformat(), "status": "completed"},
            {"id": "m2", "name": names[1], "date": _point(0.25), "status": m2},
            {"id": "m3", "name": names[2], "date": _point(0.5), "status": m3},
            {
                "id": "m4",
                "name": names[3],
                "date": _point(0.8),
                "status": "completed" if overall >= 90 else "upcoming",
            },
            {
                "id": "m5",
                "name": names[4],
                "date": end.isoformat(),
                "status": "completed" if overall >= 100 else "upcoming",
            },
        ]
        payload: dict[str, Any] = {
            "start_date": start.isoformat(),
            "delivery_date": end.isoformat(),
            "days_total": days_total,
            "days_elapsed": days_elapsed,
            "days_remaining": days_remaining,
            "is_delayed": late_deliveries > 0 or overdue_tasks > 2,
            "milestones": milestones,
        }
        deadline = cls._next_deadline(tasks, deliveries, today)
        if deadline is not None:
            payload["next_deadline"] = deadline
        return payload

    @classmethod
    def _next_deadline(cls, tasks: list, deliveries: list, today: date) -> dict | None:
        upcoming_task = None
        for task in sorted(
            (t for t in tasks if t.due_date and t.due_date >= today),
            key=lambda t: t.due_date,
        ):
            upcoming_task = task
            break
        if upcoming_task is not None:
            return {
                "title": upcoming_task.title,
                "date": upcoming_task.due_date.isoformat(),
                "days_away": max(0, (upcoming_task.due_date - today).days),
                "type": "Task",
            }
        upcoming_delivery = None
        for delivery in sorted(
            (
                d
                for d in deliveries
                if getattr(d, "expires_at", None) is not None
                and getattr(d, "expires_at").date() >= today
            ),
            key=lambda d: getattr(d, "expires_at"),
        ):
            upcoming_delivery = delivery
            break
        if upcoming_delivery is not None:
            due = getattr(upcoming_delivery, "expires_at").date()
            return {
                "title": upcoming_delivery.name,
                "date": due.isoformat(),
                "days_away": max(0, (due - today).days),
                "type": "Delivery",
            }
        return None

    @classmethod
    def _workload(cls, tasks: list, today: date) -> list[dict[str, Any]]:
        members: dict[str, dict[str, Any]] = {}
        for task in tasks:
            assignee = getattr(task, "assignee", None)
            if assignee is not None:
                key = f"user-{assignee.id}"
                name = cls._user_display_name(assignee) or "Unassigned"
                avatar = cls._user_avatar(assignee)
                role = ""
                department = task.department or ""
            else:
                key = "unassigned"
                name = "Unassigned"
                avatar = None
                role = ""
                department = task.department or ""
            member = members.get(key)
            if member is None:
                member = {
                    "id": key,
                    "name": name,
                    "role": role,
                    "department": department,
                    "assigned_count": 0,
                    "in_progress_count": 0,
                    "overdue_count": 0,
                    "workload_level": "normal",
                }
                if avatar:
                    member["avatar_url"] = avatar
                members[key] = member
            member["assigned_count"] += 1
            if (task.status or "").lower() == "in progress":
                member["in_progress_count"] += 1
            if cls._is_task_overdue(task, today, completed_only=True):
                member["overdue_count"] += 1
            if member["assigned_count"] >= 5 or member["overdue_count"] >= 2:
                member["workload_level"] = "overloaded"
            elif member["assigned_count"] >= 3:
                member["workload_level"] = "high"
        return list(members.values())

    # -- activity -----------------------------------------------------------

    @classmethod
    def _activity(cls, project, organization, shots: list, tasks: list) -> list[dict]:
        items = cls._activity_from_changelog(project, organization)
        if items:
            return items
        # No recorded changes yet: surface the most recently touched
        # entities as contextual activity (same fallback as the mock, with
        # real names instead of illustrative literals).
        for shot in shots[:3]:
            name = cls._user_display_name(getattr(shot, "assigned_artist", None))
            items.append(
                {
                    "id": f"act-shot-{shot.id}",
                    "entity_type": "Shot",
                    "entity_id": str(shot.id),
                    "entity_code": shot.code,
                    "action": "Approved Shot"
                    if shot.status == "Approved"
                    else "Updated Pipeline Status",
                    "user_name": name or "System",
                    "timestamp": shot.updated_at.isoformat() if shot.updated_at else "",
                    "description": f"Shot {shot.code} set to {shot.status} for {project.name}",
                }
            )
        for task in tasks[:3]:
            name = cls._user_display_name(getattr(task, "assignee", None))
            items.append(
                {
                    "id": f"act-task-{task.id}",
                    "entity_type": "Task",
                    "entity_id": str(task.id),
                    "entity_code": task.code,
                    "action": "Completed Task"
                    if (task.status or "").lower() in ("completed", "approved", "done")
                    else "Logged Work",
                    "user_name": name or "System",
                    "timestamp": task.updated_at.isoformat() if task.updated_at else "",
                    "description": f"{task.department + ' ' if task.department else ''}"
                    f'task "{task.title}" updated',
                }
            )
        return items

    @classmethod
    def _activity_from_changelog(cls, project, organization) -> list[dict]:
        from apps.audit.models import ChangeLog

        labels = {"create": "Created", "update": "Updated", "delete": "Deleted"}
        project_ids = cls._project_entity_ids(project, organization)
        try:
            rows = list(
                ChangeLog.objects.filter(organization=organization)
                .select_related("user")
                .order_by("-created_at")[: cls.ACTIVITY_SCAN_LIMIT]
            )
        except Exception:  # noqa: BLE001
            return []
        items: list[dict] = []
        for row in rows:
            candidates = project_ids.get(row.target_type)
            if not candidates or str(row.target_id) not in candidates:
                continue
            user = getattr(row, "user", None)
            entry: dict[str, Any] = {
                "id": str(row.id),
                "entity_type": row.target_type,
                "entity_id": row.target_id,
                "action": f"{labels.get(row.change_type, row.change_type)} {row.target_type}",
                "user_name": cls._user_display_name(user) or "System",
                "timestamp": row.created_at.isoformat() if row.created_at else "",
                "description": row.description
                or f"{row.target_type} {row.target_name or row.target_id} "
                f"{row.change_type}d",
            }
            if row.target_name:
                entry["entity_code"] = row.target_name
            items.append(entry)
            if len(items) >= 8:
                break
        return items

    @classmethod
    def _project_entity_ids(cls, project, organization) -> dict[str, set[str]]:
        from apps.deliveries.models import DeliveryPackage
        from apps.production.models import (
            Asset,
            Review,
            Sequence,
            Shot,
            Task,
            Version,
        )

        pairs = (
            ("Project", (project.id,)),
            ("Sequence", Sequence.objects.filter(organization=organization, project=project).values_list("id", flat=True)),
            ("Shot", Shot.objects.filter(organization=organization, project=project).values_list("id", flat=True)),
            ("Asset", Asset.objects.filter(organization=organization, project=project).values_list("id", flat=True)),
            ("Task", Task.objects.filter(organization=organization, project=project).values_list("id", flat=True)),
            ("Version", Version.objects.filter(organization=organization, project=project).values_list("id", flat=True)),
            ("Review", Review.objects.filter(organization=organization, project=project).values_list("id", flat=True)),
            (
                "DeliveryPackage",
                DeliveryPackage.objects.filter(
                    organization=organization, project=project
                ).values_list("id", flat=True),
            ),
        )
        return {name: {str(value) for value in ids} for name, ids in pairs}

    # -- user helpers ---------------------------------------------------------

    @staticmethod
    def _user_display_name(user) -> str:
        if user is None:
            return ""
        profile = getattr(user, "profile", None)
        if profile is None:
            try:
                from apps.identity.models import Profile

                profile = Profile.objects.filter(user=user).first()
            except Exception:  # noqa: BLE001
                profile = None
        if profile is not None and getattr(profile, "display_name", None):
            return profile.display_name
        return getattr(user, "email", "") or ""

    @staticmethod
    def _user_avatar(user) -> str | None:
        if user is None:
            return None
        profile = getattr(user, "profile", None)
        avatar = getattr(profile, "avatar", None) if profile is not None else None
        if avatar:
            try:
                return avatar.url
            except Exception:  # noqa: BLE001
                return None
        return None
