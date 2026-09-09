import io
import json
import logging

import structlog
from django.test import SimpleTestCase

from apps.core.logging import context as log_context
from apps.core.logging.constants import REDACTED
from apps.core.logging.logger import get_logger as get_core_logger
from apps.core.logging.structlog_config import configure_structlog
from apps.core.utils.logger import get_logger as get_utils_logger


class TestLoggingFactory(SimpleTestCase):
    def test_get_logger_returns_structlog_logger(self):
        core_logger = get_core_logger(__name__)
        utils_logger = get_utils_logger(__name__)

        for logger in (core_logger, utils_logger):
            self.assertTrue(hasattr(logger, "info"))
            self.assertTrue(hasattr(logger, "bind"))

    def test_redact_secrets_processor(self):
        from apps.core.logging.processors import redact_secrets

        event_dict = redact_secrets(
            None,
            None,
            {
                "event": "login",
                "password": "hunter2",
                "Username": "u",
                "payload": {
                    "access_token": "abc",
                    "username": "u",
                },
            },
        )

        self.assertEqual(event_dict["password"], REDACTED)
        self.assertEqual(event_dict["payload"]["access_token"], REDACTED)
        self.assertEqual(event_dict["payload"]["username"], "u")
        self.assertEqual(event_dict["Username"], "u")

    def test_json_renderer_output_is_parseable(self):
        configure_structlog(json_output=True)
        log_context.request_id.set("req-123")

        stream = io.StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(
            structlog.stdlib.ProcessorFormatter(
                foreign_pre_chain=[],
                processors=[
                    structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                    structlog.processors.JSONRenderer(),
                ],
            )
        )

        stdlib_logger = logging.getLogger("test.json")
        stdlib_logger.addHandler(handler)

        try:
            get_core_logger("test.json").info(
                "ping", key="value", password="hunter2"
            )
        finally:
            stdlib_logger.removeHandler(handler)
            log_context.request_id.set(None)

        line = stream.getvalue().strip().splitlines()[-1]
        parsed = json.loads(line)

        self.assertEqual(parsed["event"], "ping")
        self.assertEqual(parsed["key"], "value")
        self.assertEqual(parsed["service"], "studiohub")
        self.assertEqual(parsed["request_id"], "req-123")
        self.assertEqual(parsed["password"], REDACTED)
        self.assertIn("timestamp", parsed)
        self.assertIn("level", parsed)
