"""
Notification service.
"""

from __future__ import annotations


class NotificationService:
    """
    Central notification service.
    """

    @classmethod
    def notify(cls, user, message: str):
        """
        Placeholder for future notification channels.

        Future:
            - Email
            - WebSocket
            - Push
            - Slack
            - Teams
        """
        return {
            "user": user,
            "message": message,
        }
