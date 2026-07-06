from apps.identity.querysets.base import (
    IdentityQuerySet,
)


class UserPreferenceQuerySet(
    IdentityQuerySet,
):
    """
    QuerySet for UserPreference.
    """

    def for_user(
        self,
        user,
    ):
        return self.filter(
            user=user,
        )

    def for_organization(
        self,
        organization,
    ):
        return self.filter(
            default_organization=organization,
        )

    def with_language(
        self,
        language,
    ):
        return self.filter(
            language=language,
        )

    def with_timezone(
        self,
        timezone,
    ):
        return self.filter(
            timezone=timezone,
        )

    def with_theme(
        self,
        theme,
    ):
        return self.filter(
            theme=theme,
        )
