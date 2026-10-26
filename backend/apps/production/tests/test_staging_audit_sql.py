"""
docs/production/STAGING_AUDIT.sql must be valid, read-only SQL for the current schema.

It is run by hand on staging, so every statement is executed here against the (empty)
test database to catch a wrong table or column name, and checked to be SELECT-only.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from django.db import connection

pytestmark = pytest.mark.skipif(connection.vendor != "postgresql", reason="uses PostgreSQL syntax")

SQL = Path(__file__).resolve().parents[4] / "docs" / "production" / "STAGING_AUDIT.sql"


def _statements():
    text = "\n".join(
        line for line in SQL.read_text().splitlines() if not line.lstrip().startswith("--")
    )
    return [part.strip() for part in text.split(";") if part.strip()]


def test_the_file_exists_and_has_statements():
    assert len(_statements()) >= 14


@pytest.mark.django_db
def test_every_statement_is_a_select_and_runs():
    for statement in _statements():
        assert statement.upper().startswith("SELECT"), statement[:60]
        assert not re.search(
            r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT)\b", statement, re.I
        )
        with connection.cursor() as cursor:
            cursor.execute(statement)
            cursor.fetchall()
