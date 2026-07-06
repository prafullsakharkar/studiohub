from __future__ import annotations


class BaseResolver:
    """
    Base class for all resolvers.
    """

    @classmethod
    def resolve(cls, *args, **kwargs):
        raise NotImplementedError
