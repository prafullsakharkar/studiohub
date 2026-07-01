"""
Project types.
"""

from __future__ import annotations

from pathlib import Path
from typing import Union
from uuid import UUID

UUIDType = UUID

PathLike = Union[str, Path]

ID = int | UUID

PrimaryKey = int | UUID

Color = str

Slug = str

Email = str

Phone = str
