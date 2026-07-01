from dataclasses import dataclass
from uuid import UUID

from apps.core.events import BaseEvent


@dataclass(frozen=True, slots=True, kw_only=True)
class UserCreatedEvent(BaseEvent):
    user_id: UUID
    username: str
    email: str


@dataclass(frozen=True, slots=True, kw_only=True)
class UserUpdatedEvent(BaseEvent):
    user_id: UUID


@dataclass(frozen=True, slots=True, kw_only=True)
class UserDeletedEvent(BaseEvent):
    user_id: UUID
