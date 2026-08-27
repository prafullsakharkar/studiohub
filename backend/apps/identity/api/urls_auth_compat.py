"""
Frontend-compatible auth routes.

Mounted at /api/v1/auth/ -> {login, refresh, logout, me}
"""

from django.urls import path

from apps.identity.api.views.auth_compat import (
    AuthLoginView,
    AuthLogoutView,
    AuthMeView,
    AuthRefreshView,
)

app_name = "auth-compat"

urlpatterns = [
    path("login/", AuthLoginView.as_view(), name="auth-login"),
    path("refresh/", AuthRefreshView.as_view(), name="auth-refresh"),
    path("logout/", AuthLogoutView.as_view(), name="auth-logout"),
    path("me/", AuthMeView.as_view(), name="auth-me"),
]
