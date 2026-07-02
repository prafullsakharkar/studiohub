from .summary import DepartmentSummarySerializer


class DepartmentListSerializer(
    DepartmentSummarySerializer,
):
    """
    Dedicated list serializer.

    Reserved for future list-only fields.
    """

    pass
