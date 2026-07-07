"""
JWT blacklist helpers.
"""

from rest_framework_simplejwt.tokens import RefreshToken


class TokenBlacklistService:

    @classmethod
    def blacklist(
        cls,
        refresh_token,
    ):
        RefreshToken(refresh_token).blacklist()
