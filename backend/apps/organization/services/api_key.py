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
    def verify(cls, plain: str):
        """Resolve an active key from a presented secret (peppered hash)."""
        from apps.identity.api_keys.hashing import APIKeyHasher

        if not plain:
            return None
        return (
            cls.model.objects.filter(
                hashed_key=APIKeyHasher.hash(plain),
                is_active=True,
            ).first()
        )

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
