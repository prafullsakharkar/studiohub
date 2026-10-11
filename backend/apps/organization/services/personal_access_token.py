from apps.core.services.business import BusinessService
from apps.organization.events import (
    PersonalAccessTokenCreated,
    PersonalAccessTokenDeleted,
    PersonalAccessTokenUpdated,
)
from apps.organization.models import PersonalAccessToken
from apps.organization.validators.personal_access_token import (
    PersonalAccessTokenValidator,
)


class PersonalAccessTokenService(BusinessService):
    """
    Service for PersonalAccessToken model.
    """

    model = PersonalAccessToken
    validator_class = PersonalAccessTokenValidator

    event_map = {
        "create": PersonalAccessTokenCreated,
        "update": PersonalAccessTokenUpdated,
        "delete": PersonalAccessTokenDeleted,
    }

    @classmethod
    def create(cls, **kwargs):
        # NOTE: `user` cannot travel inside validated_data through
        # BusinessService.create() — its signature binds `user` as the audit
        # kwarg, starving the model FK. Build via the manager directly so
        # the model FK, audit fields, hooks, and events are all correct.
        from django.db import transaction

        user = kwargs.pop("user", None)
        if user is not None:
            kwargs.setdefault("user", user)
            kwargs.setdefault("created_by", user)
            kwargs.setdefault("updated_by", user)
        with transaction.atomic():
            cls.validate(cls.CREATE, **kwargs)
            validated_data = cls.before_create(**kwargs)
            instance = cls.model.objects.create(**validated_data)
            instance = cls.after_create(instance, user=user)
            cls.publish_event(cls.CREATE, instance=instance, user=user)
            cls.invalidate_cache(instance)
            return instance

    @classmethod
    def verify(cls, plain: str):
        """Resolve an active token from a presented secret (peppered hash)."""
        from apps.identity.api_keys.hashing import APIKeyHasher

        if not plain or "." not in plain:
            return None
        prefix = plain.split(".", 1)[0]
        candidate = (
            cls.model.objects.filter(
                prefix=prefix,
                is_active=True,
            ).first()
        )
        if candidate is None:
            return None
        if not APIKeyHasher.verify(plain=plain, hashed=candidate.hashed_token):
            return None
        return candidate

    @classmethod
    def touch(cls, token, ip_address=None):
        from django.utils import timezone

        token.last_used_at = timezone.now()
        update_fields = ["last_used_at"]
        if ip_address:
            token.last_used_ip = ip_address
            update_fields.append("last_used_ip")
        token.save(update_fields=update_fields)
        return token
