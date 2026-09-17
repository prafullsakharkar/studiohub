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

    @staticmethod
    def _status_counts(grouped_rows) -> dict[str, int]:
        """Collapse ``values("status").annotate(count=…)`` rows to a dict."""
        counts: dict[str, int] = {}
        for row in grouped_rows:
            counts[row["status"] or "Not Started"] = row["count"]
        return counts

    @classmethod
    def build(cls, project) -> dict[str, Any]:
        """Aggregate the full dashboard payload for ``project``.

        Counts are aggregated database-side (``GROUP BY status`` /
        filtered ``COUNT``) so totals stay exact at any project size —
        the payload never counts a paginated or truncated page. Only the
        small `recent_*` example lists are sliced.
        """
        from django.db.models import Count

        from apps.deliveries.models import DeliveryPackage
        from apps.production.models import Asset, Review, Shot, Task

        organization = project.organization
        today = timezone.localdate()
        scope = {"organization": organization, "project": project}

        shot_statuses = (
            Shot.objects.filter(**scope).values("status").annotate(count=Count("id"))
        )
        task_statuses = (
            Task.objects.filter(**scope).values("status").annotate(count=Count("id"))
        )
        asset_statuses = (
            Asset.objects.filter(**scope).values("status").annotate(count=Count("id"))
        )
        review_statuses = (
            Review.objects.filter(**scope).values("status").annotate(count=Count("id"))
        )
        delivery_rows = list(
            DeliveryPackage.objects.filter(**scope).values("status", "expires_at")
        )

        from django.db.models.functions import Lower

        # Lower-cased status annotation keeps the case-insensitive bucket
        # semantics of the contract without Q-object gymnastics.
        task_base = Task.objects.filter(**scope).annotate(_ls=Lower("status"))
        done_statuses = ("completed", "approved", "done")
        overdue_count = (
            task_base.filter(due_date__lt=today).exclude(_ls__in=done_statuses).count()
        )
        blocked_count = task_base.filter(_ls="blocked").count()
        overlap_count = (
            task_base.filter(_ls="blocked", due_date__lt=today)
            .exclude(_ls__in=done_statuses)
            .count()
        )
        # Exact union of overdue-or-blocked for the watchlist header (not
        # derived from the truncated recent list).
        critical_count = overdue_count + blocked_count - overlap_count

        recent_shots = list(
            Shot.objects.filter(**scope)
            .select_related("assigned_artist")
            .order_by("-updated_at")[:8]
        )
        recent_tasks = list(
            Task.objects.filter(**scope)
            .select_related("assignee")
            .order_by("-updated_at")[:8]
        )
        recent_reviews = list(
            Review.objects.filter(**scope)
            .select_related("lead_reviewer")
            .order_by("-updated_at")[:6]
        )
        recent_deliveries = list(
            DeliveryPackage.objects.filter(**scope)
            .select_related("client")
            .order_by("-updated_at")[:6]
        )

        shot_stats = cls._shot_stats(cls._status_counts(shot_statuses))
        task_stats = cls._task_stats(
            task_statuses,
            overdue=overdue_count,
            critical=critical_count,
        )
        asset_stats = cls._asset_stats(cls._status_counts(asset_statuses))
        review_stats = cls._review_stats(cls._status_counts(review_statuses))
        delivery_stats = cls._delivery_stats(delivery_rows, timezone.now())

        overall = cls._overall_progress(
            shot_stats["completion_pct"],
            task_stats["completion_pct"],
            total_shots=shot_stats["total"],
            total_tasks=task_stats["total"],
        )
        schedule = cls._schedule(
            project,
            overall,
            task_stats["overdue"],
            delivery_stats["late"],
            organization,
            today,
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
                "rejected_reviews": review_stats["rejected"],
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
                "recent_shots": [cls._shot_item(s) for s in recent_shots],
            },
            "tasks": {
                "total": task_stats["total"],
                "open": task_stats["open"],
                "in_progress": task_stats["in_progress"],
                "blocked": task_stats["blocked"],
                "review": task_stats["review"],
                "completed": task_stats["completed"],
                "overdue": task_stats["overdue"],
                "critical": task_stats["critical"],
                "recent_tasks": [cls._task_item(t, today) for t in recent_tasks],
            },
            "reviews": {
                "pending": review_stats["pending"],
                "approved": review_stats["approved"],
                "changes_requested": review_stats["changes_requested"],
                "rejected": review_stats["rejected"],
                "recent_reviews": [cls._review_item(r) for r in recent_reviews],
            },
            "schedule": schedule,
            "workload": {"team_members": cls._workload(organization, project, today)},
            "deliveries": {
                "total": delivery_stats["total"],
                "upcoming": delivery_stats["upcoming"],
                "delivered": delivery_stats["delivered"],
                "late": delivery_stats["late"],
                "items": [cls._delivery_item(d) for d in recent_deliveries],
            },
            "activity": cls._activity(project, organization, recent_shots, recent_tasks),
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
    def _shot_stats(cls, by_status: dict[str, int]) -> dict[str, Any]:
        for key in cls.SHOT_STATUS_SEED:
            by_status.setdefault(key, 0)
        total = sum(by_status.values())
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
    def _task_stats(cls, status_rows, *, overdue: int, critical: int) -> dict[str, Any]:
        buckets = {"open": 0, "in_progress": 0, "blocked": 0, "review": 0, "completed": 0}
        total = 0
        for row in status_rows:
            count = row["count"]
            buckets[cls._task_bucket(row["status"])] += count
            total += count
        return {
            **buckets,
            "total": total,
            "overdue": overdue,
            "critical": critical,
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
    def _asset_stats(cls, status_counts: dict[str, int]) -> dict[str, Any]:
        approved = needs_revision = 0
        for status, count in status_counts.items():
            normalized = (status or "").lower()
            if normalized in ("approved", "ready", "released", "final"):
                approved += count
            elif normalized in ("revision", "rejected", "needs revision", "retake"):
                needs_revision += count
        total = sum(status_counts.values())
        return {
            "total": total,
            "approved": approved,
            "needs_revision": needs_revision,
            "in_progress": total - approved - needs_revision,
        }

    @classmethod
    def _review_stats(cls, status_counts: dict[str, int]) -> dict[str, Any]:
        approved = changes_requested = rejected = 0
        for status, count in status_counts.items():
            normalized = (status or "").lower()
            if normalized in ("approved", "closed", "completed"):
                approved += count
            elif normalized in ("changes requested", "retake"):
                changes_requested += count
            elif normalized == "rejected":
                rejected += count
        total = sum(status_counts.values())
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
    def _delivery_stats(cls, rows: list[dict[str, Any]], now) -> dict[str, Any]:
        delivered = late = 0
        for delivery in rows:
            normalized = (delivery["status"] or "").lower()
            expires_at = delivery["expires_at"]
            is_late = (
                expires_at is not None
                and expires_at < now
                and normalized not in ("delivered", "approved", "sent", "complete")
            )
            if is_late:
                late += 1
            elif normalized in ("delivered", "approved", "sent", "accepted", "complete"):
                delivered += 1
        total = len(rows)
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
        organization, today: date,
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
        deadline = cls._next_deadline(organization, project, today)
        if deadline is not None:
            payload["next_deadline"] = deadline
        return payload

    @classmethod
    def _next_deadline(cls, organization, project, today: date) -> dict | None:
        from apps.deliveries.models import DeliveryPackage
        from apps.production.models import Task

        upcoming_task = (
            Task.objects.filter(
                organization=organization, project=project, due_date__gte=today
            )
            .order_by("due_date")
            .first()
        )
        if upcoming_task is not None and upcoming_task.due_date is not None:
            return {
                "title": upcoming_task.title,
                "date": upcoming_task.due_date.isoformat(),
                "days_away": max(0, (upcoming_task.due_date - today).days),
                "type": "Task",
            }
        upcoming_delivery = (
            DeliveryPackage.objects.filter(
                organization=organization,
                project=project,
                expires_at__date__gte=today,
            )
            .order_by("expires_at")
            .first()
        )
        if upcoming_delivery is not None and upcoming_delivery.expires_at is not None:
            due = upcoming_delivery.expires_at.date()
            return {
                "title": upcoming_delivery.name,
                "date": due.isoformat(),
                "days_away": max(0, (due - today).days),
                "type": "Delivery",
            }
        return None

    @classmethod
    def _workload(cls, organization, project, today: date) -> list[dict[str, Any]]:
        from django.db.models import Count

        from apps.production.models import Task

        # Per-(assignee, department) aggregates in one query; merged per
        # assignee below with the busiest department as representative.
        rows = list(
            Task.objects.filter(organization=organization, project=project)
            .values("assignee", "department")
            .annotate(
                assigned=Count("id"),
                in_progress=Count("id", filter=Q(status__iexact="in progress")),
                overdue=Count(
                    "id",
                    filter=Q(~Q(status__iexact="completed"), due_date__lt=today),
                ),
            )
        )
        user_ids = {row["assignee"] for row in rows if row["assignee"] is not None}
        users = cls._users_by_id(user_ids)
        members: dict[str, dict[str, Any]] = {}
        for row in rows:
            assignee_id = row["assignee"]
            if assignee_id is not None:
                key = f"user-{assignee_id}"
                user = users.get(assignee_id)
                name = cls._user_display_name(user) or "Unassigned"
                avatar = cls._user_avatar(user)
            else:
                key = "unassigned"
                name = "Unassigned"
                avatar = None
            member = members.get(key)
            if member is None:
                member = {
                    "id": key,
                    "name": name,
                    "role": "",
                    "department": row["department"] or "",
                    "assigned_count": 0,
                    "in_progress_count": 0,
                    "overdue_count": 0,
                    "workload_level": "normal",
                    "_best_department_count": 0,
                }
                if avatar:
                    member["avatar_url"] = avatar
                members[key] = member
            member["assigned_count"] += row["assigned"]
            member["in_progress_count"] += row["in_progress"]
            member["overdue_count"] += row["overdue"]
            if row["assigned"] > member["_best_department_count"] and row["department"]:
                member["department"] = row["department"]
                member["_best_department_count"] = row["assigned"]
        result = []
        for member in members.values():
            if member["assigned_count"] >= 5 or member["overdue_count"] >= 2:
                member["workload_level"] = "overloaded"
            elif member["assigned_count"] >= 3:
                member["workload_level"] = "high"
            member.pop("_best_department_count", None)
            result.append(member)
        result.sort(key=lambda member: member["assigned_count"], reverse=True)
        return result

    @staticmethod
    def _users_by_id(user_ids: set) -> dict:
        if not user_ids:
            return {}
        try:
            from apps.identity.models import User

            return User.objects.filter(id__in=user_ids).in_bulk()
        except Exception:  # noqa: BLE001
            return {}

    # -- activity -----------------------------------------------------------

    @classmethod
    def _activity(
        cls, project, organization, recent_shots: list, recent_tasks: list
    ) -> list[dict]:
        items = cls._activity_from_changelog(project, organization)
        if items:
            return items
        # No recorded changes yet: surface the most recently touched
        # entities as contextual activity (same fallback as the mock, with
        # real names instead of illustrative literals).
        for shot in recent_shots[:3]:
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
        for task in recent_tasks[:3]:
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
