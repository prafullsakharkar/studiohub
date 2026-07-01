"""
Storage service.
"""

from __future__ import annotations

from pathlib import Path

from django.core.files.storage import default_storage


class StorageService:
    """
    Storage helper methods.
    """

    @classmethod
    def exists(cls, path: str) -> bool:
        return default_storage.exists(path)

    @classmethod
    def delete(cls, path: str) -> None:
        if default_storage.exists(path):
            default_storage.delete(path)

    @classmethod
    def size(cls, path: str) -> int:
        return default_storage.size(path)

    @classmethod
    def url(cls, path: str) -> str:
        return default_storage.url(path)

    @classmethod
    def extension(cls, path: str) -> str:
        return Path(path).suffix.lower()
