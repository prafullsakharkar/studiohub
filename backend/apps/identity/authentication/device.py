from __future__ import annotations

import hashlib
from dataclasses import dataclass

from django.conf import settings
from django.core import signing
from django.http import HttpRequest


@dataclass(frozen=True)
class DeviceFingerprint:
    fingerprint: str
    browser: str
    operating_system: str
    user_agent: str
    ip_address: str | None


class TrustedDeviceService:
    """
    Enterprise trusted device helper.

    Features
    --------
    - Stable browser fingerprint
    - Signed remember-device token
    - Cookie validation
    - Browser / OS extraction
    """

    COOKIE_NAME = getattr(
        settings,
        "MFA_TRUSTED_DEVICE_COOKIE",
        "trusted_device",
    )

    COOKIE_MAX_AGE = getattr(
        settings,
        "MFA_TRUSTED_DEVICE_MAX_AGE",
        60 * 60 * 24 * 30,
    )

    SALT = "identity.trusted.device"

    @classmethod
    def build_fingerprint(
        cls,
        request: HttpRequest,
    ) -> DeviceFingerprint:
        user_agent = request.META.get(
            "HTTP_USER_AGENT",
            "",
        )

        accept = request.META.get(
            "HTTP_ACCEPT",
            "",
        )

        language = request.META.get(
            "HTTP_ACCEPT_LANGUAGE",
            "",
        )

        encoding = request.META.get(
            "HTTP_ACCEPT_ENCODING",
            "",
        )

        ip = cls.client_ip(request)

        raw = "|".join(
            [
                user_agent,
                accept,
                language,
                encoding,
            ]
        )

        fingerprint = hashlib.sha256(raw.encode("utf-8")).hexdigest()

        return DeviceFingerprint(
            fingerprint=fingerprint,
            browser=cls.browser(user_agent),
            operating_system=cls.operating_system(user_agent),
            user_agent=user_agent,
            ip_address=ip,
        )

    @classmethod
    def client_ip(
        cls,
        request: HttpRequest,
    ) -> str | None:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")

        if forwarded:
            return forwarded.split(",")[0].strip()

        return request.META.get("REMOTE_ADDR")

    @classmethod
    def browser(
        cls,
        ua: str,
    ) -> str:
        ua = ua.lower()

        if "edg/" in ua:
            return "Edge"

        if "chrome/" in ua:
            return "Chrome"

        if "firefox/" in ua:
            return "Firefox"

        if "safari/" in ua and "chrome/" not in ua:
            return "Safari"

        if "opr/" in ua:
            return "Opera"

        return "Unknown"

    @classmethod
    def operating_system(
        cls,
        ua: str,
    ) -> str:
        ua = ua.lower()

        if "windows" in ua:
            return "Windows"

        if "mac os" in ua:
            return "macOS"

        if "linux" in ua:
            return "Linux"

        if "android" in ua:
            return "Android"

        if "iphone" in ua or "ipad" in ua:
            return "iOS"

        return "Unknown"

    @classmethod
    def sign(
        cls,
        *,
        fingerprint: str,
        user_id,
    ) -> str:
        return signing.dumps(
            {
                "uid": str(user_id),
                "fp": fingerprint,
            },
            salt=cls.SALT,
        )

    @classmethod
    def verify(
        cls,
        token: str,
        *,
        max_age: int | None = None,
    ) -> dict | None:
        try:
            return signing.loads(
                token,
                salt=cls.SALT,
                max_age=max_age or cls.COOKIE_MAX_AGE,
            )
        except signing.BadSignature:
            return None

    @classmethod
    def matches(
        cls,
        *,
        token: str,
        request: HttpRequest,
        user_id,
    ) -> bool:
        payload = cls.verify(token)

        if payload is None:
            return False

        current = cls.build_fingerprint(request)

        return payload["uid"] == str(user_id) and payload["fp"] == current.fingerprint

    @classmethod
    def cookie_kwargs(cls) -> dict:
        return {
            "max_age": cls.COOKIE_MAX_AGE,
            "httponly": True,
            "secure": getattr(
                settings,
                "SESSION_COOKIE_SECURE",
                True,
            ),
            "samesite": "Lax",
        }
