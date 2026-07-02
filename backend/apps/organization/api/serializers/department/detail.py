from .base import DepartmentSerializer


class DepartmentDetailSerializer(
    DepartmentSerializer,
):

    class Meta(DepartmentSerializer.Meta):

        fields = "__all__"
