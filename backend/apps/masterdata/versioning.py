"""Natural ordering key for free-text version strings (DOM-MD-SW-06)."""

from __future__ import annotations

import re

_TOKEN = re.compile(r"\d+|[A-Za-z]+")
KEY_MAX_LENGTH = 120
_PAD = 12


def natural_version_key(version: str) -> str:
    """Sortable string where numeric parts compare numerically.

    ``"9"`` < ``"10"`` and ``"2025"`` < ``"2025.1"`` < ``"2025sp1"``. Digits
    are zero-padded and letters lower-cased; digits sort before letters in
    ASCII, so a plain release precedes its service packs.
    """
    parts = [
        token.zfill(_PAD) if token.isdigit() else token.lower()
        for token in _TOKEN.findall(version or "")
    ]
    return ".".join(parts)[:KEY_MAX_LENGTH]
