"""Row values in database error text never reach logs (masterdata D13 / H1)."""

from __future__ import annotations

import io
import json
import logging

import pytest
import structlog
from django.db import IntegrityError

from apps.core.api.exceptions.handlers import _safe_message
from apps.core.logging.constants import REDACTED
from apps.core.logging.logger import get_logger
from apps.core.logging.processors import redact_database_detail_processor
from apps.core.logging.redaction import redact_database_detail
from apps.core.logging.structlog_config import configure_structlog

EMAIL = "jane.doe@example.com"
UNIQUE = (
    'duplicate key value violates unique constraint "uq_email_ci"\n'
    f"DETAIL:  Key (lower(email::text), parent_id)=({EMAIL}, 7) already exists."
)
NOT_NULL = (
    'null value in column "name" violates not-null constraint\n'
    f"DETAIL:  Failing row contains (1, Jane Doe, {EMAIL}, +1 555 0100)."
)
FOREIGN = (
    'insert or update on table "x" violates foreign key constraint "fk"\n'
    f'DETAIL:  Key (client_id)=({EMAIL}) is not present in table "client".'
)


class TestRedactDatabaseDetail:
    @pytest.mark.parametrize("message", [UNIQUE, NOT_NULL, FOREIGN])
    def test_values_are_removed(self, message):
        out = redact_database_detail(message)
        assert EMAIL not in out
        assert "Jane Doe" not in out
        assert "+1 555 0100" not in out

    def test_the_constraint_name_stays_for_diagnosis(self):
        out = redact_database_detail(UNIQUE)
        assert '"uq_email_ci"' in out
        assert "duplicate key value violates unique constraint" in out

    def test_text_without_detail_is_unchanged(self):
        assert redact_database_detail("plain failure") == "plain failure"

    def test_a_detail_line_followed_by_other_lines_keeps_them(self):
        out = redact_database_detail(
            f"boom\nDETAIL:  Key (a)=({EMAIL}) exists.\nCONTEXT: SQL statement"
        )
        assert EMAIL not in out
        assert "CONTEXT: SQL statement" in out


class TestHandlerMessage:
    def test_the_diagnostic_message_is_redacted(self):
        message = _safe_message(IntegrityError(UNIQUE))
        assert message is not None
        assert EMAIL not in message


class TestProcessor:
    def test_event_exception_and_message_keys_are_redacted(self):
        out = redact_database_detail_processor(
            None,
            "",
            {"event": UNIQUE, "exception": NOT_NULL, "exception_message": FOREIGN, "other": UNIQUE},
        )
        for key in ("event", "exception", "exception_message"):
            assert EMAIL not in out[key]
        # Other keys are not scanned: callers must not log row data in them.
        assert out["other"] == UNIQUE


class TestPipeline:
    def _capture(self):
        configure_structlog(json_output=True)
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
        logger = logging.getLogger("test.dbdetail")
        logger.addHandler(handler)
        return stream, logger, handler

    def test_a_logged_traceback_of_an_integrity_error_does_not_leak_the_value(self):
        stream, stdlib_logger, handler = self._capture()
        try:
            try:
                raise IntegrityError(UNIQUE)
            except IntegrityError:
                get_logger("test.dbdetail").exception("write failed")
        finally:
            stdlib_logger.removeHandler(handler)

        raw = stream.getvalue()
        assert raw
        assert EMAIL not in raw
        parsed = json.loads(raw.strip().splitlines()[-1])
        assert "uq_email_ci" in parsed["exception"]
        assert REDACTED in parsed["exception"]
