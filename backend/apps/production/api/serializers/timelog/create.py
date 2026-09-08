from typing import Any
from uuid import UUID

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.models import Project, Task, Timelog


class TimelogCreateSerializer(BaseWriteSerializer[Any]):
    """Create serializer accepting the frontend Timelog contract.

    The frontend posts mock-style refs (``task_id``/``task_code``,
    ``project_id``/``project_code``, ``person_id``) while the model FKs
    are UUID PKs (``task``/``project``/``person``). Both spellings are
    accepted; refs resolve org-scoped so tenant isolation holds. Unknown
    mock display ids that cannot resolve leave the optional FKs unset
    (``perform_create`` defaults person to the request user and project
    to the task's project) instead of 400ing the whole mutation.
    """

    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    task = serializers.PrimaryKeyRelatedField(
        queryset=Task.objects.all(),
        required=False,
        allow_null=True,
    )
    person = serializers.PrimaryKeyRelatedField(
        queryset=Timelog._meta.get_field("person").remote_field.model.objects.all(),
        required=False,
        allow_null=True,
    )
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        required=False,
        allow_null=True,
    )
    task_id = serializers.CharField(write_only=True, required=False, allow_blank=True)
    task_code = serializers.CharField(write_only=True, required=False, allow_blank=True)
    project_id = serializers.CharField(write_only=True, required=False, allow_blank=True)
    project_code = serializers.CharField(write_only=True, required=False, allow_blank=True)
    person_id = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Timelog
        fields = (
            "id",
            "uuid",
            "task",
            "task_id",
            "task_code",
            "project",
            "project_id",
            "project_code",
            "person",
            "person_id",
            "department",
            "duration_hours",
            "date",
            "billable",
            "notes",
            "status",
            "activity_category",
            "hourly_rate_usd",
        )
        read_only_fields = ("id", "uuid")

    # ------------------------------------------------------------------
    # Ref resolution (org-scoped)
    # ------------------------------------------------------------------

    def _scope_orgs(self):
        request = self.context.get("request")
        org = getattr(request, "organization", None)
        if org is not None:
            return [org]
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            return list(
                user.organization_memberships.values_list("organization_id", flat=True)
            )
        return []

    @staticmethod
    def _as_uuid(value):
        try:
            return UUID(str(value))
        except (ValueError, AttributeError, TypeError):
            return None

    def _resolve_task(self, attrs):
        if attrs.get("task"):
            return attrs["task"]
        orgs = self._scope_orgs()
        project = attrs.get("project")
        task_code = attrs.get("task_code") or ""
        task_ref = attrs.get("task_id") or ""
        candidates = [c for c in (task_code, task_ref) if c]
        for ref in candidates:
            pk = self._as_uuid(ref)
            if pk is not None:
                task = Task.objects.filter(pk=pk).first()
                if task is not None and (not orgs or task.organization_id in [o.pk if hasattr(o, "pk") else o for o in orgs]):
                    return task
                continue
            lookup = Task.objects.filter(code=ref)
            if project is not None:
                lookup = lookup.filter(project=project)
            elif orgs:
                lookup = lookup.filter(organization_id__in=orgs)
            task = lookup.first()
            if task is not None:
                return task
        return None

    def _resolve_project(self, attrs):
        if attrs.get("project"):
            return attrs["project"]
        orgs = self._scope_orgs()
        ref = attrs.get("project_code") or attrs.get("project_id") or ""
        if not ref:
            return None
        pk = self._as_uuid(ref)
        if pk is not None:
            return Project.objects.filter(pk=pk).first()
        lookup = Project.objects.filter(code=ref)
        if orgs:
            lookup = lookup.filter(organization_id__in=orgs)
        return lookup.first()

    def _resolve_person(self, attrs):
        if attrs.get("person"):
            return attrs["person"]
        ref = attrs.get("person_id") or ""
        if not ref:
            return None
        user_model = get_user_model()
        pk = self._as_uuid(ref)
        if pk is not None:
            user = user_model.objects.filter(pk=pk).first()
            if user is not None:
                return user
        if "@" in ref:
            return user_model.objects.filter(email__iexact=ref).first()
        return None

    def validate(self, attrs):
        attrs = super().validate(attrs)
        attrs["project"] = self._resolve_project(attrs)
        task = self._resolve_task(attrs)
        if task is None:
            received = {
                key: attrs.get(key)
                for key in ("task_id", "task_code")
                if attrs.get(key)
            }
            raise serializers.ValidationError(
                {"task": [f"Task not found for {received or 'empty references'}."]}
            )
        attrs["task"] = task
        if attrs["project"] is None:
            attrs["project"] = getattr(task, "project", None)
        person = self._resolve_person(attrs)
        if person is None:
            request = self.context.get("request")
            user = getattr(request, "user", None)
            if user is not None and getattr(user, "is_authenticated", False):
                person = user
        if person is not None:
            attrs["person"] = person
        project = attrs["project"]
        if project is not None:
            attrs["organization"] = project.organization
        else:
            attrs["organization"] = getattr(task, "organization", None)
        if attrs["organization"] is None:
            request = self.context.get("request")
            attrs["organization"] = getattr(request, "organization", None)
        # Write-only frontend aliases must not reach the model layer:
        # ``objects.create(task_id='task-001')`` fails UUID prep. The
        # resolved ``task``/``project``/``person`` above carry the values.
        for alias in ("task_id", "task_code", "project_id", "project_code", "person_id"):
            attrs.pop(alias, None)
        return attrs
