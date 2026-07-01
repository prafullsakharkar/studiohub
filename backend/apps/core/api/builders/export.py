"""
Export Builder.
"""

from __future__ import annotations

from typing import Any


class ExportBuilder:
    """
    Build export metadata.
    """

    @staticmethod
    def build(
        *,
        filename: str,
        content_type: str,
        file_size: int | None = None,
        extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Build export information.
        """
        return {
            "filename": filename,
            "content_type": content_type,
            "file_size": file_size,
            "extra": extra or {},
        }
