"""
The model checks that only run against a database (index and constraint names, partial-index
support) must pass.

CI's ``manage.py check`` passes no database, so it skips them; ``manage.py migrate`` runs them and
refuses to start on an error (a 31-character index name once blocked every deploy).
"""

from __future__ import annotations

from django.core.checks import Error, Tags, run_checks


def test_model_checks_against_the_database_report_no_errors():
    errors = [
        message
        for message in run_checks(tags=[Tags.models], databases={"default"})
        if isinstance(message, Error)
    ]

    assert errors == [], "\n".join(f"{m.id}: {m.obj}: {m.msg}" for m in errors)
