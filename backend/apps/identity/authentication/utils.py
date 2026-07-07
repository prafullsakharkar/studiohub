from __future__ import annotations

from ipaddress import ip_address

from django.http import HttpRequest
from user_agents import parse


class AuthenticationUtils:
    """
    Authentication helper utilities.
    """

    @staticmethod
    def get_client_ip(
        request: HttpRequest,
    ) -> str:
        forwarded = request.META.get(
            "HTTP_X_FORWARDED_FOR",
        )

        if forwarded:
            return forwarded.split(",")[0].strip()

        return request.META.get(
            "REMOTE_ADDR",
            "",
        )

    @staticmethod
    def get_user_agent(
        request: HttpRequest,
    ) -> str:
        return request.META.get(
            "HTTP_USER_AGENT",
            "",
        )

    @classmethod
    def parse_user_agent(
        cls,
        request: HttpRequest,
    ):
        return parse(
            cls.get_user_agent(request),
        )

    @classmethod
    def get_browser(
        cls,
        request: HttpRequest,
    ) -> tuple[str, str]:
        ua = cls.parse_user_agent(
            request,
        )

        return (
            ua.browser.family or "Unknown",
            ua.browser.version_string or "",
        )

    @classmethod
    def get_operating_system(
        cls,
        request: HttpRequest,
    ) -> tuple[str, str]:
        ua = cls.parse_user_agent(
            request,
        )

        return (
            ua.os.family or "Unknown",
            ua.os.version_string or "",
        )

    @classmethod
    def get_device(
        cls,
        request: HttpRequest,
    ) -> tuple[str, str]:
        ua = cls.parse_user_agent(
            request,
        )

        if ua.is_mobile:
            device_type = "MOBILE"

        elif ua.is_tablet:
            device_type = "TABLET"

        elif ua.is_pc:
            device_type = "DESKTOP"

        elif ua.is_bot:
            device_type = "BOT"

        else:
            device_type = "UNKNOWN"

        device_name = ua.device.family or "Unknown Device"

        return (
            device_name,
            device_type,
        )

    @classmethod
    def build_session_data(
        cls,
        request: HttpRequest,
    ) -> dict:
        browser, browser_version = cls.get_browser(
            request,
        )

        os_name, os_version = cls.get_operating_system(
            request,
        )

        device_name, device_type = cls.get_device(
            request,
        )

        return {
            "ip_address": cls.get_client_ip(
                request,
            ),
            "user_agent": cls.get_user_agent(
                request,
            ),
            "browser": browser.upper().replace(
                " ",
                "_",
            ),
            "browser_version": browser_version,
            "operating_system": os_name.upper().replace(
                " ",
                "_",
            ),
            "os_version": os_version,
            "device_name": device_name,
            "device_type": device_type,
        }

    @staticmethod
    def is_valid_ip(
        value: str,
    ) -> bool:
        try:
            ip_address(value)
            return True
        except ValueError:
            return False
