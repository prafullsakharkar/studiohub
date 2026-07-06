from .base import IdentityPermission


class IsSelf(
    IdentityPermission,
):

    def has_object_permission(
        self,
        request,
        view,
        obj,
    ):
        return obj == request.user


class IsOwner(
    IdentityPermission,
):

    def has_object_permission(
        self,
        request,
        view,
        obj,
    ):
        return (
            getattr(
                obj,
                "created_by",
                None,
            )
            == request.user
        )
