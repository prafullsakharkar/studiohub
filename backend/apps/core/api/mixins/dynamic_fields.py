"""
Dynamic serializer fields.
"""

from __future__ import annotations

from typing import Any, ClassVar


class DynamicFieldsMixin:
    """
    Allow ?fields=id,name,status
    """
    # Mixin contract: provided by the view/serializer this
    # mixin is combined with. Annotations only, no runtime effect.
    fields: ClassVar[Any]

    def __init__(self, *args, **kwargs):

        fields = kwargs.pop(
            "fields",
            None,
        )

        super().__init__(*args, **kwargs)

        if fields:

            allowed = set(fields)

            existing = set(self.fields)

            for field in existing - allowed:
                self.fields.pop(field)
