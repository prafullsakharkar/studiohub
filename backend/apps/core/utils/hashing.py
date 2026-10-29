"""
Hashing utilities.
"""

from __future__ import annotations

import hashlib


def md5(value: str) -> str:
    # Not for passwords or tokens: a fingerprint of non-secret text.
    return hashlib.md5(value.encode(), usedforsecurity=False).hexdigest()


def sha1(value: str) -> str:
    return hashlib.sha1(value.encode(), usedforsecurity=False).hexdigest()


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()
