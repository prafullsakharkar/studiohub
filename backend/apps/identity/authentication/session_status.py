from __future__ import annotations

from django.core.cache import cache
from django.utils import timezone

from apps.identity.choices import SessionStatus

CACHE_PREFIX = "identity.session.status"
CACHE_TTL_SECONDS = 60


class SessionStatusCache:
    """
    Cache-backed access-token jti -> session validity snapshot.

    The snapshot (60 s TTL) is refreshed from the DB on miss. Revocation
    therefore propagates to in-flight access tokens within ~60 s instead of
    the full access-token lifetime.
    """

    @classmethod
    def is_active(cls, jti: str) -> bool:
        key = f"{CACHE_PREFIX}:{jti}"
        status = cache.get(key)

        if status is None:
            status = cls._load(jti)
            cache.set(
                key,
                status,
                CACHE_TTL_SECONDS,
            )

        return status == "active"

    @classmethod
    def _load(cls, jti: str) -> str:
        from apps.identity.models import UserSession

        session = (
            UserSession.objects.filter(access_token_jti=jti).only("status", "expires_at").first()
        )

        if session is None:
            return "inactive"

        if session.status != SessionStatus.ACTIVE:
            return "inactive"

        if session.expires_at and session.expires_at <= timezone.now():
            return "inactive"

        return "active"
