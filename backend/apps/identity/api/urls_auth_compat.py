"""
Frontend-compatible auth routes.

Mounted at /api/v1/auth/ -> {login, refresh, logout, me, change-password}
"""

from django.urls import path

from apps.identity.api.views.auth_change_password import (
    AuthChangePasswordView,
)
from apps.identity.api.views.auth_compat import (
    AuthLoginView,
    AuthLogoutView,
    AuthMeView,
    AuthRefreshView,
)
from apps.identity.api.views.authentication.forgot_password import (
    ForgotPasswordAPIView,
)
from apps.identity.api.views.authentication.reset_password import (
    ResetPasswordAPIView,
)

app_name = "auth-compat"

urlpatterns = [
    path("login/", AuthLoginView.as_view(), name="auth-login"),
    path("refresh/", AuthRefreshView.as_view(), name="auth-refresh"),
    path("logout/", AuthLogoutView.as_view(), name="auth-logout"),
    path("me/", AuthMeView.as_view(), name="auth-me"),
    path(
        "change-password/",
        AuthChangePasswordView.as_view(),
        name="auth-change-password",
    ),
    path(
        "forgot-password/",
        ForgotPasswordAPIView.as_view(),
        name="auth-forgot-password",
    ),
    path(
        "reset-password/",
        ResetPasswordAPIView.as_view(),
        name="auth-reset-password",
    ),
]
