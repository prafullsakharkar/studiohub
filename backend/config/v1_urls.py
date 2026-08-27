"""
API v1 URL aggregator.

Each business domain owns its own ``api/urls.py`` and registers its routes
under its own ``app_name``. This module aggregates them under the versioned
``v1`` namespace, which is exposed by ``config.api_urls`` as ``api:v1:...``.
"""

from django.urls import include, path

app_name = "v1"

urlpatterns = [
    # Foundation
    path("core/", include("apps.core.api.urls")),
    # Frontend-compatible aliases (must precede legacy paths for routing clarity)
    path("auth/", include("apps.identity.api.urls_auth_compat")),
    path("attachments/", include("apps.core.api.urls_compat")),
    # Legacy flat organization aliases for frontend `organizationApi.ts`
    # (bare-array vs paginated, id-or-code lookup)
    path("", include("apps.organization.api.urls_legacy")),
    # Production — top-level to match frontend /api/v1/{projects,shots,assets}/
    path("", include("apps.production.api.urls")),
    # Intelligence — search, knowledge, AI workspace
    path("intelligence/", include("apps.intelligence.api.urls")),
    # Identity (authentication, users, security)
    path("identity/", include(("apps.identity.api.urls", "identity"))),
    # Organization (tenants, departments, teams, offices, RBAC) — namespaced v2
    path("organization/", include(("apps.organization.api.urls", "organization"))),
    # Settings (categories, definitions, feature flags, themes, localization)
    path("settings/", include(("apps.settings.api.urls", "settings"))),
    # Audit (audit logs, login history, change logs, API requests)
    path("audit/", include(("apps.audit.api.urls", "audit"))),
]
