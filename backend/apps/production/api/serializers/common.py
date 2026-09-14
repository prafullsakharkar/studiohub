"""
Shared serializer pieces for production write serializers.
"""

from __future__ import annotations

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
