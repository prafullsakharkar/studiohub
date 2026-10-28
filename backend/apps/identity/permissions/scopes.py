from __future__ import annotations

from typing import Any

from rest_framework.exceptions import PermissionDenied


def credential_scopes(request) -> frozenset[str] | None:
    """
    The scope restriction of the credential authenticating ``request``.

    ``None``: not an API key / PAT request, or a legacy credential with no
    scopes recorded (full access of its owner). Otherwise the set of
    permission codes the credential may use; entries that are not permission
    codes (old coarse labels such as ``read``) simply grant nothing.
    """

    from apps.identity.models import ApiKey, PersonalAccessToken

    credential = getattr(request, "auth", None)

    if not isinstance(credential, (ApiKey, PersonalAccessToken)):
        return None

    scopes = credential.scopes

    if not scopes:
        return None

    return frozenset(scope for scope in scopes if isinstance(scope, str))


class CredentialScopeNotApplicable(PermissionDenied):
    """403: this endpoint cannot be reached with a scoped API key / PAT."""

    #: read by the exception handler, which otherwise turns an authenticator's 403 into a 401
    keeps_forbidden_status = True

    def __init__(self):
        super().__init__(
            detail={
                "detail": "This endpoint cannot be used with a scoped API key or token.",
                "code": "credential_scope_not_applicable",
            },
            code="credential_scope_not_applicable",
        )


def _view_class(request) -> Any:
    match = getattr(request, "resolver_match", None)
    func = getattr(match, "func", None)

    return getattr(func, "cls", None) or getattr(func, "view_class", None)


def view_honors_scopes(request) -> bool:
    """
    Whether the view ``request`` is routed to applies credential scopes.

    True when one of its permission classes says so (``HasPermission`` does), or the view is marked
    ``credential_open`` because it is safe for any credential. A view we cannot identify is not
    trusted.
    """
    view_class = _view_class(request)

    if view_class is None:
        return False

    if getattr(view_class, "credential_open", False):
        return True

    return any(
        getattr(permission, "enforces_credential_scopes", False)
        for permission in getattr(view_class, "permission_classes", ())
    )


def gate_scoped_credential(request, credential) -> None:
    """
    Refuse a scoped credential on a view that ignores scopes (TPN review TM-013).

    Called by the credential authenticators. A scoped key or token is meant to do *only* what its
    scopes list; a view that checks no permission code would otherwise hand it the owner's whole
    access. Credentials with no scopes recorded are the legacy full-access kind and pass.
    """
    if not getattr(credential, "scopes", None):
        return

    if not view_honors_scopes(request):
        raise CredentialScopeNotApplicable()
