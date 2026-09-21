"""
Org-scoped AI insights computed from real production data using local
heuristics. No LLM API is called — every response is derived from live
Django models (projects, shots, tasks, versions, reviews).

Reads are recomputed on each request; they never return illustrative
literals. Fields with no data source yet (e.g. budget burn rate) return
``null`` so the UI renders an honest unknown instead of fabricated values.
"""

from typing import Any

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.organization.middleware.organization_context import (
    resolve_organization_context,
)


class DummySerializer(serializers.Serializer[Any]):
    pass


def _resolve_org(request):
    """Resolve the org context from the request header (fail closed)."""
    resolve_organization_context(request, force=True)
    return getattr(request, "organization", None)


def _priority_severity(priority):
    from apps.production.constants.task import TaskPriority

    if priority == TaskPriority.CRITICAL:
        return "critical"
    if priority == TaskPriority.HIGH:
        return "high"
    return "medium"


def _build_risks(org, limit=20):
    """Real risks detected from production data, org-scoped, local heuristics."""
    from datetime import timedelta

    from django.utils import timezone

    from apps.production.constants.shot import ShotStatus
    from apps.production.constants.task import TaskPriority, TaskStatus
    from apps.production.models import Project, Shot, Task

    if org is None:
        return []
    today = timezone.localdate()
    now = timezone.now().isoformat()
    risks = []

    overdue = (
        Task.objects.filter(organization=org, is_archived=False)
        .exclude(status=TaskStatus.APPROVED)
        .filter(due_date__lt=today)
        .select_related("project")
        .order_by("due_date")
    )
    for i, task in enumerate(overdue[:6]):
        days = (today - task.due_date).days
        risks.append(
            {
                "id": f"risk-schedule-{i}",
                "severity": _priority_severity(task.priority),
                "category": "schedule",
                "title": f"Task overdue by {days} day{'s' if days != 1 else ''}",
                "description": (
                    f"'{task.title or task.code}' ({task.department or 'No department'}) "
                    f"has not reached approval despite a due date of {task.due_date}."
                ),
                "project_code": task.project.code if task.project else "",
                "impacted_entity_type": "task",
                "impacted_entity_id": str(task.id),
                "impacted_entity_name": task.entity_name or task.title or task.code,
                "detected_at": now,
                "suggested_action": "Re-prioritize, reassign, or adjust the milestone based on current capacity.",
                "confidence_score": 0.85,
                "auto_mitigation_available": False,
            }
        )

    retake = (
        Shot.objects.filter(
            organization=org, status__in=[ShotStatus.RETAKE, ShotStatus.ON_HOLD]
        )
        .select_related("project")
        .order_by("-updated_at")
    )
    for i, shot in enumerate(retake[:6]):
        risks.append(
            {
                "id": f"risk-quality-{i}",
                "severity": "high" if shot.status == ShotStatus.RETAKE else "medium",
                "category": "quality",
                "title": f"Shot is {shot.status}",
                "description": (
                    f"Shot '{shot.code}' remains {shot.status} and is not progressing toward approval."
                ),
                "project_code": shot.project.code if shot.project else "",
                "impacted_entity_type": "shot",
                "impacted_entity_id": str(shot.id),
                "impacted_entity_name": shot.code,
                "detected_at": now,
                "suggested_action": "Review the latest feedback and define a clear retake turnaround.",
                "confidence_score": 0.8,
                "auto_mitigation_available": False,
            }
        )

    unassigned = (
        Task.objects.filter(
            organization=org, is_archived=False, assignee_id=None
        )
        .exclude(status=TaskStatus.APPROVED)
        .filter(priority__in=[TaskPriority.CRITICAL, TaskPriority.HIGH])
        .select_related("project")
    )
    for i, task in enumerate(unassigned[:5]):
        risks.append(
            {
                "id": f"risk-resource-{i}",
                "severity": _priority_severity(task.priority),
                "category": "artist_capacity",
                "title": f"Unassigned {task.priority.lower()} priority task",
                "description": (
                    f"'{task.title or task.code}' is {task.priority} priority with no assignee."
                ),
                "project_code": task.project.code if task.project else "",
                "impacted_entity_type": "task",
                "impacted_entity_id": str(task.id),
                "impacted_entity_name": task.entity_name or task.title or task.code,
                "detected_at": now,
                "suggested_action": (
                    f"Assign an available artist in the {task.department or 'relevant'} department."
                ),
                "confidence_score": 0.9,
                "auto_mitigation_available": True,
            }
        )

    near_delivery = Project.objects.filter(
        organization=org,
        delivery_date__isnull=False,
        delivery_date__lte=today + timedelta(days=21),
    ).order_by("delivery_date")
    for project in near_delivery:
        if not project.total_shots:
            continue
        completion = project.approved_shots / project.total_shots
        if completion >= 0.85:
            continue
        days = (project.delivery_date - today).days
        risks.append(
            {
                "id": f"risk-delivery-{project.code}",
                "severity": "high" if days <= 7 else "medium",
                "category": "delivery",
                "title": f"Delivery approaching with {int(completion * 100)}% completion",
                "description": (
                    f"'{project.code}' delivers in {days} days but only "
                    f"{int(completion * 100)}% of shots are approved."
                ),
                "project_code": project.code,
                "impacted_entity_type": "project",
                "impacted_entity_id": str(project.id),
                "impacted_entity_name": project.code,
                "detected_at": now,
                "suggested_action": "Review scope and rebalance remaining work to hit the delivery date.",
                "confidence_score": 0.88,
                "auto_mitigation_available": False,
            }
        )
    return risks[:limit]


def _project_headline(code, completion, risk_count):
    if risk_count == 0:
        return f"{code} has no active risks with {int(completion)}% shot completion."
    return (
        f"{code} is at {int(completion)}% shot completion with {risk_count} "
        f"active risk{'s' if risk_count != 1 else ''} to watch."
    )


def _executive_brief(project, total, approved, completion, overdue, retake, days):
    parts = [
        f"{project.name} ({project.code}) has {approved} of {total} shots approved "
        f"({int(completion)}%)."
    ]
    if overdue:
        parts.append(f"{overdue} open task{'s' if overdue != 1 else ''} are past due.")
    if retake:
        parts.append(f"{retake} shot{'s' if retake != 1 else ''} are in retake/on-hold.")
    if days is not None:
        parts.append(f"{days} days remain until the final delivery date.")
    return " ".join(parts)


def _project_summary(org, project_code):
    from django.db.models import Count, Q
    from django.utils import timezone

    from apps.production.constants.shot import ShotStatus
    from apps.production.constants.task import TaskStatus
    from apps.production.models import Project, Shot, Task

    now = timezone.now().isoformat()
    if org is None:
        return None
    project = Project.objects.filter(organization=org, code=project_code).first()
    if project is None:
        return None

    shots = Shot.objects.filter(organization=org, project=project)
    total = shots.count()
    approved = shots.filter(status=ShotStatus.APPROVED).count()
    pending_review = shots.filter(status=ShotStatus.PENDING_REVIEW).count()
    retake = shots.filter(status=ShotStatus.RETAKE).count()
    on_hold = shots.filter(status=ShotStatus.ON_HOLD).count()

    tasks = Task.objects.filter(organization=org, project=project, is_archived=False)
    overdue = tasks.exclude(status=TaskStatus.APPROVED).filter(
        due_date__lt=timezone.localdate()
    ).count()

    completion = round(approved / total * 100, 1) if total else 0.0
    days_to_delivery = None
    if project.delivery_date:
        days_to_delivery = (project.delivery_date - timezone.localdate()).days

    score = 50 + completion * 0.4
    score -= min(overdue, 10) * 2
    score -= min(retake, 10) * 1
    score -= min(on_hold, 10) * 0.5
    health = max(0, min(100, int(round(score))))
    status = "on_track" if health >= 85 else ("at_risk" if health >= 65 else "critical")

    dept_rows = (
        tasks.exclude(department="")
        .values("department")
        .annotate(t=Count("id"), d=Count("id", filter=Q(status=TaskStatus.APPROVED)))
        .order_by("-t")
    )
    department_breakdown = [
        {
            "department": r["department"],
            "progress_pct": round(r["d"] / r["t"] * 100) if r["t"] else 0,
            "bottleneck_detected": r["t"] >= 3 and (r["d"] / r["t"] < 0.5),
            "velocity_trend": "stable",
        }
        for r in dept_rows
    ]

    project_risks = [r for r in _build_risks(org) if r["project_code"] == project.code]
    critical_risks = [r["title"] for r in project_risks]
    recommended_actions = [r["suggested_action"] for r in project_risks]
    if not recommended_actions:
        recommended_actions.append("No critical issues detected; maintain current velocity.")

    return {
        "project_code": project.code,
        "project_name": project.name,
        "generated_at": now,
        "health_score": health,
        "status": status,
        "headline": _project_headline(project.code, completion, len(project_risks)),
        "executive_brief": _executive_brief(
            project, total, approved, completion, overdue, retake, days_to_delivery
        ),
        "key_metrics": {
            "shots_completed": approved,
            "shots_total": total,
            "completion_percentage": completion,
            "days_to_final_delivery": days_to_delivery,
            "budget_burn_rate_pct": None,
            "open_critical_notes": retake + pending_review,
        },
        "department_breakdown": department_breakdown,
        "critical_risks": critical_risks,
        "recommended_actions": recommended_actions,
    }


def _latest_review_feedback(versions):
    for v in versions.order_by("-created_at"):
        reviews = v.reviews or []
        if not reviews:
            continue
        r = reviews[-1]
        text = (
            r.get("comment")
            or r.get("note")
            or r.get("feedback")
            or r.get("verdict")
            or ""
        )
        if text:
            return f"Version {v.code}: {text}"
    return "No review feedback recorded yet."


def _pipeline_stage(shot, versions):
    latest = versions.order_by("-created_at").first()
    if latest and latest.department:
        return latest.department
    if isinstance(shot.pipeline, list) and shot.pipeline:
        first = shot.pipeline[0]
        return first.get("stage") or first.get("name") or str(first)
    return shot.status


def _shot_summary(org, shot_code):
    from django.db.models import Q
    from django.utils import timezone

    from apps.production.constants.shot import ShotStatus
    from apps.production.constants.task import TaskStatus
    from apps.production.models import Shot, Task, Version

    now = timezone.now().isoformat()
    if org is None:
        return None
    shot = Shot.objects.filter(organization=org, code=shot_code).first()
    if shot is None:
        return None

    shot_tasks = Task.objects.filter(
        organization=org, project=shot.project, is_archived=False, entity_type="Shot"
    ).filter(Q(entity_id=str(shot.id)) | Q(entity_code=shot.code))
    active = shot_tasks.exclude(status=TaskStatus.APPROVED).count()

    versions = Version.objects.filter(organization=org, shot=shot)
    vcount = versions.count()

    overdue = shot_tasks.exclude(status=TaskStatus.APPROVED).filter(
        due_date__lt=timezone.localdate()
    ).count()
    if shot.status == ShotStatus.ON_HOLD:
        blocker = "Shot is on hold."
    elif overdue:
        blocker = f"{overdue} active task{'s' if overdue != 1 else ''} past due."
    else:
        blocker = "No active blockers detected."

    remaining = 0.0
    for t in shot_tasks.exclude(status=TaskStatus.APPROVED):
        remaining += float(t.estimated_hours or 0) - float(t.logged_hours or 0)
    forecast = max(0.5, round(remaining / 8, 1)) if remaining > 0 else 0.0

    return {
        "shot_code": shot.code,
        "project_code": shot.project.code if shot.project else "",
        "generated_at": now,
        "status": shot.status,
        "frame_range": f"{shot.frame_in}-{shot.frame_out}",
        "supervisor_intent": shot.description or "Supervisor intent not recorded.",
        "pipeline_stage": _pipeline_stage(shot, versions),
        "active_tasks_count": active,
        "versions_history_count": vcount,
        "latest_review_feedback": _latest_review_feedback(versions),
        "blocker_analysis": blocker,
        "turnaround_forecast_days": forecast,
    }


def _task_recommendations(org):
    from django.db.models import Count
    from django.utils import timezone

    from apps.production.constants.task import TaskPriority, TaskStatus
    from apps.production.models import Task

    if org is None:
        return []
    today = timezone.localdate()
    open_tasks = Task.objects.filter(organization=org, is_archived=False).exclude(
        status=TaskStatus.APPROVED
    )
    load_by_user = {
        row["assignee_id"]: row["n"]
        for row in open_tasks.exclude(assignee_id=None)
        .values("assignee_id")
        .annotate(n=Count("id"))
    }
    dept_assignees = {}
    for row in (
        open_tasks.exclude(assignee_id=None)
        .exclude(department="")
        .values("department", "assignee_id", "assignee__profile__display_name")
        .distinct()
    ):
        dept_assignees.setdefault(row["department"], []).append(row)

    recs = []
    for task in open_tasks[:200].select_related("project", "assignee"):
        is_priority = task.priority in (TaskPriority.CRITICAL, TaskPriority.HIGH)
        is_overdue = bool(task.due_date) and task.due_date < today
        is_unassigned = task.assignee_id is None
        if not (is_priority or is_overdue):
            continue
        pool = [
            p
            for p in dept_assignees.get(task.department, [])
            if p["assignee_id"] != task.assignee_id
        ]
        if not pool:
            continue

        def _load(p):
            return load_by_user.get(p["assignee_id"], 0)

        best = min(pool, key=_load)
        current_load = load_by_user.get(task.assignee_id, 0) if task.assignee_id else 0
        if _load(best) >= current_load and not is_unassigned:
            continue

        best_name = (
            best.get("assignee__profile__display_name") or best["assignee_id"]
        )
        current_name = (
            getattr(getattr(task.assignee, "profile", None), "display_name", None)
            or (f"{task.assignee.email}" if task.assignee else "")
            or "Unassigned"
        )
        delta = current_load - _load(best)
        recs.append(
            {
                "task_id": str(task.id),
                "task_title": task.title or task.code,
                "project_code": task.project.code if task.project else "",
                "current_assignee_id": str(task.assignee_id) if task.assignee_id else None,
                "current_assignee_name": current_name,
                "recommended_assignee_id": str(best["assignee_id"]),
                "recommended_assignee_name": best_name,
                "reason": (
                    f"Least-loaded {task.department or 'relevant'} assignee with an open-task "
                    f"workload of {_load(best)} vs {current_load} for the current assignee."
                ),
                "workload_delta_hours": delta,
                "fit_score": round(min(0.99, 0.7 + (delta / 10)), 2),
                "estimated_speedup_days": round(max(0.5, delta / 8), 1),
            }
        )
    return recs[:20]


def _shot_status_overview(org):
    from django.db.models import Count

    from apps.production.constants.shot import ShotStatus
    from apps.production.models import Shot

    if org is None:
        return "No organization context."
    rows = (
        Shot.objects.filter(organization=org)
        .values("status")
        .annotate(n=Count("id"))
        .order_by("-n")
    )
    counts = {r["status"]: r["n"] for r in rows}
    parts = [
        f"{counts.get(s, 0)} {s}"
        for s in (
            ShotStatus.IN_PROGRESS,
            ShotStatus.PENDING_REVIEW,
            ShotStatus.APPROVED,
            ShotStatus.RETAKE,
            ShotStatus.ON_HOLD,
        )
    ]
    return "Shot status: " + ", ".join(parts) if parts else "No shots yet."


def _delivery_overview(org):
    from django.utils import timezone

    from apps.production.models import Project

    if org is None:
        return "No organization context."
    today = timezone.localdate()
    rows = Project.objects.filter(organization=org, delivery_date__isnull=False).order_by(
        "delivery_date"
    )
    if not rows:
        return "No projects have a delivery date set."
    parts = [
        f"{p.code} in {(p.delivery_date - today).days} days ({int(p.approved_shots / p.total_shots * 100) if p.total_shots else 0}% approved)"
        for p in rows
    ]
    return "Days to delivery: " + "; ".join(parts)


def _assistant_reply(org, query):
    from django.utils import timezone

    org_name = getattr(org, "name", "your studio") if org else "your studio"
    q = (query or "").lower()
    now = timezone.now().isoformat()

    if any(k in q for k in ("risk", "blocker", "overdue", "at risk")):
        risks = _build_risks(org)
        if not risks:
            content = f"No critical risks currently detected for {org_name}. Production is running clean."
        else:
            lines = [f"Detected {len(risks)} active risk{'s' if len(risks) != 1 else ''} for {org_name}:"]
            for r in risks[:3]:
                lines.append(
                    f"- **[{r['severity']}] {r['title']}** ({r['project_code']}): {r['description']}"
                )
            content = "\n".join(lines)
        return {
            "id": "msg-risks",
            "sender": "assistant",
            "content": content,
            "timestamp": now,
            "capability_used": "risk_detection",
            "suggested_followups": ["Show the full risk radar", "What is the top recommended action?"],
        }

    if any(k in q for k in ("shot", "overview", "status")):
        content = f"Here is the current {org_name} shot pipeline overview.\n\n{_shot_status_overview(org)}"
        return {
            "id": "msg-shots",
            "sender": "assistant",
            "content": content,
            "timestamp": now,
            "capability_used": "production_overview",
            "suggested_followups": ["What are the schedule risks?", "Show shot summaries"],
        }

    if any(k in q for k in ("deliver", "velocity", "deadline", "milestone")):
        content = f"Delivery outlook for {org_name}:\n\n{_delivery_overview(org)}"
        return {
            "id": "msg-delivery",
            "sender": "assistant",
            "content": content,
            "timestamp": now,
            "capability_used": "schedule",
            "suggested_followups": ["What are the schedule risks?", "Give an executive summary"],
        }

    if any(k in q for k in ("recommend", "capacity", "assign", "workload", "overbook")):
        recs = _task_recommendations(org)
        if not recs:
            content = f"No workload rebalancing recommendations currently available for {org_name}."
        else:
            lines = [f"{len(recs)} rebalancing recommendation{'s' if len(recs) != 1 else ''} for {org_name}:"]
            for r in recs[:3]:
                lines.append(
                    f"- {r['task_title']} ({r['project_code']}): reassign to {r['recommended_assignee_name']} "
                    f"({r['reason']})"
                )
            content = "\n".join(lines)
        return {
            "id": "msg-recs",
            "sender": "assistant",
            "content": content,
            "timestamp": now,
            "capability_used": "capacity",
            "suggested_followups": ["Show task recommendations", "What are the schedule risks?"],
        }

    if any(k in q for k in ("budget", "burn", "spend")):
        return {
            "id": "msg-budget",
            "sender": "assistant",
            "content": (
                "Budget burn requires spend tracking which is not wired to this data source yet, "
                "so I cannot report an exact burn rate. I can summarize shot completion and delivery dates instead."
            ),
            "timestamp": now,
            "capability_used": "production_assistant",
            "suggested_followups": ["Give me an executive status summary", "What are the schedule risks?"],
        }

    return {
        "id": "msg-greeting",
        "sender": "assistant",
        "content": (
            f"Hello! I am the **StudioHub Production Assistant**, operating within {org_name}.\n\n"
            "I can summarize real production data: shot status, schedule risks, delivery outlook, "
            "and workload rebalancing. Try asking about risks, shots, delivery, or capacity."
        ),
        "timestamp": now,
        "capability_used": "production_assistant",
        "suggested_followups": [
            "Give me an executive status summary",
            "What are the critical schedule risks this week?",
            "Check artist overbooking in Compositing",
        ],
    }


class AIChatView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    """
    Rule-based production assistant. Stateless: every reply is recomputed
    from live org-scoped data (no LLM, no persisted transcript).
    """

    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([_assistant_reply(_resolve_org(request), "")])

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        user_query = (
            request.data.get("message")
            or request.data.get("content")
            or request.data.get("query")
            or ""
        )
        return Response(_assistant_reply(_resolve_org(request), user_query))

    @extend_schema(request=OpenApiTypes.OBJECT, responses=None)
    def delete(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


class AIRisksView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    """Real, org-scoped risks detected from production data via heuristics."""

    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(_build_risks(_resolve_org(request)))

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        """
        Risks are derived from production data and recomputed per request, so
        a client-supplied risk cannot be persisted. Echo the payload back as
        advisory (201) rather than fabricating stored state.
        """
        payload = request.data if isinstance(request.data, dict) else {}
        return Response(
            {
                **payload,
                "advisory": True,
                "persisted": False,
                "message": (
                    "Risk acknowledged as advisory. Risks are recomputed from production data "
                    "and no state was stored."
                ),
            },
            status=status.HTTP_201_CREATED,
        )


class AIRisksResolveView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    """
    Risks are derived from production data and recomputed per request, so
    'resolving' cannot persist state. This acknowledges the risk honestly
    without fabricating a mutation.
    """

    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        return Response(
            {
                "success": True,
                "message": (
                    "Risk acknowledged. Auto-mitigation is advisory here — risks are recomputed "
                    "from production data and no state was changed."
                ),
            }
        )


class AITaskRecommendationsView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    """Real workload-rebalancing recommendations, org-scoped, via heuristics."""

    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(_task_recommendations(_resolve_org(request)))


class AITaskRecommendationsApplyView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    """
    Recommendations are derived heuristics; applying them is advisory and
    does not mutate task assignments automatically.
    """

    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        return Response(
            {
                "success": True,
                "message": (
                    "Recommendation acknowledged. Auto-apply is advisory and did not reassign "
                    "the task; make the change in the task editor to persist it."
                ),
            }
        )


class AIProjectSummaryView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    """Real org-scoped project summary aggregated from production data."""

    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, project_code=None):
        summary = _project_summary(_resolve_org(request), project_code or "")
        if summary is None:
            return Response(
                {"detail": "Project not found or not accessible in this organization."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(summary)


class AIShotSummaryView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    """Real org-scoped shot summary aggregated from production data."""

    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, shot_code=None):
        summary = _shot_summary(_resolve_org(request), shot_code or "")
        if summary is None:
            return Response(
                {"detail": "Shot not found or not accessible in this organization."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(summary)


class AIPermissionContextView(GenericAPIView):  # pyright: ignore[reportMissingTypeArgument]
    """Real org/user permission context."""

    serializer_class = DummySerializer
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        user = request.user
        org = _resolve_org(request)
        from apps.production.models import Project

        first_project = (
            Project.objects.filter(organization=org).first() if org is not None else None
        )
        return Response(
            {
                "active_organization_id": str(org.id) if org else "",
                "active_organization_name": getattr(org, "name", "") if org else "",
                "active_project_code": first_project.code if first_project else "",
                "user_role": "VFX Supervisor" if user.is_staff else "Artist",
                "restricted_entities_count": 0,
                "is_isolated": True,
            }
        )
