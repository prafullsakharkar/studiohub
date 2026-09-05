from apps.organization.models import (
    UserSession,
)


class UserSessionSelector:
    """
    Read operations for UserSession in the identity API context.
    """

    @classmethod
    def get_queryset(
        cls,
        *,
        request,
        view,
    ):
        queryset = UserSession.objects.all()

        if view.action in getattr(
            view,
            "admin_actions",
            (),
        ):
            return queryset

        return queryset.by_user(
            request.user,
        )
