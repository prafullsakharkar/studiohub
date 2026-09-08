"""
Docker development settings.
"""

from .local import *

DEBUG = True  # pyright: ignore[reportConstantRedefinition]
INTERNAL_IPS = [  # pyright: ignore[reportConstantRedefinition]
    "127.0.0.1",
]
