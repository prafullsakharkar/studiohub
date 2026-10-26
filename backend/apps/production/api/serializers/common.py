"""
Shared serializer pieces for production write serializers.
"""

from __future__ import annotations

from typing import Any, ClassVar
from uuid import UUID

from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator


class LenientUniqueTogetherValidator(UniqueTogetherValidator):
    """
    Unique-together check that tolerates unresolved project references.

    The ``project`` attr may be a raw reference string (UUID, code, or mock
    id) from the ``ProjectReferenceMixin`` aliases instead of a model
    instance. Non-UUID strings cannot match any PK, so the check is skipped
    for them — the viewset resolves the reference org-scoped (or 400s) and
    enforces natural-key uniqueness itself before saving.
    """

    def __call__(self, attrs, serializer):
        project = attrs.get("project")
        if isinstance(project, str):
            try:
                UUID(str(project))
            except (ValueError, AttributeError, TypeError):
                return
        super().__call__(attrs, serializer)


class ProjectReferenceMixin(serializers.Serializer):  # type: ignore[type-arg]
    """
    Accept the frontend contract's project references on create.

    The UI sends ``project_id`` (UUID string, real id or mock id like
    ``proj-001``) and ``project_code`` instead of the ``project`` PK field.
    These write-only aliases land in ``validated_data["project"]`` as raw
    strings so unique-together validation still sees the field; the viewset
    resolves them org-scoped (UUID/code/mock-id aware) before saving.
    """

    project_id = serializers.CharField(
        source="project", write_only=True, required=False, allow_blank=True
    )
    project_code = serializers.CharField(
        source="project", write_only=True, required=False, allow_blank=True
    )


class ScopedReferenceField(serializers.PrimaryKeyRelatedField):  # type: ignore[type-arg]  # pyright: ignore[reportMissingTypeArgument]
    """
    Reference to a project-owned record, limited to the caller's projects.

    A malformed id, an unknown id and the id of a record in a project the
    caller is not a member of all fail with the same message, so the answer
    reveals nothing about records the caller cannot see. The viewset then
    checks that the record belongs to the project being written to.
    """

    default_error_messages = {
        "required": "This field is required.",
        "null": "This field may not be null.",
        "does_not_exist": "Unknown {label}.",
        "incorrect_type": "Unknown {label}.",
    }

    def fail(self, key, **kwargs):
        # Same wording as ``validators.references`` so a record of another
        # project reads exactly like one that does not exist.
        kwargs.setdefault(
            "label", (self.field_name or "reference").removesuffix("_id").replace("_", " ")
        )
        super().fail(key, **kwargs)

    def get_queryset(self):
        from apps.production.selectors.base import ProductionBaseSelector

        queryset = super().get_queryset()
        request = self.context.get("request")
        if queryset is None or request is None:
            return queryset
        return ProductionBaseSelector.scope_by_project_membership(queryset, request=request)


class LockedFieldsMixin:
    """
    Write serializer that rejects fields which change only through actions.

    ``locked_fields`` maps a field name to the hint shown in the error. The
    fields stay in ``Meta.fields`` (responses keep their shape) but must be in
    ``read_only_fields``. Sending one with a value different from the stored
    one (or, on create, from the model default) is a 400; echoing the stored
    value back, as a full PUT does, is accepted and ignored.
    """

    locked_fields: ClassVar[dict[str, str]] = {}
    fields: Any  # pyright: ignore[reportUninitializedInstanceVariable]
    instance: Any  # pyright: ignore[reportUninitializedInstanceVariable]
    Meta: Any  # pyright: ignore[reportUninitializedInstanceVariable]

    def to_internal_value(self, data):
        errors = {}
        for name, hint in self.locked_fields.items():
            if name in data and self._changes(name, data[name]):
                errors[name] = [f"Cannot be set directly. {hint}"]
        if errors:
            raise serializers.ValidationError(errors)
        return super().to_internal_value(data)  # type: ignore[misc]  # pyright: ignore[reportAttributeAccessIssue]

    def _changes(self, name, raw) -> bool:
        field = self.fields[name]
        instance = self.instance
        try:
            value = field.to_internal_value(raw)
            if instance is not None:
                return value != getattr(instance, name)
            return value != self.Meta.model._meta.get_field(name).get_default()
        except (serializers.ValidationError, TypeError, ValueError):
            return True
