from __future__ import annotations

from django.db.models import Count, QuerySet

from apps.identity.models import UserSession
from apps.identity.selectors.base import IdentityBaseSelector


class UserSessionSelector(
    IdentityBaseSelector,
):
    """
    Selector for UserSession.
    """

    model = UserSession

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ) -> QuerySet:
        return UserSession.objects.select_related(
            "user",
            "organization",
            "office",
            "department",
            "team",
        )

    @classmethod
    def by_uuid(
        cls,
        uuid,
    ):
        return (
            cls.get_queryset()
            .filter(
                uuid=uuid,
            )
            .first()
        )

    @classmethod
    def current(
        cls,
        *,
        user,
    ):
        return cls.get_queryset().active().current().for_user(user).first()

    @classmethod
    def active_sessions(
        cls,
        *,
        user,
    ):
        return cls.get_queryset().active().for_user(user)

    @classmethod
    def trusted_sessions(
        cls,
        *,
        user,
    ):
        return cls.get_queryset().active().trusted().for_user(user)

    @classmethod
    def organization_sessions(
        cls,
        *,
        organization,
    ):
        return (
            cls.get_queryset()
            .active()
            .for_organization(
                organization,
            )
        )

    @classmethod
    def office_sessions(
        cls,
        *,
        office,
    ):
        return (
            cls.get_queryset()
            .active()
            .for_office(
                office,
            )
        )

    @classmethod
    def department_sessions(
        cls,
        *,
        department,
    ):
        return (
            cls.get_queryset()
            .active()
            .for_department(
                department,
            )
        )

    @classmethod
    def team_sessions(
        cls,
        *,
        team,
    ):
        return (
            cls.get_queryset()
            .active()
            .for_team(
                team,
            )
        )

    @classmethod
    def expiring(
        cls,
        *,
        minutes=30,
    ):
        return (
            cls.get_queryset()
            .active()
            .expiring(
                minutes=minutes,
            )
        )

    @classmethod
    def expired(
        cls,
    ):
        return cls.get_queryset().expired()

    @classmethod
    def cleanup_queryset(
        cls,
    ):
        return cls.get_queryset().cleanup()

    @classmethod
    def by_refresh_jti(
        cls,
        refresh_token_jti,
    ):
        return (
            cls.get_queryset()
            .filter(
                refresh_token_jti=refresh_token_jti,
            )
            .first()
        )

    @classmethod
    def by_access_jti(
        cls,
        access_token_jti,
    ):
        return (
            cls.get_queryset()
            .filter(
                access_token_jti=access_token_jti,
            )
            .first()
        )

    @classmethod
    def dashboard(
        cls,
        *,
        user,
    ):
        queryset = cls.active_sessions(
            user=user,
        )

        return {
            "total": queryset.count(),
            "trusted": queryset.trusted().count(),
            "current": queryset.current().count(),
            "desktop": queryset.for_device("DESKTOP").count(),
            "mobile": queryset.for_device("MOBILE").count(),
            "tablet": queryset.for_device("TABLET").count(),
        }

    @classmethod
    def statistics(
        cls,
    ):
        queryset = cls.get_queryset()

        return {
            "total": queryset.count(),
            "active": queryset.active().count(),
            "expired": queryset.expired().count(),
            "revoked": queryset.revoked().count(),
            "logged_out": queryset.logged_out().count(),
            "trusted": queryset.trusted().count(),
        }

    @classmethod
    def browser_statistics(
        cls,
    ):
        return (
            cls.get_queryset()
            .values("browser")
            .annotate(
                total=Count("id"),
            )
            .order_by("-total")
        )

    @classmethod
    def device_statistics(
        cls,
    ):
        return (
            cls.get_queryset()
            .values("device_type")
            .annotate(
                total=Count("id"),
            )
            .order_by("-total")
        )

    @classmethod
    def os_statistics(
        cls,
    ):
        return (
            cls.get_queryset()
            .values("operating_system")
            .annotate(
                total=Count("id"),
            )
            .order_by("-total")
        )
