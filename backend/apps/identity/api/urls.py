from django.urls import path

from apps.identity.api.views.authentication import (
    ChangePasswordAPIView,
    ForgotPasswordAPIView,
    LoginAPIView,
    LogoutAPIView,
    RefreshAPIView,
    ResendVerificationAPIView,
    ResetPasswordAPIView,
    VerifyEmailAPIView,
)

urlpatterns = [
    path(
        "login/",
        LoginAPIView.as_view(),
        name="login",
    ),
    path(
        "logout/",
        LogoutAPIView.as_view(),
        name="logout",
    ),
    path(
        "refresh/",
        RefreshAPIView.as_view(),
        name="refresh",
    ),
    path(
        "password/change/",
        ChangePasswordAPIView.as_view(),
        name="change-password",
    ),
    path(
        "password/forgot/",
        ForgotPasswordAPIView.as_view(),
        name="forgot-password",
    ),
    path(
        "password/reset/",
        ResetPasswordAPIView.as_view(),
        name="reset-password",
    ),
    path(
        "email/verify/",
        VerifyEmailAPIView.as_view(),
        name="verify-email",
    ),
    path(
        "email/resend/",
        ResendVerificationAPIView.as_view(),
        name="resend-verification",
    ),
]
