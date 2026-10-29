"""
Shared serializer pieces for production write serializers.
"""

from __future__ import annotations

import re
from typing import Any, ClassVar
from uuid import UUID

from django.core.exceptions import FieldDoesNotExist
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator


class LenientUniqueTogetherValidator(UniqueTogetherValidator):
    """
    Unique-together check that tolerates unresolved project references.

    The ``project`` attr may be a raw reference string (UUID, code, or mock
    id) from the ``ProjectReferenceMixin`` aliases instead of a model
    instance. Non-UUID strings cannot match any PK, so the check is skipped
    for them — the viewset resolves the reference (or 400s) and
    enforces natural-key uniqueness itself before saving.
    """

    def filter_queryset(self, attrs, queryset, serializer):
        """Like the parent, but a ``code`` matches whatever its case."""
        sources = [serializer.fields[name].source for name in self.fields]  # pyright: ignore[reportAttributeAccessIssue]
        if serializer.instance is not None:
            for source in sources:
                if source not in attrs:
                    attrs[source] = getattr(serializer.instance, source)
        lookup = {
            (f"{source}__iexact" if source == "code" else source): attrs[source]
            for source in sources
        }
        try:
            return queryset.filter(**lookup)
        except (TypeError, ValueError):
            return queryset.none()

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
    resolves them (UUID/code/mock-id aware) before saving.
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

    def current_value(self, name):
        """The value a sent one is compared with; derived fields override this."""
        if name == "is_archived":  # archived means soft-deleted (D-25); the column is legacy
            return self.instance.is_deleted
        return getattr(self.instance, name)

    def parse_derived(self, name, raw):
        """Parse a sent value of a derived field that has no column (override per field)."""
        return raw

    def derived_default(self, name):
        """What a new record's derived field holds, for fields that have no column."""
        return {"is_archived": False, "sequence_code": ""}.get(name)

    def _changes(self, name, raw) -> bool:
        field = self.fields[name]
        instance = self.instance
        try:
            model_field = None
            if isinstance(field, serializers.SerializerMethodField):
                # A derived field has no input parser of its own: use the model field's, or, when
                # the column is gone (P12), the serializer's own ``parse_derived``.
                try:
                    model_field = self.Meta.model._meta.get_field(name)
                except FieldDoesNotExist:
                    value = self.parse_derived(name, raw)
                else:
                    value = model_field.to_python(raw)
            else:
                value = field.to_internal_value(raw)
                try:
                    model_field = self.Meta.model._meta.get_field(name)
                except FieldDoesNotExist:  # ``is_archived``: derived from the soft delete
                    model_field = None
            if instance is not None:
                return value != self.current_value(name)
            if model_field is None:
                return value != self.derived_default(name)
            return value != model_field.get_default()
        except (serializers.ValidationError, DjangoValidationError, TypeError, ValueError):
            return True


#: spaces and path separators never belong in a code (codes end up in file paths)
_CODE_FORBIDDEN = re.compile(r"[\s/\\]")


class NormalizedCodeMixin:
    """
    Codes are stored upper case, unique per project whatever the case, and free of
    spaces and slashes (DECISIONS D-10).

    On update a changed code must be free (any case). ``code_frozen_by`` names the
    ``Version`` foreign key that freezes the code once a version exists (shots, assets:
    the code is in file and publish names); such a rename goes through the
    ``rename-code`` action instead. Writing the stored code back in another case is
    not a change.
    """

    code_frozen_by: ClassVar[str | None] = None
    instance: Any  # pyright: ignore[reportUninitializedInstanceVariable]

    def validate_code(self, value):
        raw = (value or "").strip()
        if not raw:
            return value
        if _CODE_FORBIDDEN.search(raw):
            raise serializers.ValidationError("A code cannot contain spaces or slashes.")
        code = raw.upper()
        instance = getattr(self, "instance", None)
        if instance is None:
            return code
        if code == instance.code.upper():
            return instance.code
        if self.code_frozen_by:
            from apps.production.models import Version

            if Version.all_objects.filter(**{self.code_frozen_by: instance}).exists():
                raise serializers.ValidationError(
                    "The code is frozen once a version exists. Use the rename-code action."
                )
        taken = (
            type(instance)
            .all_objects.filter(project_id=instance.project_id, code__iexact=code)
            .exclude(pk=instance.pk)
            .exists()
        )
        if taken:
            raise serializers.ValidationError("A record with this code already exists.")
        return code


class FrameRangeMixin:
    """A frame range must not run backwards (the database constraint says the same, as a 409)."""

    frame_range_fields: ClassVar[tuple[str, str]] = ("frame_in", "frame_out")
    instance: Any  # pyright: ignore[reportUninitializedInstanceVariable]

    def validate(self, attrs):
        attrs = super().validate(attrs)  # type: ignore[misc]  # pyright: ignore[reportAttributeAccessIssue]
        first, last = self.frame_range_fields
        stored = getattr(self, "instance", None)
        low = attrs.get(first, getattr(stored, first, None))
        high = attrs.get(last, getattr(stored, last, None))
        if low is not None and high is not None and high < low:
            raise serializers.ValidationError({last: [f"Must not be before {first}."]})
        return attrs
