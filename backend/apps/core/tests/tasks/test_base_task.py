"""``BaseTask`` failure and retry handlers log without colliding with ``logging.LogRecord``'s own attributes."""

from __future__ import annotations

import logging

import pytest

from apps.core.tasks.base import BaseTask


@pytest.fixture
def task() -> BaseTask:
    return BaseTask()


class TestHandlersLogTheTaskArguments:
    """``args`` and ``kwargs`` are reserved on a log record: passing them in ``extra`` raised ``KeyError`` (Celery 5.6 and 5.7)."""

    def test_on_failure_logs_and_keeps_the_arguments(
        self, task: BaseTask, caplog: pytest.LogCaptureFixture
    ):
        with caplog.at_level(logging.ERROR, logger="apps.core.tasks.base"):
            task.on_failure(ValueError("boom"), "id-1", (1, 2), {"k": "v"}, None)

        record = vars(caplog.records[-1])
        assert record["levelno"] == logging.ERROR
        assert record["task_id"] == "id-1"
        assert record["task_args"] == (1, 2)
        assert record["task_kwargs"] == {"k": "v"}

    def test_on_retry_logs_and_keeps_the_arguments(
        self, task: BaseTask, caplog: pytest.LogCaptureFixture
    ):
        with caplog.at_level(logging.WARNING, logger="apps.core.tasks.base"):
            task.on_retry(RuntimeError("later"), "id-2", (3,), {}, None)

        record = vars(caplog.records[-1])
        assert record["levelno"] == logging.WARNING
        assert record["task_id"] == "id-2"
        assert record["task_args"] == (3,)
        assert record["task_kwargs"] == {}

    def test_on_success_still_logs(self, task: BaseTask, caplog: pytest.LogCaptureFixture):
        with caplog.at_level(logging.INFO, logger="apps.core.tasks.base"):
            task.on_success(42, "id-3", (), {})

        assert vars(caplog.records[-1])["return_value"] == 42
