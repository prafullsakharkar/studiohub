from .base import IdentityPermission


class IsTeamLead(
    IdentityPermission,
):

    def has_permission(
        self,
        request,
        view,
    ):
        return True
