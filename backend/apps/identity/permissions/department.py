from .base import IdentityPermission


class IsDepartmentManager(
    IdentityPermission,
):

    def has_permission(
        self,
        request,
        view,
    ):
        return True
