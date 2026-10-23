from __future__ import annotations


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
