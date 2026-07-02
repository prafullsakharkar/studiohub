"""
Base service class.
"""

from __future__ import annotations


class BaseService:

    @classmethod
    def create(cls, **kwargs):
        raise NotImplementedError

    @classmethod
    def update(cls, instance, **kwargs):
        raise NotImplementedError

    @classmethod
    def delete(cls, instance):
        raise NotImplementedError
