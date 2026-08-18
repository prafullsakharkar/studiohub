# queries.py
"""
Application layer queries.
"""

from __future__ import annotations

from abc import ABC

__all__ = [
    "Query",
    "QueryHandler",
]


class Query:
    """
    Base class for queries.
    """


class QueryHandler(ABC):
    """
    Base class for query handlers.
    """

    def handle(self, query: Query) -> None:
        """
        Handle the query.
        """
        raise NotImplementedError
