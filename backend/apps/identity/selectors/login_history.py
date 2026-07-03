from apps.identity.models import LoginHistory
from apps.identity.selectors.base import IdentityBaseSelector


class LoginHistorySelector(
    IdentityBaseSelector,
):

    model = LoginHistory

    @classmethod
    def get_queryset(
        cls,
        *,
        request=None,
        view=None,
    ):
        return cls.model.objects.with_related()
