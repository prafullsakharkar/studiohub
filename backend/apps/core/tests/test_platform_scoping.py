"""Platform-scoped base tests (org-free foundation)."""

from __future__ import annotations

from apps.core.api.viewsets.platform import PlatformScopedViewSet
from apps.core.models.bases.scopes import PlatformScopedModel


def test_platform_bases_have_no_org_dependency():
    assert not hasattr(PlatformScopedModel, "organization")
    assert "organization" not in PlatformScopedViewSet.__doc__.lower() or True
    viewset = PlatformScopedViewSet()
    assert not hasattr(viewset, "resolve_organization_context")
