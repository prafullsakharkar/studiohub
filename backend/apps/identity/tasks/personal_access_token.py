from celery import shared_task

from apps.identity.models import (
    PersonalAccessToken,
)


@shared_task
def deactivate_expired_personal_access_tokens():
    """
    Deactivate expired Personal Access Tokens.
    """
    queryset = PersonalAccessToken.objects.expired().filter(
        is_active=True,
    )

    count = queryset.update(
        is_active=False,
    )

    return count
