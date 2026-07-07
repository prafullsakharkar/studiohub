from __future__ import annotations

import secrets
import string
from dataclasses import dataclass
from typing import Iterable

from django.contrib.auth.hashers import (
    check_password,
    make_password,
)


@dataclass(frozen=True)
class RecoveryCode:
    """
    Represents a recovery code.

    raw    -> shown once to the user
    hashed -> persisted in database
    """

    raw: str
    hashed: str


class RecoveryCodeService:
    """
    Enterprise MFA Recovery Code helper.

    Features
    --------
    • Cryptographically secure
    • One-time use
    • Django password hashing
    • Constant-time verification
    """

    DEFAULT_COUNT = 10
    CODE_LENGTH = 10

    # Removed ambiguous characters
    ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ" "23456789"

    @classmethod
    def generate_code(cls) -> str:
        """
        Example:
            8KZ7-QM2P-RD
        """

        token = "".join(secrets.choice(cls.ALPHABET) for _ in range(cls.CODE_LENGTH))

        return "-".join(
            (
                token[:4],
                token[4:7],
                token[7:],
            )
        )

    @classmethod
    def hash(cls, code: str) -> str:
        """
        Hash recovery code using Django password hasher.
        """

        return make_password(code)

    @classmethod
    def verify(
        cls,
        *,
        code: str,
        hashed_code: str,
    ) -> bool:
        """
        Constant-time verification.
        """

        return check_password(
            code,
            hashed_code,
        )

    @classmethod
    def generate(
        cls,
        *,
        count: int = DEFAULT_COUNT,
    ) -> list[RecoveryCode]:
        """
        Generate recovery codes.

        Returns both raw and hashed values.
        """

        results: list[RecoveryCode] = []

        for _ in range(count):
            raw = cls.generate_code()

            results.append(
                RecoveryCode(
                    raw=raw,
                    hashed=cls.hash(raw),
                )
            )

        return results

    @classmethod
    def raw_codes(
        cls,
        *,
        count: int = DEFAULT_COUNT,
    ) -> list[str]:
        return [item.raw for item in cls.generate(count=count)]

    @classmethod
    def hashed_codes(
        cls,
        *,
        count: int = DEFAULT_COUNT,
    ) -> list[str]:
        return [item.hashed for item in cls.generate(count=count)]

    @classmethod
    def find_matching(
        cls,
        *,
        code: str,
        hashes: Iterable[str],
    ) -> str | None:
        """
        Returns matching hash if found.
        """

        for hashed in hashes:
            if cls.verify(
                code=code,
                hashed_code=hashed,
            ):
                return hashed

        return None
