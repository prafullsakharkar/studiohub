from __future__ import annotations

from .generator import APIKeyGenerator
from .hashing import APIKeyHasher


class APIKeyUtils:
    """
    Convenience helpers.
    """

    @classmethod
    def generate(cls):
        prefix, secret, token = APIKeyGenerator.api_key()

        return {
            "prefix": prefix,
            "secret": secret,
            "token": token,
            "hashed": APIKeyHasher.hash(token),
        }

    @classmethod
    def hash(cls, token: str):
        return APIKeyHasher.hash(token)

    @classmethod
    def verify(
        cls,
        token: str,
        hashed: str,
    ):
        return APIKeyHasher.verify(
            plain=token,
            hashed=hashed,
        )
