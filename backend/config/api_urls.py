"""
Central API URL aggregator.

Exposes the versioned ``v1`` namespace under the top-level ``api`` namespace.

Namespace structure produced:

    api:v1:tag-list                    -> core routes (directly under v1)
    api:v1:audit:audit-log-list        -> domain app routes (nested app_name)
"""

from django.urls import include, path

app_name = "api"

urlpatterns = [
    path("v1/", include(("config.v1_urls", "v1"), namespace="v1")),
    # Nested organization routes for the frontend contract
    # (/api/organizations/<org>/<resource>/, no /v1/, optional trailing slash).
    path("organizations/", include("apps.organization.api.urls_nested")),
    # Project-scoped nested routes for the frontend contract
    # (/api/organizations/<org>/projects/<project>/..., slash-optional).
    path("organizations/", include("apps.production.api.urls_project_scoped")),
]
