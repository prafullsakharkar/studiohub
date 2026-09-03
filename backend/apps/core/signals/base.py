"""
Base signal handlers for Django signals.

Provides common functionality for signal handling.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import TYPE_CHECKING, Any, TypeVar

from django.db.models import Model
from django.db.models.signals import (
    post_delete,
    post_init,
    post_save,
    pre_delete,
    pre_init,
    pre_save,
)

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=Model)


class BaseSignalHandler:
    """
    Base class for signal handlers.

    Provides common functionality for:
    - Logging
    - Error handling
    - Signal registration
    """

    abstract = True

    # Signal mappings
    post_save_signal = post_save
    post_delete_signal = post_delete
    pre_save_signal = pre_save
    pre_delete_signal = pre_delete
    post_init_signal = post_init
    pre_init_signal = pre_init

    def __init__(self, model: type[Model] | None = None):
        """
        Initialize the signal handler.

        Args:
            model: The model to handle signals for
        """
        self.model = model
        self._registered = False

    def connect(self) -> None:
        """
        Connect signal handlers to signals.
        """
        if self._registered:
            return

        self._connect_post_save()
        self._connect_post_delete()
        self._connect_pre_save()
        self._connect_pre_delete()
        self._connect_post_init()
        self._connect_pre_init()

        self._registered = True
        logger.debug(
            "Signal handler %s connected for model %s",
            self.__class__.__name__,
            self.model.__name__ if self.model else "all",
        )

    def disconnect(self) -> None:
        """
        Disconnect signal handlers from signals.
        """
        if not self._registered:
            return

        self._disconnect_post_save()
        self._disconnect_post_delete()
        self._disconnect_pre_save()
        self._disconnect_pre_delete()
        self._disconnect_post_init()
        self._disconnect_pre_init()

        self._registered = False
        logger.debug(
            "Signal handler %s disconnected for model %s",
            self.__class__.__name__,
            self.model.__name__ if self.model else "all",
        )

    def _connect_post_save(self) -> None:
        """Connect post_save signal."""
        if self.model:
            post_save.connect(
                self.handle_post_save,
                sender=self.model,
                dispatch_uid=f"{self.__class__.__name__}_post_save",
            )
        else:
            post_save.connect(
                self.handle_post_save_generic,
                dispatch_uid=f"{self.__class__.__name__}_post_save_generic",
            )

    def _connect_post_delete(self) -> None:
        """Connect post_delete signal."""
        if self.model:
            post_delete.connect(
                self.handle_post_delete,
                sender=self.model,
                dispatch_uid=f"{self.__class__.__name__}_post_delete",
            )
        else:
            post_delete.connect(
                self.handle_post_delete_generic,
                dispatch_uid=f"{self.__class__.__name__}_post_delete_generic",
            )

    def _connect_pre_save(self) -> None:
        """Connect pre_save signal."""
        if self.model:
            pre_save.connect(
                self.handle_pre_save,
                sender=self.model,
                dispatch_uid=f"{self.__class__.__name__}_pre_save",
            )
        else:
            pre_save.connect(
                self.handle_pre_save_generic,
                dispatch_uid=f"{self.__class__.__name__}_pre_save_generic",
            )

    def _connect_pre_delete(self) -> None:
        """Connect pre_delete signal."""
        if self.model:
            pre_delete.connect(
                self.handle_pre_delete,
                sender=self.model,
                dispatch_uid=f"{self.__class__.__name__}_pre_delete",
            )
        else:
            pre_delete.connect(
                self.handle_pre_delete_generic,
                dispatch_uid=f"{self.__class__.__name__}_pre_delete_generic",
            )

    def _connect_post_init(self) -> None:
        """Connect post_init signal."""
        if self.model:
            post_init.connect(
                self.handle_post_init,
                sender=self.model,
                dispatch_uid=f"{self.__class__.__name__}_post_init",
            )
        else:
            post_init.connect(
                self.handle_post_init_generic,
                dispatch_uid=f"{self.__class__.__name__}_post_init_generic",
            )

    def _connect_pre_init(self) -> None:
        """Connect pre_init signal."""
        if self.model:
            pre_init.connect(
                self.handle_pre_init,
                sender=self.model,
                dispatch_uid=f"{self.__class__.__name__}_pre_init",
            )
        else:
            pre_init.connect(
                self.handle_pre_init_generic,
                dispatch_uid=f"{self.__class__.__name__}_pre_init_generic",
            )

    def _disconnect_post_save(self) -> None:
        """Disconnect post_save signal."""
        if self.model:
            post_save.disconnect(
                sender=self.model,
                dispatch_uid=f"{self.__class__.__name__}_post_save",
            )
        else:
            post_save.disconnect(
                dispatch_uid=f"{self.__class__.__name__}_post_save_generic",
            )

    def _disconnect_post_delete(self) -> None:
        """Disconnect post_delete signal."""
        if self.model:
            post_delete.disconnect(
                sender=self.model,
                dispatch_uid=f"{self.__class__.__name__}_post_delete",
            )
        else:
            post_delete.disconnect(
                dispatch_uid=f"{self.__class__.__name__}_post_delete_generic",
            )

    def _disconnect_pre_save(self) -> None:
        """Disconnect pre_save signal."""
        if self.model:
            pre_save.disconnect(
                sender=self.model,
                dispatch_uid=f"{self.__class__.__name__}_pre_save",
            )
        else:
            pre_save.disconnect(
                dispatch_uid=f"{self.__class__.__name__}_pre_save_generic",
            )

    def _disconnect_pre_delete(self) -> None:
        """Disconnect pre_delete signal."""
        if self.model:
            pre_delete.disconnect(
                sender=self.model,
                dispatch_uid=f"{self.__class__.__name__}_pre_delete",
            )
        else:
            pre_delete.disconnect(
                dispatch_uid=f"{self.__class__.__name__}_pre_delete_generic",
            )

    def _disconnect_post_init(self) -> None:
        """Disconnect post_init signal."""
        if self.model:
            post_init.disconnect(
                sender=self.model,
                dispatch_uid=f"{self.__class__.__name__}_post_init",
            )
        else:
            post_init.disconnect(
                dispatch_uid=f"{self.__class__.__name__}_post_init_generic",
            )

    def _disconnect_pre_init(self) -> None:
        """Disconnect pre_init signal."""
        if self.model:
            pre_init.disconnect(
                sender=self.model,
                dispatch_uid=f"{self.__class__.__name__}_pre_init",
            )
        else:
            pre_init.disconnect(
                dispatch_uid=f"{self.__class__.__name__}_pre_init_generic",
            )

    # Generic signal handlers
    def handle_post_save_generic(
        self,
        sender: type[Model],
        instance: Model,
        created: bool,
        **kwargs: Any,
    ) -> None:
        """
        Handle post_save signal for any model.

        Args:
            sender: The model class
            instance: The model instance
            created: Whether the instance was created
            **kwargs: Additional keyword arguments
        """
        pass

    def handle_post_delete_generic(
        self,
        sender: type[Model],
        instance: Model,
        **kwargs: Any,
    ) -> None:
        """
        Handle post_delete signal for any model.

        Args:
            sender: The model class
            instance: The model instance
            **kwargs: Additional keyword arguments
        """
        pass

    def handle_pre_save_generic(
        self,
        sender: type[Model],
        instance: Model,
        **kwargs: Any,
    ) -> None:
        """
        Handle pre_save signal for any model.

        Args:
            sender: The model class
            instance: The model instance
            **kwargs: Additional keyword arguments
        """
        pass

    def handle_pre_delete_generic(
        self,
        sender: type[Model],
        instance: Model,
        **kwargs: Any,
    ) -> None:
        """
        Handle pre_delete signal for any model.

        Args:
            sender: The model class
            instance: The model instance
            **kwargs: Additional keyword arguments
        """
        pass

    def handle_post_init_generic(
        self,
        sender: type[Model],
        instance: Model,
        **kwargs: Any,
    ) -> None:
        """
        Handle post_init signal for any model.

        Args:
            sender: The model class
            instance: The model instance
            **kwargs: Additional keyword arguments
        """
        pass

    def handle_pre_init_generic(
        self,
        sender: type[Model],
        instance: Model,
        **kwargs: Any,
    ) -> None:
        """
        Handle pre_init signal for any model.

        Args:
            sender: The model class
            instance: The model instance
            **kwargs: Additional keyword arguments
        """
        pass

    # Model-specific signal handlers
    def handle_post_save(
        self,
        sender: type[Model],
        instance: Model,
        created: bool,
        **kwargs: Any,
    ) -> None:
        """
        Handle post_save signal for the registered model.

        Args:
            sender: The model class
            instance: The model instance
            created: Whether the instance was created
            **kwargs: Additional keyword arguments
        """
        pass

    def handle_post_delete(
        self,
        sender: type[Model],
        instance: Model,
        **kwargs: Any,
    ) -> None:
        """
        Handle post_delete signal for the registered model.

        Args:
            sender: The model class
            instance: The model instance
            **kwargs: Additional keyword arguments
        """
        pass

    def handle_pre_save(
        self,
        sender: type[Model],
        instance: Model,
        **kwargs: Any,
    ) -> None:
        """
        Handle pre_save signal for the registered model.

        Args:
            sender: The model class
            instance: The model instance
            **kwargs: Additional keyword arguments
        """
        pass

    def handle_pre_delete(
        self,
        sender: type[Model],
        instance: Model,
        **kwargs: Any,
    ) -> None:
        """
        Handle pre_delete signal for the registered model.

        Args:
            sender: The model class
            instance: The model instance
            **kwargs: Additional keyword arguments
        """
        pass

    def handle_post_init(
        self,
        sender: type[Model],
        instance: Model,
        **kwargs: Any,
    ) -> None:
        """
        Handle post_init signal for the registered model.

        Args:
            sender: The model class
            instance: The model instance
            **kwargs: Additional keyword arguments
        """
        pass

    def handle_pre_init(
        self,
        sender: type[Model],
        instance: Model,
        **kwargs: Any,
    ) -> None:
        """
        Handle pre_init signal for the registered model.

        Args:
            sender: The model class
            instance: The model instance
            **kwargs: Additional keyword arguments
        """
        pass


class AuditSignalHandler(BaseSignalHandler):
    """
    Signal handler for audit logging.

    Automatically updates audit fields on model save/delete.
    """

    def handle_pre_save(
        self,
        sender: type[Model],
        instance: Model,
        **kwargs: Any,
    ) -> None:
        """
        Update audit fields before save.

        Args:
            sender: The model class
            instance: The model instance
            **kwargs: Additional keyword arguments
        """
        # Get current user from thread-local storage
        try:
            from apps.core.middleware import get_current_user

            user = get_current_user()
        except (ImportError, AttributeError):
            user = None

        # Handle soft delete models
        if (
            hasattr(instance, "is_deleted")
            and hasattr(instance, "status")
            and instance.is_deleted
            and not instance.pk
        ):
            # New soft delete - set deleted_by
            if user and hasattr(instance, "deleted_by"):
                instance.deleted_by = user
        elif (
            hasattr(instance, "is_deleted")
            and instance.is_deleted
            and instance.pk
            and hasattr(instance, "deleted_at")
        ):
            # Existing soft delete - update deleted_at
            from django.utils import timezone

            instance.deleted_at = timezone.now()

        # Handle audit fields
        if hasattr(instance, "created_by") and not instance.pk and user and not instance.created_id:
            # New object - set created_by
            instance.created_by = user

        # Update updated_by on every save
        if hasattr(instance, "updated_by") and user and instance.updated_id != user.id:
            instance.updated_by = user


class CacheInvalidationSignalHandler(BaseSignalHandler):
    """
    Signal handler for cache invalidation.

    Automatically invalidates cache on model save/delete.
    """

    cache_key_prefix: str = ""

    def __init__(
        self,
        model: type[Model] | None = None,
        cache_key_prefix: str = "",
    ):
        """
        Initialize the cache invalidation signal handler.

        Args:
            model: The model to handle signals for
            cache_key_prefix: Prefix for cache keys
        """
        super().__init__(model)
        self.cache_key_prefix = cache_key_prefix

    def handle_post_save(
        self,
        sender: type[Model],
        instance: Model,
        created: bool,
        **kwargs: Any,
    ) -> None:
        """
        Invalidate cache after save.

        Args:
            sender: The model class
            instance: The model instance
            created: Whether the instance was created
            **kwargs: Additional keyword arguments
        """
        self.invalidate_cache(instance)

    def handle_post_delete(
        self,
        sender: type[Model],
        instance: Model,
        **kwargs: Any,
    ) -> None:
        """
        Invalidate cache after delete.

        Args:
            sender: The model class
            instance: The model instance
            **kwargs: Additional keyword arguments
        """
        self.invalidate_cache(instance)

    def invalidate_cache(self, instance: Model) -> None:
        """
        Invalidate cache for an instance.

        Args:
            instance: The model instance
        """
        from django.core.cache import cache

        if self.cache_key_prefix:
            cache_key = f"{self.cache_key_prefix}:{instance.pk}"
            cache.delete(cache_key)

            # Also invalidate list cache
            list_cache_key = f"{self.cache_key_prefix}:list"
            cache.delete(list_cache_key)


class EventDispatchSignalHandler(BaseSignalHandler):
    """
    Signal handler for event dispatch.

    Automatically dispatches events on model save/delete.
    """

    event_dispatcher: Callable | None = None

    def __init__(
        self,
        model: type[Model] | None = None,
        event_dispatcher: Callable | None = None,
    ):
        """
        Initialize the event dispatch signal handler.

        Args:
            model: The model to handle signals for
            event_dispatcher: Callable to dispatch events
        """
        super().__init__(model)
        self.event_dispatcher = event_dispatcher

    def handle_post_save(
        self,
        sender: type[Model],
        instance: Model,
        created: bool,
        **kwargs: Any,
    ) -> None:
        """
        Dispatch event after save.

        Args:
            sender: The model class
            instance: The model instance
            created: Whether the instance was created
            **kwargs: Additional keyword arguments
        """
        if created:
            self.dispatch_event("created", instance)
        else:
            self.dispatch_event("updated", instance)

    def handle_post_delete(
        self,
        sender: type[Model],
        instance: Model,
        **kwargs: Any,
    ) -> None:
        """
        Dispatch event after delete.

        Args:
            sender: The model class
            instance: The model instance
            **kwargs: Additional keyword arguments
        """
        self.dispatch_event("deleted", instance)

    def dispatch_event(self, event_type: str, instance: Model) -> None:
        """
        Dispatch an event.

        Args:
            event_type: Type of event (created, updated, deleted)
            instance: The model instance
        """
        if self.event_dispatcher:
            self.event_dispatcher(event_type, instance)
