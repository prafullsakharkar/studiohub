"""
API v1 URL aggregator.

Each business domain owns its own ``api/urls.py`` and registers its routes
under its own ``app_name``. This module aggregates them under the versioned
``v1`` namespace, which is exposed by ``config.api_urls`` as ``api:v1:...``.
"""

from django.urls import include, path

from apps.audit.api.viewsets.activity import ActivityCompatViewSet
from apps.core.api.views.version import VersionInfoView

app_name = "v1"

urlpatterns = [
    # Foundation
    path("core/", include("apps.core.api.urls")),
    # Public application info surfaced in the frontend header
    path("info/version/", VersionInfoView.as_view(), name="info-version"),
    # Frontend-compatible aliases (must precede legacy paths for routing clarity)
    path("auth/", include("apps.identity.api.urls_auth_compat")),
    path("attachments/", include("apps.core.api.urls_compat")),
    # Production — top-level to match frontend /api/v1/{projects,shots,assets}/
    path("", include("apps.production.api.urls")),
    # Identity (authentication, users, security)
    path("identity/", include(("apps.identity.api.urls", "identity"))),
    # Identity RBAC — flat platform-global roles/groups/permissions
    # (top-level to match frontend /api/v1/{roles,groups,permissions}/)
    path("", include(("apps.identity.api.urls_rbac", "identity-rbac"))),
    # Settings (categories, definitions, feature flags, themes, localization)
    path("settings/", include(("apps.settings.api.urls", "settings"))),
    # Audit (audit logs, login history, change logs, API requests)
    path("audit/", include(("apps.audit.api.urls", "audit"))),
    # Platform-global activity feed (frontend `organizationApi.getActivity()`
    # fallback). The organization app is gone (B7), so this is the only
    # activity route; the old nested `/api/organizations/<org>/activity/`
    # tree 404s by absence.
    path(
        "activity/",
        ActivityCompatViewSet.as_view({"get": "list"}),
        name="activity-flat-list",
    ),
    # Deliveries (client turnover packages)
    path("deliveries/", include("apps.deliveries.api.urls")),
    # Publishing (DCC publish items)
    path("publishing/", include("apps.publishing.api.urls")),
    # Scheduling (resources, events, leaves)
    path("scheduling/", include("apps.scheduling.api.urls")),
    # Masterdata (catalog, platform, organization config)
    path("", include(("apps.masterdata.api.urls", "masterdata"))),
]
