"""
Intelligence admin module.
"""

from .knowledge import KnowledgeDocumentAdmin
from .search import RecentSearchAdmin, SavedSearchAdmin

__all__ = [
    "KnowledgeDocumentAdmin",
    "RecentSearchAdmin",
    "SavedSearchAdmin",
]
