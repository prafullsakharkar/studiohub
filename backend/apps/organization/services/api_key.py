from apps.core.services.business import BusinessService
from apps.organization.events import (
    APIKeyCreated,
    APIKeyDeleted,
    APIKeyUpdated,
)
from apps.organization.models import APIKey
from apps.organization.validators.api_key import APIKeyValidator


class APIKeyService(BusinessService):
    """
    Service for APIKey model.
    """

    model = APIKey
    validator_class = APIKeyValidator

    event_map = {
        "create": APIKeyCreated,
        "update": APIKeyUpdated,
        "delete": APIKeyDeleted,
    }

    @classmethod
    def verify(cls, plain: str, organization=None):
        """Resolve an active, unexpired key from a presented secret.

        When ``organization`` is given, the key must belong to it —
        a secret minted in org A never authenticates org B traffic.
        """
        from django.db.models import Q
        from django.utils import timezone

        from apps.identity.api_keys.hashing import APIKeyHasher

        if not plain:
            return None
        queryset = cls.model.objects.filter(
            hashed_key=APIKeyHasher.hash(plain),
            is_active=True,
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()),
        )
        if organization is not None:
            queryset = queryset.filter(organization=organization)
        return queryset.first()

    @classmethod
    def touch(cls, api_key, ip_address=None):
        from django.utils import timezone

        api_key.last_used_at = timezone.now()
        update_fields = ["last_used_at"]
        if ip_address:
            api_key.last_used_ip = ip_address
            update_fields.append("last_used_ip")
        api_key.save(update_fields=update_fields)
        return api_key
