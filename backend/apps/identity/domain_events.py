from dataclasses import dataclass
from uuid import UUID

from apps.core.events import DomainEvent


@dataclass(frozen=True, slots=True, kw_only=True)
class UserCreatedEvent(DomainEvent):
    user_id: UUID
    username: str
    email: str


@dataclass(frozen=True, slots=True, kw_only=True)
class UserUpdatedEvent(DomainEvent):
    user_id: UUID


@dataclass(frozen=True, slots=True, kw_only=True)
class UserDeletedEvent(DomainEvent):
    user_id: UUID
