from __future__ import annotations

from django.http import HttpRequest, HttpResponse

from apps.identity.authentication.device import TrustedDeviceService

from .base import BaseMFAService


class MFACookieService(BaseMFAService):
    """
    Trusted device cookie management.
    """

    @classmethod
    def build_token(
        cls,
        *,
        user,
        fingerprint: str,
    ) -> str:
        return TrustedDeviceService.sign(
            user_id=user.pk,
            fingerprint=fingerprint,
        )

    @classmethod
    def verify_token(
        cls,
        token: str,
    ):
        return TrustedDeviceService.verify(token)

    @classmethod
    def create_cookie(
        cls,
        *,
        response: HttpResponse,
        request: HttpRequest,
        user,
    ) -> HttpResponse:
        fingerprint = TrustedDeviceService.build_fingerprint(request)

        token = cls.build_token(
            user=user,
            fingerprint=fingerprint.fingerprint,
        )

        response.set_cookie(
            TrustedDeviceService.COOKIE_NAME,
            token,
            **TrustedDeviceService.cookie_kwargs(),
        )

        return response

    @classmethod
    def delete_cookie(
        cls,
        response: HttpResponse,
    ) -> HttpResponse:
        response.delete_cookie(
            TrustedDeviceService.COOKIE_NAME,
        )

        return response

    @classmethod
    def is_valid(
        cls,
        *,
        request: HttpRequest,
        user,
    ) -> bool:
        token = request.COOKIES.get(
            TrustedDeviceService.COOKIE_NAME,
        )

        if not token:
            return False

        return TrustedDeviceService.matches(
            token=token,
            request=request,
            user_id=user.pk,
        )
