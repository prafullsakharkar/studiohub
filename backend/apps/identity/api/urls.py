from django.urls import path

from apps.identity.api.routers import (
    urlpatterns as router_urls,
)
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

from .views.authentication import (
    MFADisableAPIView,
    MFAEnrollAPIView,
    MFARecoveryCodesAPIView,
    MFARecoveryVerifyAPIView,
    MFAVerifyAPIView,
    TrustedDeviceListAPIView,
    TrustedDeviceRevokeAPIView,
)
from .views.mfa_compat import (
    MFAAdminResetView,
    MFAConfigView,
    MFAEmailDisableView,
    MFAEmailEnableView,
    MFAEmailVerifyView,
    MFARecoveryCodesRegenerateView,
    MFARecoveryCodesView,
    MFASMSDisableView,
    MFASMSEnableView,
    MFASMSVerifyView,
    MFATOTPDisableView,
    MFATOTPEnableView,
    MFATOTPSetupView,
    MFATOTPVerifyView,
)

urlpatterns = router_urls + [
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
    path(
        "auth/mfa/enroll/",
        MFAEnrollAPIView.as_view(),
        name="mfa-enroll",
    ),
    path(
        "auth/mfa/verify/",
        MFAVerifyAPIView.as_view(),
        name="mfa-verify",
    ),
    path(
        "auth/mfa/disable/",
        MFADisableAPIView.as_view(),
        name="mfa-disable",
    ),
    path(
        "auth/mfa/recovery/",
        MFARecoveryCodesAPIView.as_view(),
        name="mfa-recovery",
    ),
    path(
        "auth/mfa/recovery/verify/",
        MFARecoveryVerifyAPIView.as_view(),
        name="mfa-recovery-verify",
    ),
    path(
        "auth/mfa/devices/",
        TrustedDeviceListAPIView.as_view(),
        name="trusted-devices",
    ),
    path(
        "auth/mfa/devices/revoke/",
        TrustedDeviceRevokeAPIView.as_view(),
        name="trusted-device-revoke",
    ),
    # Frontend-compatible MFA (Phase C — MFAService.ts)
    path("mfa/config/", MFAConfigView.as_view(), name="mfa-config-compat"),
    path("mfa/totp/setup/", MFATOTPSetupView.as_view(), name="mfa-totp-setup"),
    path("mfa/totp/enable/", MFATOTPEnableView.as_view(), name="mfa-totp-enable"),
    path("mfa/totp/verify/", MFATOTPVerifyView.as_view(), name="mfa-totp-verify"),
    path("mfa/totp/disable/", MFATOTPDisableView.as_view(), name="mfa-totp-disable"),
    path("mfa/sms/enable/", MFASMSEnableView.as_view(), name="mfa-sms-enable"),
    path("mfa/sms/verify/", MFASMSVerifyView.as_view(), name="mfa-sms-verify"),
    path("mfa/sms/disable/", MFASMSDisableView.as_view(), name="mfa-sms-disable"),
    path("mfa/email/enable/", MFAEmailEnableView.as_view(), name="mfa-email-enable"),
    path("mfa/email/verify/", MFAEmailVerifyView.as_view(), name="mfa-email-verify"),
    path("mfa/email/disable/", MFAEmailDisableView.as_view(), name="mfa-email-disable"),
    path("mfa/recovery-codes/", MFARecoveryCodesView.as_view(), name="mfa-recovery-codes"),
    path(
        "mfa/recovery-codes/regenerate/",
        MFARecoveryCodesRegenerateView.as_view(),
        name="mfa-recovery-codes-regenerate",
    ),
    path("mfa/admin/reset/<str:user_id>/", MFAAdminResetView.as_view(), name="mfa-admin-reset"),
]
