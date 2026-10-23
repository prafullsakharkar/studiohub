"""
Parent/child rules shared by Department and Position (DOM-MD-DEP-01/02, DOM-MD-POS-01).

Self-parent is also a check constraint. Cycles and the depth limit need a walk, so they are
checked here, inside the write transaction. All hierarchy writes of one model are serialized
with a PostgreSQL transaction-level advisory lock, so two concurrent moves cannot each look
valid and together form a cycle. The service takes that lock **before** any row lock
(``DirectoryService.serialize_writes``); taking it afterwards deadlocks two writers that each
hold a row the other needs. On SQLite, which has no concurrent writers, the lock is a no-op.
"""

from __future__ import annotations

import zlib
from typing import Any

from django.core.exceptions import ValidationError
from django.db import connection, models

#: Levels counted from the root (a root is level 1). DECISIONS "Phase 6 decisions", item 3.
MAX_DEPTH = 6


def serialize_writes(label: str) -> None:
    """Hold an advisory lock for the rest of the transaction (PostgreSQL only)."""
    if connection.vendor != "postgresql":
        return
    key = zlib.crc32(f"masterdata:{label}".encode())
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [key])


def _fail(message: str) -> ValidationError:
    return ValidationError({"parent": [message]})


def ancestors(model: type[models.Model], start: Any) -> list[Any]:
    """``start`` and its ancestors, nearest first, live or not (a cycle is a cycle)."""
    chain: list[Any] = []
    seen: set[Any] = set()
    current = start
    while current is not None and current.pk not in seen:
        chain.append(current)
        seen.add(current.pk)
        current = (
            model._base_manager.filter(pk=current.parent_id).first()  # pyright: ignore[reportAttributeAccessIssue]
            if current.parent_id  # pyright: ignore[reportAttributeAccessIssue]
            else None
        )
    return chain


def subtree_height(model: type[models.Model], node: Any) -> int:
    """Number of levels in ``node``'s subtree, ``node`` included (a leaf is 1). Live rows only."""
    height = 1
    frontier = [node.pk]
    seen = {node.pk}
    while True:
        children = [
            pk
            for pk in model.objects.filter(parent_id__in=frontier).values_list("pk", flat=True)  # pyright: ignore[reportAttributeAccessIssue]
            if pk not in seen
        ]
        if not children:
            return height
        height += 1
        seen.update(children)
        frontier = children


def check_parent(model: type[models.Model], node: Any, new_parent: Any, *, label: str) -> None:
    """Refuse a parent that would create a cycle or exceed ``MAX_DEPTH``.

    ``node`` is the row being created (unsaved, ``pk`` may be new) or moved.
    """
    if new_parent is None:
        return
    if node.pk is not None and new_parent.pk == node.pk:
        raise _fail("A record cannot be its own parent.")
    chain = ancestors(model, new_parent)
    if any(item.pk == node.pk for item in chain):
        raise _fail("This would make the record its own ancestor (a cycle).")
    below = 1 if node._state.adding else subtree_height(model, node)
    if len(chain) + below > MAX_DEPTH:
        raise _fail(f"The hierarchy may have at most {MAX_DEPTH} levels.")
