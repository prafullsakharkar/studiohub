from typing import Any
from uuid import UUID

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.core.api.serializers.base import BaseWriteSerializer
from apps.production.api.serializers.common import ScopedReferenceField
from apps.production.models import Project, Task, Timelog


class TimelogCreateSerializer(BaseWriteSerializer[Any]):
    """Create serializer accepting the frontend Timelog contract.

    The frontend posts mock-style refs (``task_id``/``task_code``,
    ``project_id``/``project_code``, ``person_id``) while the model FKs
    are UUID PKs (``task``/``project``/``person``). Both spellings are
    accepted; tasks resolve among the caller's member projects and the
    viewset derives the project from the task. Unknown mock display ids that cannot
    resolve leave the optional FKs unset (``perform_create`` defaults
    person to the request user and project to the task's project) instead
    of 400ing the whole mutation.
    """

    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)
    # Limited to tasks of the caller's projects; unknown and foreign tasks fail alike.
    task = ScopedReferenceField(
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
    # Only an approved timelog can be adjusted; the viewset checks that and the project.
    adjustment_of = ScopedReferenceField(
        queryset=Timelog.objects.all(), required=False, allow_null=True
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
            "adjustment_of",
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
    # Ref resolution (tasks limited to the caller's member projects)
    # ------------------------------------------------------------------

    @staticmethod
    def _as_uuid(value):
        try:
            return UUID(str(value))
        except (ValueError, AttributeError, TypeError):
            return None

    def _tasks(self):
        from apps.production.selectors.base import ProductionBaseSelector

        request = self.context.get("request")
        if request is None:
            return Task.objects.none()
        return ProductionBaseSelector.scope_by_project_membership(Task.objects.all(), request=request)

    def _resolve_task(self, attrs):
        if attrs.get("task"):
            return attrs["task"]
        project = attrs.get("project")
        task_code = attrs.get("task_code") or ""
        task_ref = attrs.get("task_id") or ""
        candidates = [c for c in (task_code, task_ref) if c]
        for ref in candidates:
            pk = self._as_uuid(ref)
            if pk is not None:
                task = self._tasks().filter(pk=pk).first()
                if task is not None:
                    return task
                continue
            lookup = self._tasks().filter(code=ref)
            if project is not None:
                lookup = lookup.filter(project=project)
            task = lookup.first()
            if task is not None:
                return task
        return None

    def _resolve_project(self, attrs):
        if attrs.get("project"):
            return attrs["project"]
        ref = attrs.get("project_code") or attrs.get("project_id") or ""
        if not ref:
            return None
        pk = self._as_uuid(ref)
        if pk is not None:
            return Project.objects.filter(pk=pk).first()
        return Project.objects.filter(code=ref).first()

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
        original = attrs.get("adjustment_of")
        # Only an adjustment of an approved entry may be negative (DECISIONS: timelogs); an ordinary entry is time worked.
        if original is None and not attrs.get("duration_hours", 0) > 0:
            raise serializers.ValidationError(
                {"duration_hours": ["Hours must be greater than zero. Correct an approved entry with an adjustment."]}
            )
        if person is None and original is not None:
            person = original.person  # an adjustment belongs to the person it corrects
        if person is None:
            request = self.context.get("request")
            user = getattr(request, "user", None)
            if user is not None and getattr(user, "is_authenticated", False):
                person = user
        if person is not None:
            attrs["person"] = person
        # Write-only frontend aliases must not reach the model layer:
        # ``objects.create(task_id='task-001')`` fails UUID prep. The
        # resolved ``task``/``project``/``person`` above carry the values.
        for alias in ("task_id", "task_code", "project_id", "project_code", "person_id"):
            attrs.pop(alias, None)
        return attrs
