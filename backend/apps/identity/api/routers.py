from rest_framework.routers import DefaultRouter

from apps.identity.api.viewsets import (
    IPBlacklistViewSet,
    LoginAttemptViewSet,
    ProfileViewSet,
    SecurityEventViewSet,
    TrustedDeviceViewSet,
    UserSessionViewSet,
    UserViewSet,
)

router = DefaultRouter()

router.register(
    "users",
    UserViewSet,
    basename="user",
)

router.register(
    "sessions",
    UserSessionViewSet,
    basename="session",
)

router.register(
    "profiles",
    ProfileViewSet,
    basename="profile",
)

router.register(
    "ip-blacklist",
    IPBlacklistViewSet,
    basename="ip-blacklist",
)

router.register(
    "login-attempts",
    LoginAttemptViewSet,
    basename="login-attempt",
)

router.register(
    "security-events",
    SecurityEventViewSet,
    basename="security-event",
)

router.register(
    "trusted-devices",
    TrustedDeviceViewSet,
    basename="trusted-device",
)

urlpatterns = router.urls
