"""
Base task classes for Celery integration.

Provides common functionality for background job processing.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, TypeVar

from celery import Task as CeleryTask
from celery.exceptions import Retry

if TYPE_CHECKING:
    from celery.app.task import Context

logger = logging.getLogger(__name__)

T = TypeVar("T")


class BaseTask(CeleryTask):
    """
    Base task class for all Celery tasks.

    Provides common functionality for:
    - Logging
    - Error handling
    - Retry logic
    - Context management
    """

    abstract = True

    # Default retry settings
    max_retries: int = 3
    default_retry_delay: int = 3  # seconds

    def on_success(
        self,
        retval: Any,
        task_id: str,
        args: tuple,
        kwargs: dict,
    ) -> None:
        """
        Handle task success.

        Args:
            retval: The return value of the task
            task_id: Unique id of the executed task
            args: Original arguments for the task
            kwargs: Original keyword arguments for the task
        """
        logger.info(
            "Task %s completed successfully",
            self.name,
            extra={
                "task_id": task_id,
                "return_value": retval,
            },
        )

    def on_failure(
        self,
        exc: Exception,
        task_id: str,
        args: tuple,
        kwargs: dict,
        traceback: Any,
    ) -> None:
        """
        Handle task failure.

        Args:
            exc: The exception raised by the task
            task_id: Unique id of the executed task
            args: Original arguments for the task
            kwargs: Original keyword arguments for the task
            traceback: Traceback object for the exception
        """
        logger.error(
            "Task %s failed",
            self.name,
            extra={
                "task_id": task_id,
                "exception": str(exc),
                "args": args,
                "kwargs": kwargs,
            },
            exc_info=exc,
        )

    def on_retry(
        self,
        exc: Exception,
        task_id: str,
        args: tuple,
        kwargs: dict,
        traceback: Any,
        einfo: Any,
    ) -> None:
        """
        Handle task retry.

        Args:
            exc: The exception that triggered the retry
            task_id: Unique id of the executed task
            args: Original arguments for the task
            kwargs: Original keyword arguments for the task
            traceback: Traceback object for the exception
            einfo: Exception info
        """
        logger.warning(
            "Task %s is being retried",
            self.name,
            extra={
                "task_id": task_id,
                "exception": str(exc),
                "args": args,
                "kwargs": kwargs,
            },
        )

    def retry_task(
        self,
        exc: Exception | None = None,
        countdown: int | None = None,
        max_retries: int | None = None,
    ) -> None:
        """
        Retry the current task.

        Args:
            exc: Exception that triggered the retry (uses self.default_retry if None)
            countdown: Delay before retry in seconds
            max_retries: Maximum number of retries (uses self.max_retries if None)
        """
        if exc is None:
            exc = Retry("Task retry triggered")

        retry_count = self.request.retries
        max_retries = max_retries or self.max_retries

        if retry_count >= max_retries:
            logger.error(
                "Task %s exceeded maximum retries (%d)",
                self.name,
                max_retries,
                extra={
                    "task_id": self.request.id,
                    "retries": retry_count,
                },
            )
            raise exc

        delay = countdown or self.default_retry_delay * (2**retry_count)
        logger.info(
            "Retrying task %s (attempt %d/%d) in %d seconds",
            self.name,
            retry_count + 1,
            max_retries,
            delay,
            extra={
                "task_id": self.request.id,
                "retry": retry_count + 1,
                "max_retries": max_retries,
                "delay": delay,
            },
        )

        raise self.retry(
            exc=exc,
            countdown=delay,
            max_retries=max_retries,
        )

    def run(self, *args: Any, **kwargs: Any) -> Any:
        """
        Execute the task.

        Override this method in subclasses to implement task logic.

        Args:
            *args: Task arguments
            **kwargs: Task keyword arguments

        Returns:
            Task result
        """
        raise NotImplementedError("Subclasses must implement run()")

    def get_context(self, context: Context | None = None) -> dict:
        """
        Get task context for logging.

        Args:
            context: Celery task context

        Returns:
            Dictionary with task context information
        """
        if context is None:
            context = self.context

        return {
            "task_id": getattr(context, "id", None),
            "task_name": getattr(context, "name", None),
            "task_retries": getattr(context, "retries", 0),
            "task_eta": getattr(context, "eta", None),
            "task_priority": getattr(context, "priority", None),
        }


class BasePeriodicTask(BaseTask):
    """
    Base task class for periodic tasks.

    Provides common functionality for scheduled tasks.
    """

    abstract = True

    # Periodic task settings
    run_every: Any | None = None  # Celery crontab or timedelta
    name: str | None = None

    def run(self, *args: Any, **kwargs: Any) -> Any:
        """
        Execute the periodic task.

        Override this method in subclasses to implement task logic.

        Args:
            *args: Task arguments
            **kwargs: Task keyword arguments

        Returns:
            Task result
        """
        raise NotImplementedError("Subclasses must implement run()")


class BaseEmailTask(BaseTask):
    """
    Base task class for email sending tasks.

    Provides common functionality for asynchronous email delivery.
    """

    abstract = True

    # Email task settings
    max_retries = 5
    default_retry_delay = 10  # seconds

    def run(
        self,
        to: list[str],
        subject: str,
        body: str,
        from_email: str | None = None,
        html_body: str | None = None,
        **kwargs: Any,
    ) -> dict:
        """
        Send an email asynchronously.

        Args:
            to: List of recipient email addresses
            subject: Email subject
            body: Email body (plain text)
            from_email: Sender email address (uses DEFAULT_FROM_EMAIL if None)
            html_body: HTML version of the email body
            **kwargs: Additional email options

        Returns:
            Dictionary with email delivery status
        """
        from django.core.mail import send_mail

        result = {
            "success": False,
            "recipients": to,
            "subject": subject,
        }

        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=to,
                html_message=html_body,
                fail_silently=False,
            )
            result["success"] = True
            logger.info(
                "Email sent successfully to %s",
                to,
                extra=result,
            )
        except Exception as exc:
            logger.error(
                "Failed to send email to %s",
                to,
                extra=result,
                exc_info=exc,
            )
            raise

        return result


class BaseNotificationTask(BaseTask):
    """
    Base task class for notification tasks.

    Provides common functionality for asynchronous notification delivery.
    """

    abstract = True

    # Notification task settings
    max_retries = 3
    default_retry_delay = 5  # seconds

    def run(
        self,
        user_id: str,
        message: str,
        notification_type: str,
        metadata: dict | None = None,
        **kwargs: Any,
    ) -> dict:
        """
        Send a notification asynchronously.

        Args:
            user_id: ID of the user to notify
            message: Notification message
            notification_type: Type of notification (email, sms, push, etc.)
            metadata: Additional notification metadata
            **kwargs: Additional notification options

        Returns:
            Dictionary with notification delivery status
        """
        raise NotImplementedError("Subclasses must implement run()")


class BaseExportTask(BaseTask):
    """
    Base task class for export tasks.

    Provides common functionality for asynchronous data export.
    """

    abstract = True

    # Export task settings
    max_retries = 2
    default_retry_delay = 10  # seconds

    def run(
        self,
        query: Any,
        export_format: str,
        output_path: str,
        **kwargs: Any,
    ) -> dict:
        """
        Export data asynchronously.

        Args:
            query: Queryset or data to export
            export_format: Output format (csv, excel, pdf, etc.)
            output_path: Path to save the exported file
            **kwargs: Additional export options

        Returns:
            Dictionary with export status
        """
        raise NotImplementedError("Subclasses must implement run()")


class BaseImportTask(BaseTask):
    """
    Base task class for import tasks.

    Provides common functionality for asynchronous data import.
    """

    abstract = True

    # Import task settings
    max_retries = 2
    default_retry_delay = 10  # seconds

    def run(
        self,
        file_path: str,
        import_format: str,
        **kwargs: Any,
    ) -> dict:
        """
        Import data asynchronously.

        Args:
            file_path: Path to the file to import
            import_format: Input format (csv, excel, json, etc.)
            **kwargs: Additional import options

        Returns:
            Dictionary with import status
        """
        raise NotImplementedError("Subclasses must implement run()")
