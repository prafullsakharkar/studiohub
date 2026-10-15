"""
Identity RBAC flat URL configuration (org-removal B3).

Top-level ``/api/v1/roles|groups|permissions/`` for the platform-global
authorization resources. Mounted at the v1 root (see ``config.v1_urls``);
route names live under the ``identity-rbac`` namespace so they never
collide with the legacy organization aliases (``legacy-role`` etc.).
"""

from rest_framework.routers import DefaultRouter

from apps.identity.api.viewsets.rbac import (
    GroupViewSet,
    PermissionViewSet,
    RoleViewSet,
)

app_name = "identity-rbac"

router = DefaultRouter()
router.register("roles", RoleViewSet, basename="role")
router.register("groups", GroupViewSet, basename="group")
router.register("permissions", PermissionViewSet, basename="permission")

urlpatterns = router.urls
