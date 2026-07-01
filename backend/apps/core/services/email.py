"""
Email service.
"""

from __future__ import annotations

from typing import Sequence

from django.conf import settings
from django.core.mail import EmailMultiAlternatives


class EmailService:
    """
    Centralized email sending service.
    """

    @classmethod
    def send(
        cls,
        *,
        subject: str,
        body: str,
        to: Sequence[str],
        html: str | None = None,
        from_email: str | None = None,
    ) -> int:
        """
        Send an email.

        Returns:
            Number of successfully delivered messages.
        """
        message = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=from_email or settings.DEFAULT_FROM_EMAIL,
            to=list(to),
        )

        if html:
            message.attach_alternative(html, "text/html")

        return message.send()
