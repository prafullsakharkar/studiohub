from __future__ import annotations

import logging


class RequestIDFilter(logging.Filter):
    """
    Inject request_id into log records.

    If unavailable, use '-'.
    """

    def filter(self, record):
        if not hasattr(record, "request_id"):
            record.request_id = "-"

        return True
