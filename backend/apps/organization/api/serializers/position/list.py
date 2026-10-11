
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
