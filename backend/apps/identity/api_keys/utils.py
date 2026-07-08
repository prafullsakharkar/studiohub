# apps/identity/api_keys/utils.py

from __future__ import annotations

from .generator import APIKeyGenerator
from .hashing import APIKeyHasher


class APIKeyUtils:
    """
    High-level helper for API Keys and Personal Access Tokens.
    """

    @classmethod
    def generate(cls) -> dict:
        prefix, secret, token = APIKeyGenerator.api_key()

        return {
            "prefix": prefix,
            "secret": secret,
            "token": token,
            "hashed": APIKeyHasher.hash(token),
        }

    @classmethod
    def hash(
        cls,
        token: str,
    ) -> str:
        return APIKeyHasher.hash(token)

    @classmethod
    def verify(
        cls,
        *,
        token: str,
        hashed: str,
    ) -> bool:
        return APIKeyHasher.verify(
            plain=token,
            hashed=hashed,
        )
