"""
Common type aliases.
"""

from __future__ import annotations

from typing import Any

JSON = dict[str, Any]

JSONList = list[JSON]

Headers = dict[str, str]

Metadata = dict[str, Any]

QueryParams = dict[str, str]

Context = dict[str, Any]
