from apps.identity.api.viewsets.permission import (
    PermissionViewSet,
)
from apps.identity.api.viewsets.user import (
    UserViewSet,
)
from rest_framework.routers import DefaultRouter

from apps.identity.api.viewsets.api_key import APIKeyViewSet
from apps.identity.api.viewsets.group import (
    GroupViewSet,
)
from apps.identity.api.viewsets.login_history import (
    LoginHistoryViewSet,
)
from apps.identity.api.viewsets.personal_access_token import PersonalAccessTokenViewSet
from apps.identity.api.viewsets.role import (
    RoleViewSet,
)
from apps.identity.api.viewsets.user_preference import (
    UserPreferenceViewSet,
)
from apps.identity.api.viewsets.user_session import (
    UserSessionViewSet,
)

router = DefaultRouter()

router.register(
    "users",
    UserViewSet,
    basename="user",
)

router.register(
    "roles",
    RoleViewSet,
    basename="role",
)

router.register(
    "permissions",
    PermissionViewSet,
    basename="permission",
)

router.register(
    "groups",
    GroupViewSet,
    basename="group",
)

router.register(
    "user-preferences",
    UserPreferenceViewSet,
    basename="user-preference",
)

router.register(
    "user-sessions",
    UserSessionViewSet,
    basename="user-session",
)

router.register(
    "login-history",
    LoginHistoryViewSet,
    basename="login-history",
)
router.register(
    "api-keys",
    APIKeyViewSet,
    basename="identity-api-key",
)

router.register(
    "personal-access-tokens",
    PersonalAccessTokenViewSet,
    basename="identity-personal-access-token",
)
urlpatterns = router.urls
