from .base import BaseChoices


class Visibility(BaseChoices):

    PRIVATE = "private", "Private"

    INTERNAL = "internal", "Internal"

    PUBLIC = "public", "Public"
