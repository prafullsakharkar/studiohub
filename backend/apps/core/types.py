"""
Project types.
"""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

UUIDType = UUID

PathLike = str | Path

ID = int | UUID

PrimaryKey = int | UUID

Color = str

Slug = str

Email = str

Phone = str
