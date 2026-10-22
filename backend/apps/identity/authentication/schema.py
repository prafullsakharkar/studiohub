"""
OpenAPI descriptions of the three authentication schemes, so the generated
schema documents how to authenticate instead of reporting them as unresolved.
"""

from __future__ import annotations

from drf_spectacular.extensions import OpenApiAuthenticationExtension


class SessionBoundJWTScheme(OpenApiAuthenticationExtension):
    target_class = "apps.identity.authentication.session_bound_jwt.SessionBoundJWTAuthentication"
    name = "sessionJWT"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": (
                "Access token from /auth/login/ (or /auth/mfa/challenge/). Bound to a "
                "session: logout, revocation and deactivation end it immediately."
            ),
        }


class PersonalAccessTokenScheme(OpenApiAuthenticationExtension):
    target_class = (
        "apps.identity.authentication.personal_access_token.PersonalAccessTokenAuthentication"
    )
    name = "personalAccessToken"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": "`Token <prefix.secret>`. Acts as its owner, limited to its scopes.",
        }


class APIKeyScheme(OpenApiAuthenticationExtension):
    target_class = "apps.identity.authentication.api_key.APIKeyAuthentication"
    name = "apiKey"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": "`Api-Key <prefix.secret>`. Acts as its owner, limited to its scopes.",
        }
