from apps.identity.api.serializers.user import UserNestedSerializer

from apps.identity.api.serializers.membership.base import MembershipBaseSerializer
from apps.identity.api.serializers.role import RoleNestedSerializer
from apps.organization.api.serializers.department import (
    DepartmentNestedSerializer,
)
from apps.organization.api.serializers.office import (
    OfficeNestedSerializer,
)
from apps.organization.api.serializers.organization import (
    OrganizationNestedSerializer,
)
from apps.organization.api.serializers.team import (
    TeamNestedSerializer,
)


class MembershipReadSerializer(
    MembershipBaseSerializer,
):

    user = UserNestedSerializer(
        read_only=True,
    )

    organization = OrganizationNestedSerializer(
        read_only=True,
    )

    department = DepartmentNestedSerializer(
        read_only=True,
    )

    team = TeamNestedSerializer(
        read_only=True,
    )

    office = OfficeNestedSerializer(
        read_only=True,
    )

    role = RoleNestedSerializer(
        read_only=True,
    )
