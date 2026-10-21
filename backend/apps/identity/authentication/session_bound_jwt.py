from __future__ import annotations

from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.identity.authentication.session_status import SessionStatusCache


class SessionExpired(AuthenticationFailed):
    """Authentication failure with the stable ``session_expired`` code."""

    default_code = "session_expired"


class SessionBoundJWTAuthentication(JWTAuthentication):
    """
    JWTAuthentication that also enforces the owning UserSession's status.

    Revocation (logout, password change, deactivation) reaches in-flight
    access tokens within ~60 s (cache snapshot TTL) instead of at token
    expiry. Fails closed: a missing session row denies the request.
    """

    def authenticate(self, request):
        result = super().authenticate(request)

        if result is None:
            return None

        user, validated_token = result

        jti = validated_token.payload.get("jti")

        if jti and not SessionStatusCache.is_active(jti):
            raise SessionExpired(
                "Session is no longer active.",
            )

        return result
