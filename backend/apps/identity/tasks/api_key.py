from celery import shared_task

from apps.identity.models import APIKey


@shared_task
def deactivate_expired_api_keys():
    """
    Deactivate expired API Keys.
    """
    queryset = APIKey.objects.expired().filter(
        is_active=True,
    )

    count = queryset.update(
        is_active=False,
    )

    return count
