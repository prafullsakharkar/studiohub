from __future__ import annotations

import hashlib
import secrets

from django.conf import settings


class APIKeyHasher:
    """
    Hashing utilities for API Keys / PATs.
    """

    ALGORITHM = "sha256"

    @classmethod
    def hash(cls, value: str) -> str:
        secret = getattr(
            settings,
            "SECRET_KEY",
            "",
        )

        return hashlib.sha256(
            f"{secret}:{value}".encode("utf-8"),
        ).hexdigest()

    @classmethod
    def verify(
        cls,
        *,
        plain: str,
        hashed: str,
    ) -> bool:
        return secrets.compare_digest(
            cls.hash(plain),
            hashed,
        )
