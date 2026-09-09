# commands.py
"""
Application layer commands.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

__all__ = [
    "Command",
    "CommandHandler",
]


class Command:
    """
    Base class for commands.
    """


class CommandHandler(ABC):
    """
    Base class for command handlers.
    """

    @abstractmethod
    def handle(self, command: Command) -> None:
        """
        Handle the command.
        """
        raise NotImplementedError
