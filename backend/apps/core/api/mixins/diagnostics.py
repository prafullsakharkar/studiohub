"""
Diagnostic context mixin.

Syncs the resolved request identity (user, organization, action) into the
logging ContextVars after dispatch, so the request lifecycle middleware's
single completion record carries the actor even on success paths — where
the middleware itself only sees the pre-authentication Django request.

Centralized here so no individual view repeats it. Never raises, never
queries the database.
"""

from __future__ import annotations


class DiagnosticContextMixin:
    """
    Publish resolved identity to logging context in ``finalize_response``.

    Runs for success and error responses alike (DRF calls
    ``finalize_response`` outside the dispatch ``try`` block), after
    authentication, permission checks, and organization resolution.
    """

    def finalize_response(self, request, response, *args, **kwargs):
        try:
            from apps.core.logging import context as log_context

            user = getattr(request, "user", None)
            if user is not None and bool(
                getattr(user, "is_authenticated", False)
            ):
                log_context.user.set(user)

            organization = getattr(
                request, "organization", None
            ) or getattr(request, "membership", None)
            if organization is not None:
                log_context.organization.set(organization)
        except Exception:
            pass

        return super().finalize_response(  # pyright: ignore[reportAttributeAccessIssue]
            request, response, *args, **kwargs
        )
