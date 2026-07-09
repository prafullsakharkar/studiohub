from celery import shared_task

from apps.identity.models import TrustedDevice


@shared_task
def cleanup_expired_trusted_devices():
    """
    Remove expired trusted devices.
    """
    queryset = TrustedDevice.objects.expired()

    count = queryset.count()

    queryset.delete()

    return count
