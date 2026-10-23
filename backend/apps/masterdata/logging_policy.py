"""
Which query parameters of the masterdata API carry personal data.

A search or filter such as ``?search=jane@example.com`` must not reach request
logs or the ``audit.APIRequest`` table. The names are registered with the core
redaction registry at startup; values are replaced, names are kept.
"""

from __future__ import annotations

from apps.core.logging.redaction import register_sensitive_query_params

API_PREFIX = "/api/v1"

#: Directory routes (``apps/masterdata/api/urls.py``, ``directory_router``).
#: A test fails if the router gains a route that is missing here.
DIRECTORY_PATHS = (
    "departments",
    "teams",
    "offices",
    "positions",
    "people",
    "client-contacts",
    "vendor-contacts",
    "client-contracts",
    "vendor-contracts",
    "clients",
    "vendors",
)

#: Free-text search plus every filterable field that holds personal data.
SENSITIVE_QUERY_PARAMS = (
    "search",
    "email",
    "phone",
    "contact_name",
    "date_of_birth",
    "nationality",
    "security_clearance",
    "salary_range",
)


def register_query_redaction() -> None:
    for path in DIRECTORY_PATHS:
        register_sensitive_query_params(f"{API_PREFIX}/{path}", SENSITIVE_QUERY_PARAMS)
