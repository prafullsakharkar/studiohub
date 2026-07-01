"""
JSON utilities.
"""

from __future__ import annotations

import json


def dumps(data, **kwargs):
    return json.dumps(
        data,
        default=str,
        **kwargs,
    )


def loads(value):
    return json.loads(value)
