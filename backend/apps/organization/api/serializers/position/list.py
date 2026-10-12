
from rest_framework import serializers

from .base import PositionBaseSerializer


class PositionListSerializer(
    PositionBaseSerializer,
):
    # UI display names (same denormalized-name pattern as
    # DepartmentSerializer.head_name): the Positions tab renders
    # title/department_name and must not guess them client-side.
    title = serializers.CharField(source="name", read_only=True)
    department_name = serializers.CharField(
        source="department.name", read_only=True, allow_null=True
    )
    headcount = serializers.SerializerMethodField()

    def get_headcount(self, obj):
        # Prefer the selector annotation (single query for the whole list);
        # fall back to a per-object count when serializing outside it.
        annotated = getattr(obj, "headcount_value", None)
        if annotated is not None:
            return annotated
        return obj.persons.filter(is_deleted=False).count()

    class Meta(
        PositionBaseSerializer.Meta,
    ):
        fields = (
            "id",
            "uuid",
            "code",
            "name",
            "title",
            "organization",
            "scope",
            "department",
            "department_name",
            "level",
            "is_managerial",
            "band_level",
            "salary_range",
            "employment_type",
            "headcount",
        )
