"""
New production codes start with the project's code (CR-49, DECISIONS D-43).

In project ``TST`` a new sequence is ``TST_SQ0010``, a shot ``TST_SH0010``. The rule is for CREATE only
(single and bulk, through the same hook): an existing record keeps its code, update, ``rename-code`` and
bulk update by code are untouched, and a record made by a service (a task from a template, a seed) is not
checked. A code the server makes itself (an episode left blank, ``code_prefix`` numbering) is given the
prefix instead of being refused.
"""

from __future__ import annotations

from typing import Any

from rest_framework.exceptions import ValidationError


def project_code_prefix(project: Any) -> str:
    """``TST_`` for project ``TST`` (upper case)."""
    return f"{str(project.code).strip().upper()}_"


def apply_project_code_prefix(data: dict[str, Any], *, project: Any, derived: bool = False) -> None:
    """
    Hold the new code in ``data`` to the project's prefix, or give a server-made one (``derived``) the prefix.

    Raises a ``ValidationError`` on ``code`` when a typed code does not start with the prefix or is the
    prefix alone. An empty code is left to the serializer's own "required" error. The length limit is the
    serializer's (it sees the whole code, prefix included, before this runs); a derived code cannot reach it.
    """
    code = str(data.get("code") or "").strip().upper()
    if not code:
        return
    prefix = project_code_prefix(project)
    if derived and not code.startswith(prefix):
        code = f"{prefix}{code}"
    elif not code.startswith(prefix) or code == prefix:
        raise ValidationError({"code": [f"Codes in project {project.code} start with {prefix}."]})
    data["code"] = code
