from __future__ import annotations

import secrets
import string
import uuid


class APIKeyGenerator:
    """
    Generates API Keys and PATs.
    """

    PREFIX_LENGTH = 8

    TOKEN_LENGTH = 48

    ALPHABET = string.ascii_letters + string.digits

    @classmethod
    def prefix(cls) -> str:
        return uuid.uuid4().hex[: cls.PREFIX_LENGTH]

    @classmethod
    def secret(cls) -> str:
        return "".join(secrets.choice(cls.ALPHABET) for _ in range(cls.TOKEN_LENGTH))

    @classmethod
    def api_key(cls):
        prefix = cls.prefix()
        secret = cls.secret()

        return (
            prefix,
            secret,
            f"{prefix}.{secret}",
        )
