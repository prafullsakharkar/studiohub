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
    # Identity (authentication, users, security)
    path("identity/", include(("apps.identity.api.urls", "identity"))),
    # Organization (tenants, departments, teams, offices, RBAC)
    path("organization/", include(("apps.organization.api.urls", "organization"))),
    # Settings (categories, definitions, feature flags, themes, localization)
    path("settings/", include(("apps.settings.api.urls", "settings"))),
    # Audit (audit logs, login history, change logs, API requests)
    path("audit/", include(("apps.audit.api.urls", "audit"))),
]
